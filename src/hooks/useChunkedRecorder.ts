'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AudioFormat, RecorderState } from '@/lib/sessions/types'

const DEFAULT_CHUNK_MS = 2000             // B-2: dropped from 5s to 2s to bound residual loss
const MAX_INFLIGHT = 2                     // W-2: concurrency cap (Whisper tier-1 50 RPM ceiling)
const MAX_CONSECUTIVE_FAILURES = 3         // W-8: auto-pause threshold

interface UseChunkedRecorderOptions {
  sessionId: string
  audioFormat: AudioFormat
  chunkMs?: number                         // default 2000 (~2s chunks; B-2)
  initialRecorderState?: RecorderState     // W-5: client mirrors server truth on mount
  onError?: (err: Error) => void
}

interface UseChunkedRecorderResult {
  state: RecorderState
  start: () => Promise<void>     // requests mic + starts recorder
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>      // also waits for in-flight uploads + transitions to 'completed'
  pendingUploads: number          // count of chunks not yet ack'd
  recorderError: Error | null
  retryRequired: boolean          // W-8: true after MAX_CONSECUTIVE_FAILURES; cleared on resume()
  droppedChunks: number           // W-2: count of chunks dropped due to MAX_INFLIGHT overflow
}

/**
 * Owns: MediaStream (mic), MediaRecorder, sequence counter, in-flight upload tracker.
 * Drives: server-side recorder_state via PATCH /api/sessions/[id]/state.
 *
 * Important invariants:
 * - sequence increments by 1 per chunk and never resets within a session.
 * - On pause/resume MediaRecorder.requestData() flushes the in-progress chunk first
 *   so we never lose audio at the boundary.
 * - On stop we MediaRecorder.stop() (which fires one last ondataavailable),
 *   then await all uploads, then PATCH state -> stopped, then -> completed.
 * - On visibilitychange→hidden AND on pagehide, we call requestData() so the in-progress
 *   chunk is flushed before the tab is destroyed (B-2). Residual loss bound: ≤ chunkMs.
 * - State is initialized from initialRecorderState (default 'idle'); resumed paused sessions
 *   render paused UI immediately on mount (W-5).
 * - In-flight uploads capped at MAX_INFLIGHT=2 (W-2); overflow → drop with toast + dropped_chunks++.
 * - After MAX_CONSECUTIVE_FAILURES=3, auto-pause + PATCH server + retryRequired=true (W-8).
 */
