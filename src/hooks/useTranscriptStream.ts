'use client'

import { useEffect, useRef, useState } from 'react'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

interface UseTranscriptStreamOptions {
  sessionId: string
  enabled?: boolean   // turn off to disconnect (e.g., session completed and viewer navigated away)
}

interface UseTranscriptStreamResult {
  segments: TranscriptSegmentDTO[]
  connected: boolean
  error: Error | null
}

/**
 * Subscribes to GET /api/sessions/[id]/stream via EventSource.
 * - Replay-on-reconnect: every reconnection passes ?since=<lastSequence> so missed
 *   segments are caught up.
 * - Dedupes by sequence so SSE backlog + live emissions cannot duplicate rows.
 */
export function useTranscriptStream(opts: UseTranscriptStreamOptions): UseTranscriptStreamResult {
  const { sessionId, enabled = true } = opts

  const [segments, setSegments] = useState<TranscriptSegmentDTO[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const lastSequenceRef = useRef(-1)

  useEffect(() => {
    if (!enabled || !sessionId) return
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function connect() {
      if (cancelled) return
      const url = `/api/sessions/${sessionId}/stream?since=${lastSequenceRef.current}`
      es = new EventSource(url)

      es.addEventListener('open', () => setConnected(true))

      es.addEventListener('segment', (event) => {
        try {
          const seg = JSON.parse((event as MessageEvent).data) as TranscriptSegmentDTO
          if (seg.sequence <= lastSequenceRef.current) return // dedupe
          lastSequenceRef.current = seg.sequence
          setSegments((prev) => {
            // Insert maintaining sequence order; in practice always append.
            const next = [...prev, seg]
            next.sort((a, b) => a.sequence - b.sequence)
            return next
          })
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Stream parse error'))
        }
      })

      es.onerror = () => {
        setConnected(false)
        es?.close()
        if (cancelled) return
        // Reconnect with backoff
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      cancelled = true
      es?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [enabled, sessionId])

  return { segments, connected, error }
}
