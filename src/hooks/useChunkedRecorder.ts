'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'

// Pause-aware segmentation: a segment is cut when the speaker pauses (~0.7s of
// silence) instead of on a fixed clock, so sentences stop getting chopped at
// 3-4 words. MAX caps run-on speech; MIN prevents machine-gun tiny chunks.
const DEFAULT_MAX_SEGMENT_MS = 8000
const MIN_SEGMENT_MS = 1500
const PAUSE_SILENCE_MS = 700
const ROTATION_CHECK_MS = 100
const MAX_QUEUE_SIZE = 10
const MAX_CONSECUTIVE_FAILURES = 3
// Concurrent chunk uploads. Whisper roundtrips (1-3s) used to serialize behind each
// other and the transcript lagged further with every chunk; sequence numbers make
// out-of-order completion safe (client + DB both order by sequence).
const MAX_PARALLEL_UPLOADS = 3
const UPLOAD_TIMEOUT_MS = 30_000
// VAD: RMS threshold below which a chunk is treated as silence and skipped.
// Web Audio getByteTimeDomainData values: 128=silence, ±127=max. Normalized to [-1,1].
// Speech RMS ≈ 0.08–0.5; ambient noise ≈ 0.01–0.05. 0.03 (was 0.05) so quiet mics
// don't get real speech silently dropped — that read as "STT broken".
const VAD_RMS_THRESHOLD = 0.03

interface UseChunkedRecorderOptions {
  // Session-backed mode: chunks POST to /api/sessions/{id}/chunks and recorder
  // state PATCHes to /api/sessions/{id}/state.
  sessionId?: string
  // Stateless mode (e.g. hospital module): chunks POST to this URL, no server
  // state sync. Takes precedence over sessionId for the upload target.
  chunkUrl?: string
  audioFormat: AudioFormat
  chunkMs?: number   // max segment length cap (pause detection usually cuts earlier)
  initialRecorderState?: RecorderState
  onError?: (err: Error) => void
  // Fired with the transcribed segment as soon as the chunk POST returns —
  // lets the recording client render text immediately instead of waiting for SSE.
  onSegment?: (segment: TranscriptSegmentDTO) => void
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
    chunkUrl,
    audioFormat,
    chunkMs: maxSegmentMs = DEFAULT_MAX_SEGMENT_MS,
    initialRecorderState = 'idle',
    onError,
    onSegment,
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
  // Consecutive silence duration (ms) at the tail of the current segment — the
  // rotation loop cuts the segment once this passes PAUSE_SILENCE_MS.
  const silenceRunMsRef = useRef(0)

  const uploadQueueRef = useRef<QueuedChunk[]>([])
  const activeUploadsRef = useRef(0)
  const drainWaitersRef = useRef<Array<() => void>>([])

  const onSegmentRef = useRef(onSegment)
  useEffect(() => { onSegmentRef.current = onSegment }, [onSegment])

  const stateRef = useRef<RecorderState>(initialRecorderState)
  useEffect(() => { stateRef.current = state }, [state])