export function useChunkedRecorder(opts: UseChunkedRecorderOptions): UseChunkedRecorderResult {
  const {
    sessionId,
    audioFormat,
    chunkMs = DEFAULT_CHUNK_MS,
    initialRecorderState = 'idle',
    onError,
  } = opts

  const [state, setState] = useState<RecorderState>(initialRecorderState)   // W-5
  const [pendingUploads, setPendingUploads] = useState(0)
  const [recorderError, setRecorderError] = useState<Error | null>(null)
  const [retryRequired, setRetryRequired] = useState(false)                  // W-8
  const [droppedChunks, setDroppedChunks] = useState(0)                      // W-2

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sequenceRef = useRef(0)
  const chunkStartRef = useRef<Date>(new Date())
  const inflightRef = useRef<Set<Promise<unknown>>>(new Set())
  const consecutiveFailuresRef = useRef(0)                                   // W-8

  // stateRef keeps ondataavailable closure in sync with current state for the PATCH dropped_chunks call
  const stateRef = useRef<RecorderState>(initialRecorderState)
  useEffect(() => { stateRef.current = state }, [state])

  const handleError = useCallback((err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err))
    setRecorderError(e)
    onError?.(e)
  }, [onError])

  const setServerState = useCallback(
    async (next: RecorderState, droppedIncrement = 0) => {
      const body: Record<string, unknown> = { recorder_state: next }
      if (droppedIncrement > 0) body.dropped_chunks_increment = droppedIncrement
      const res = await fetch(`/api/sessions/${sessionId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `Durum güncellenemedi (${res.status})`)
      }
    },
    [sessionId],
  )

  // W-8: auto-pause after MAX_CONSECUTIVE_FAILURES
  const triggerAutoPause = useCallback(async () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      try { recorder.pause() } catch { /* ignore — best effort */ }
    }
    setState('paused')
    setRetryRequired(true)
    try { await setServerState('paused') } catch (err) { handleError(err) }
    toast.error('Yükleme başarısız oldu — kayıt duraklatıldı. Devam etmek için "Devam Et"e basın.')
  }, [handleError, setServerState])

  const uploadChunk = useCallback(
    async (blob: Blob, sequence: number, startedAt: Date, endedAt: Date) => {
      // Pre-flight size guard: fail fast on >24MB to align with server's 413 (W-3).
      const MAX_BYTES = 24 * 1024 * 1024
      if (blob.size > MAX_BYTES) {
        throw new Error('Ses parçası 24MB sınırını aşıyor; parça atlandı.')
      }

      const form = new FormData()
      form.append('audio', blob, `chunk-${sequence}.bin`)
      form.append('sequence', String(sequence))
      form.append('started_at', startedAt.toISOString())
      form.append('ended_at', endedAt.toISOString())

      // Retry once with linear backoff on network failure. After two failures, surface error.
      let lastErr: unknown = null
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/chunks`, {
            method: 'POST',
            body: form,
          })
          if (!res.ok && res.status !== 200) {
            const errBody = await res.json().catch(() => ({}))
            throw new Error(errBody.error ?? `Chunk yüklenemedi (${res.status})`)
          }
          consecutiveFailuresRef.current = 0   // W-8: success resets failure streak
          return
        } catch (err) {
          lastErr = err
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('Chunk yüklenemedi')
    },
    [sessionId],
  )

  const trackUpload = useCallback((p: Promise<unknown>) => {
    inflightRef.current.add(p)
    setPendingUploads(inflightRef.current.size)
    p.finally(() => {
      inflightRef.current.delete(p)
      setPendingUploads(inflightRef.current.size)
    })
  }, [])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: audioFormat })
      recorderRef.current = recorder
      // sequenceRef is NOT reset here — server-side sequence is the source of truth and
      // continues across resumes within the same session. For brand-new sessions sequence
      // starts at 0; for client-side resume after reload it also starts at 0 because the
      // browser cannot preserve MediaRecorder across reload (Plan 03-04 documents this).
      sequenceRef.current = 0
      chunkStartRef.current = new Date()
      consecutiveFailuresRef.current = 0
      setRetryRequired(false)

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return
        // W-2: concurrency cap — drop if already at MAX_INFLIGHT.
        if (inflightRef.current.size >= MAX_INFLIGHT) {
          setDroppedChunks((n) => n + 1)
          // Best-effort: increment server-side counter. Failure of this PATCH does NOT block recording.
          setServerState(stateRef.current, 1).catch(() => { /* swallow */ })
          toast.warning('Yükleme kuyruğu doldu — bir parça atlandı.')
          return
        }
        const sequence = sequenceRef.current++
        const startedAt = chunkStartRef.current
        const endedAt = new Date()
        chunkStartRef.current = endedAt
        const upload = uploadChunk(event.data, sequence, startedAt, endedAt).catch((err) => {
          consecutiveFailuresRef.current += 1                                  // W-8
          handleError(err)
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            triggerAutoPause()
          }
        })
        trackUpload(upload)
      }
      recorder.onerror = (event) => {
        handleError(new Error(`MediaRecorder error: ${(event as ErrorEvent).message ?? 'unknown'}`))
      }

      // Server already in 'recording' from POST /api/sessions; just start capturing.
      recorder.start(chunkMs)
      setState('recording')
    } catch (err) {
      handleError(err)
      throw err
    }
  }, [audioFormat, chunkMs, handleError, setServerState, trackUpload, triggerAutoPause, uploadChunk])

  const pause = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    // Flush in-progress chunk so we don't drop audio at the boundary.
    recorder.requestData()
    recorder.pause()
    setState('paused')
    await setServerState('paused').catch(handleError)
  }, [handleError, setServerState])

  const resume = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    chunkStartRef.current = new Date()
    consecutiveFailuresRef.current = 0   // W-8: clear failure streak on manual resume
    setRetryRequired(false)
    recorder.resume()
    setState('recording')
    await setServerState('recording').catch(handleError)
  }, [handleError, setServerState])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state !== 'inactive') {
      // Wait for the final ondataavailable to fire after stop().
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
        recorder.stop()
      })
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Wait for all in-flight chunk uploads to settle before declaring stopped.
    await Promise.allSettled(Array.from(inflightRef.current))

    setState('stopped')
    await setServerState('stopped').catch(handleError)
    setState('completed')
    await setServerState('completed').catch(handleError)
  }, [handleError, setServerState])

  // B-2: flush in-progress chunk on visibilitychange→hidden AND on pagehide.
  // Both events are required: Safari prefers pagehide; Chrome prefers visibilitychange.
  // requestData() synchronously enqueues a 'dataavailable' event; the upload begins
  // before the tab is destroyed. Residual loss bound: ≤ chunkMs (default 2000ms).
  useEffect(() => {
    function flushIfActive() {
      const recorder = recorderRef.current
      if (recorder && recorder.state === 'recording') {
        try { recorder.requestData() } catch { /* ignore */ }
      }
    }
    function onVisibility() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        flushIfActive()
      }
    }
    function onPageHide() {
      flushIfActive()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', onPageHide)
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide)
      }
    }
  }, [])

  // Cleanup on unmount: stop tracks; do NOT auto-PATCH state (caller controls lifecycle).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

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
