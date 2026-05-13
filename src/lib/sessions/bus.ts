// In-process EventEmitter so POST /chunks can notify GET /stream subscribers
// in the same Node instance. This is correct for single-region Vercel deployments
// where the SSE endpoint and chunk endpoint hit the same fra1 lambda warm pool
// most of the time. For deployments where they don't, the SSE endpoint also
// falls back to polling Postgres (see Task 4).
//
// Claude's Discretion: deferring Redis pub/sub. CLAUDE.md mentions Redis hot store
// but it is not yet provisioned. Polling fallback in Task 4 covers cold-routing.

import { EventEmitter } from 'node:events'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

// Module-level singleton — survives across requests within one Node process.
const globalForBus = globalThis as unknown as { __sessionBus?: EventEmitter }

export const sessionBus: EventEmitter =
  globalForBus.__sessionBus ?? new EventEmitter()

if (!globalForBus.__sessionBus) {
  sessionBus.setMaxListeners(0) // unlimited — one listener per active SSE connection
  globalForBus.__sessionBus = sessionBus
}

export function emitSegment(sessionId: string, segment: TranscriptSegmentDTO): void {
  sessionBus.emit(`session:${sessionId}`, segment)
}

export function subscribeToSession(
  sessionId: string,
  handler: (segment: TranscriptSegmentDTO) => void,
): () => void {
  const event = `session:${sessionId}`
  sessionBus.on(event, handler)
  return () => sessionBus.off(event, handler)
}