  const handleError = useCallback((err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err))
    setRecorderError(e)
    onError?.(e)
  }, [onError])

  const setServerState = useCallback(
    async (next: RecorderState) => {
      // Stateless mode: no session row, nothing to sync.
      if (!sessionId) return
      // 8s hard cap — a wedged network request must never trap the recorder UI
      // in a transitional state ("Sonlandırılıyor…" forever).
      const res = await fetch(`/api/sessions/${sessionId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorder_state: next }),
        signal: AbortSignal.timeout(8000),
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
    async (blob: Blob, sequence: number, startedAt: Date, endedAt: Date): Promise<TranscriptSegmentDTO | null> => {
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
          const res = await fetch(chunkUrl ?? `/api/sessions/${sessionId}/chunks`, {
            method: 'POST',
            body: form,
            signal: controller.signal,
          })
          clearTimeout(timer)
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            throw new Error(errBody.error ?? `Chunk yüklenemedi (${res.status})`)
          }
          return await res.json().catch(() => null) as TranscriptSegmentDTO | null
        } catch (err) {
          clearTimeout(timer)
          lastErr = err
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('Chunk yüklenemedi')
    },
    [chunkUrl, sessionId],
  )

  // Parallel drain: up to MAX_PARALLEL_UPLOADS chunks in flight. Whisper roundtrips
  // no longer serialize behind each other; ordering is restored by `sequence`.
  const pumpQueue = useCallback(() => {
    while (
      activeUploadsRef.current < MAX_PARALLEL_UPLOADS &&
      uploadQueueRef.current.length > 0
    ) {
      const item = uploadQueueRef.current.shift()!
      activeUploadsRef.current += 1
      setPendingUploads(uploadQueueRef.current.length + activeUploadsRef.current)

      uploadChunk(item.blob, item.sequence, item.startedAt, item.endedAt)
        .then((segment) => {
          consecutiveFailuresRef.current = 0
          // Instant transcript: render the segment now, don't wait for the SSE hop.
          if (segment && segment.content) onSegmentRef.current?.(segment)
        })
        .catch((err) => {
          consecutiveFailuresRef.current += 1
          handleError(err)
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            triggerAutoPause()
          }
        })
        .finally(() => {
          activeUploadsRef.current -= 1
          setPendingUploads(uploadQueueRef.current.length + activeUploadsRef.current)
          if (uploadQueueRef.current.length === 0 && activeUploadsRef.current === 0) {
            drainWaitersRef.current.splice(0).forEach((resolve) => resolve())
          } else {
            pumpQueue()
          }
        })
    }
  }, [handleError, triggerAutoPause, uploadChunk])

  // Resolves once the queue is empty AND no upload is in flight (used by stop()).
  const waitForDrain = useCallback((): Promise<void> => {
    if (uploadQueueRef.current.length === 0 && activeUploadsRef.current === 0) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => drainWaitersRef.current.push(resolve))
  }, [])

  const enqueueChunk = useCallback((blob: Blob, sequence: number, startedAt: Date, endedAt: Date) => {
    if (uploadQueueRef.current.length >= MAX_QUEUE_SIZE) {
      toast.warning('Yükleme kuyruğu doldu — kayıt duraklatıldı.')
      triggerAutoPause()
      return
    }
    uploadQueueRef.current.push({ blob, sequence, startedAt, endedAt })
    setPendingUploads(uploadQueueRef.current.length + activeUploadsRef.current)
    pumpQueue()
  }, [pumpQueue, triggerAutoPause])

  // Start VAD polling on the shared AudioContext/AnalyserNode.
  // Measures RMS every 50ms: updates segmentPeakRmsRef (silence-skip gate) and
  // silenceRunMsRef (pause-aware segmentation).
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
      silenceRunMsRef.current = rms < VAD_RMS_THRESHOLD ? silenceRunMsRef.current + 50 : 0
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
    // Reset VAD trackers for this segment window.
    segmentPeakRmsRef.current = 0
    silenceRunMsRef.current = 0
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

  // Pause-aware rotation: cut the segment when the speaker takes a breath
  // (PAUSE_SILENCE_MS of tail silence after at least MIN_SEGMENT_MS), or at
  // maxSegmentMs regardless — so sentences arrive whole, not chopped mid-word.
  const startRotationLoop = useCallback((stream: MediaStream) => {
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
    chunkIntervalRef.current = setInterval(() => {
      if (stateRef.current !== 'recording') return
      const recorder = recorderRef.current
      if (!recorder || recorder.state !== 'recording') return

      const elapsed = Date.now() - segmentStartRef.current.getTime()
      const hadSpeech = segmentPeakRmsRef.current >= VAD_RMS_THRESHOLD
      const pausedNow = silenceRunMsRef.current >= PAUSE_SILENCE_MS
      const shouldRotate =
        elapsed >= maxSegmentMs ||
        (elapsed >= MIN_SEGMENT_MS && hadSpeech && pausedNow)
      if (!shouldRotate) return

      recorder.addEventListener('stop', () => {
        if (stateRef.current === 'recording') {
          segmentStartRef.current = new Date()
          startSegment(stream)
        }
      }, { once: true })
      recorder.stop()
    }, ROTATION_CHECK_MS)
  }, [maxSegmentMs, startSegment])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      sequenceRef.current = 0
      consecutiveFailuresRef.current = 0
      uploadQueueRef.current = []
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
      startRotationLoop(stream)

      setState('recording')
    } catch (err) {
      handleError(err)
      throw err
    }
  }, [handleError, startSegment, startRotationLoop])

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
    startRotationLoop(stream)

    setState('recording')
    await setServerState('recording').catch(handleError)
  }, [handleError, setServerState, start, startSegment, startRotationLoop])

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

    setState('stopped')
    pumpQueue()
    // Bounded drain: give in-flight uploads 15s, then move on. A stuck upload
    // must not keep the hekim staring at "Sonlandırılıyor…" — the transcript
    // rows that made it are durable either way.
    await Promise.race([
      waitForDrain(),
      new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
    ])

    // FSM requires stopped → completed order; both calls are time-capped and
    // non-blocking for the UI (completed state is set locally regardless).
    await setServerState('stopped').catch(() => {})
    await setServerState('completed').catch(() => {})
    setState('completed')
  }, [pumpQueue, waitForDrain, setServerState, stopVadPoll])

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
