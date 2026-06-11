'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AudioFormat, RecorderState } from '@/lib/sessions/types'

const DEFAULT_CHUNK_MS = 5000
const MAX_QUEUE_SIZE = 6
const MAX_CONSECUTIVE_FAILURES = 3
const UPLOAD_TIMEOUT_MS = 30_000
// VAD: RMS threshold below which a chunk is treated as silence and skipped.
// Web Audio getByteTimeDomainData values: 128=silence, ±127=max. Normalized to [-1,1].
// Speech RMS ≈ 0.08–0.5; ambient noise ≈ 0.01–0.05.
const VAD_RMS_THRESHOLD = 0.05

interface UseChunkedRecorderOptions {
  sessionId: string
  audioFormat: AudioFormat
  chunkMs?: number
  initialRecorderState?: RecorderState
  onError?: (err: Error) => void
}

interface UseChunkedRecorderResult {
  state: RecorderState
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  pendingUploads: number
  recorderError: Error | null
  retryRequired: boolean
  droppedChunks: number
}

interface QueuedChunk {
  blob: Blob
  sequence: number
  startedAt: Date
  endedAt: Date
}

export function useChunkedRecorder(opts: UseChunkedRecorderOptions): UseChunkedRecorderResult {
  const {
    sessionId,
    audioFormat,
    chunkMs = DEFAULT_CHUNK_MS,
    initialRecorderState = 'idle',
    onError,
  } = opts

  const [state, setState] = useState<RecorderState>(initialRecorderState)
  const [pendingUploads, setPendingUploads] = useState(0)
  const [recorderError, setRecorderError] = useState<Error | null>(null)
  const [retryRequired, setRetryRequired] = useState(false)
  const [droppedChunks] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sequenceRef = useRef(0)
  const segmentStartRef = useRef<Date>(new Date())
  const consecutiveFailuresRef = useRef(0)

  // VAD: AudioContext + AnalyserNode live for the duration of the recording session.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Peak RMS seen during current segment — reset at segment start, checked at segment end.
  const segmentPeakRmsRef = useRef(0)

  const uploadQueueRef = useRef<QueuedChunk[]>([])
  const processingRef = useRef(false)

  const stateRef = useRef<RecorderState>(initialRecorderState)
  useEffect(() => { stateRef.current = state }, [state])

  const handleError = useCallback((err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err))
    setRecorderError(e)
    onError?.(e)
  }, [onError])

  const setServerState = useCallback(
    async (next: RecorderState) => {
      const res = await fetch(`/api/sessions/${sessionId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorder_state: next }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Durum güncellenemedi (${res.status})`)
      }
    },
    [sessionId],
  )

  const triggerAutoPause = useCallback(async () => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      try { recorder.stop() } catch { /* best effort */ }
    }
    setState('paused')
    setRetryRequired(true)
    try { await setServerState('paused') } catch (err) { handleError(err) }
    toast.error('Yükleme başarısız oldu — kayıt duraklatıldı. Devam etmek için "Devam Et"e basın.')
  }, [handleError, setServerState])

  const uploadChunk = useCallback(
    async (blob: Blob, sequence: number, startedAt: Date, endedAt: Date): Promise<void> => {
      if (blob.size > 24 * 1024 * 1024) {
        throw new Error('Ses parçası 24MB sınırını aşıyor.')
      }

      const form = new FormData()
      form.append('audio', blob, `chunk-${sequence}.bin`)
      form.append('sequence', String(sequence))
      form.append('started_at', startedAt.toISOString())
      form.append('ended_at', endedAt.toISOString())

      let lastErr: unknown = null
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
        try {
          const res = await fetch(`/api/sessions/${sessionId}/chunks`, {
            method: 'POST',
            body: form,
            signal: controller.signal,
          })
          clearTimeout(timer)
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            throw new Error(errBody.error ?? `Chunk yüklenemedi (${res.status})`)
          }
          return
        } catch (err) {
          clearTimeout(timer)
          lastErr = err
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('Chunk yüklenemedi')
    },
    [sessionId],
  )

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    while (uploadQueueRef.current.length > 0) {
      const item = uploadQueueRef.current[0]
      setPendingUploads(uploadQueueRef.current.length)
      try {
        await uploadChunk(item.blob, item.sequence, item.startedAt, item.endedAt)
        uploadQueueRef.current.shift()
        consecutiveFailuresRef.current = 0
      } catch (err) {
        uploadQueueRef.current.shift()
        consecutiveFailuresRef.current += 1
        handleError(err)
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          processingRef.current = false
          setPendingUploads(uploadQueueRef.current.length)
          triggerAutoPause()
          return
        }
      }
    }

    processingRef.current = false
    setPendingUploads(0)
  }, [handleError, triggerAutoPause, uploadChunk])

  const enqueueChunk = useCallback((blob: Blob, sequence: number, startedAt: Date, endedAt: Date) => {
    if (uploadQueueRef.current.length >= MAX_QUEUE_SIZE) {
      toast.warning('Yükleme kuyruğu doldu — kayıt duraklatıldı.')
      triggerAutoPause()
      return
    }
    uploadQueueRef.current.push({ blob, sequence, startedAt, endedAt })
    setPendingUploads(uploadQueueRef.current.length)
    drainQueue()
  }, [drainQueue, triggerAutoPause])

  // Start VAD polling on the shared AudioContext/AnalyserNode.
  // Measures RMS every 50ms and updates segmentPeakRmsRef.
  const startVadPoll = useCallback(() => {
    if (vadPollRef.current) clearInterval(vadPollRef.current)
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)
    vadPollRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      if (rms > segmentPeakRmsRef.current) segmentPeakRmsRef.current = rms
    }, 50)
  }, [])

  const stopVadPoll = useCallback(() => {
    if (vadPollRef.current) {
      clearInterval(vadPollRef.current)
      vadPollRef.current = null
    }
  }, [])

  const startSegment = useCallback((stream: MediaStream) => {
    const recorder = new MediaRecorder(stream, { mimeType: audioFormat })
    recorderRef.current = recorder
    const segmentStart = segmentStartRef.current
    // Reset peak RMS for this segment window.
    segmentPeakRmsRef.current = 0
    startVadPoll()

    recorder.ondataavailable = (event) => {
      stopVadPoll()
      if (!event.data || event.data.size === 0) return
      // VAD gate: skip chunk if peak RMS never exceeded threshold (silence/ambient noise).
      if (segmentPeakRmsRef.current < VAD_RMS_THRESHOLD) return
      const sequence = sequenceRef.current++
      const endedAt = new Date()
      enqueueChunk(event.data, sequence, segmentStart, endedAt)
    }

    recorder.onerror = (event) => {
      stopVadPoll()
      handleError(new Error(`MediaRecorder error: ${(event as ErrorEvent).message ?? 'unknown'}`))
    }

    recorder.start()
  }, [audioFormat, enqueueChunk, handleError, startVadPoll, stopVadPoll])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      sequenceRef.current = 0
      consecutiveFailuresRef.current = 0
      uploadQueueRef.current = []
      processingRef.current = false
      setRetryRequired(false)
      segmentStartRef.current = new Date()

      // Single AudioContext for the whole session — reused across segments.
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser

      startSegment(stream)

      chunkIntervalRef.current = setInterval(() => {
        if (stateRef.current !== 'recording') return
        const prev = recorderRef.current
        if (prev && prev.state === 'recording') {
          prev.addEventListener('stop', () => {
            if (stateRef.current === 'recording') {
              segmentStartRef.current = new Date()
              startSegment(stream)
            }
          }, { once: true })
          prev.stop()
        }
      }, chunkMs)

      setState('recording')
    } catch (err) {
      handleError(err)
      throw err
    }
  }, [chunkMs, handleError, startSegment])

  const pause = useCallback(async () => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }
    stopVadPoll()
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
    setState('paused')
    await setServerState('paused').catch(handleError)
  }, [handleError, setServerState, stopVadPoll])

  const resume = useCallback(async () => {
    if (!streamRef.current) {
      // Page-reload resume: stream never created this mount — start fresh.
      await start()
      await setServerState('recording').catch(handleError)
      return
    }
    const stream = streamRef.current
    consecutiveFailuresRef.current = 0
    setRetryRequired(false)
    segmentStartRef.current = new Date()

    startSegment(stream)

    chunkIntervalRef.current = setInterval(() => {
      if (stateRef.current !== 'recording') return
      const prev = recorderRef.current
      if (prev && prev.state === 'recording') {
        prev.addEventListener('stop', () => {
          if (stateRef.current === 'recording') {
            segmentStartRef.current = new Date()
            startSegment(stream)
          }
        }, { once: true })
        prev.stop()
      }
    }, chunkMs)

    setState('recording')
    await setServerState('recording').catch(handleError)
  }, [chunkMs, handleError, setServerState, start, startSegment])

  const stop = useCallback(async () => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }
    stopVadPoll()
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
        recorder.stop()
      })
    }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    await drainQueue()

    setState('stopped')
    await setServerState('stopped').catch(handleError)
    setState('completed')
    await setServerState('completed').catch(handleError)
  }, [drainQueue, handleError, setServerState, stopVadPoll])

  // B-2: flush on tab hide/close.
  useEffect(() => {
    function flushIfActive() {
      if (stateRef.current !== 'recording') return
      const recorder = recorderRef.current
      if (recorder && recorder.state === 'recording') {
        const stream = streamRef.current
        const prev = recorder
        if (stream) {
          segmentStartRef.current = new Date()
          startSegment(stream)
        }
        try { prev.stop() } catch { /* ignore */ }
      }
    }
    function onVisibility() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        flushIfActive()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', flushIfActive)
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', flushIfActive)
      }
    }
  }, [startSegment])

  useEffect(() => {
    return () => {
      stopVadPoll()
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [stopVadPoll])

  return {
    state,
    start,
    pause,
    resume,
    stop,
    pendingUploads,
    recorderError,
    retryRequired,
    droppedChunks,
  }
}
