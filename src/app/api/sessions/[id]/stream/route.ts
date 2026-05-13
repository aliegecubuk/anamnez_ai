import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { subscribeToSession } from '@/lib/sessions/bus'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Long-lived stream — extend default Vercel timeout. Browsers will reconnect every ~5 min.
export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

const POLL_INTERVAL_MS = 1500            // fallback DB poll cadence
const HEARTBEAT_INTERVAL_MS = 15_000     // SSE keepalive

// W-6 SCALING NOTE:
// The Postgres-poll fan-out below is per-session: every active SSE connection
// runs its own 1.5s SELECT. At ~50 concurrent active recording sessions per
// Vercel Node instance this is ~33 QPS to Postgres for fan-out alone, which
// Supabase Pro handles comfortably. Beyond ~50 concurrent sessions per instance
// the connection-count and query-count climb non-linearly and are the primary
// trigger for migrating to Redis pub/sub (CLAUDE.md hot-store). Until that
// load is observed in production we keep the simpler poll path.

// GET /api/sessions/[id]/stream?since=<sequence>
// Server-Sent Events: emits 'segment' events with TranscriptSegmentDTO payloads.
// Replays everything > since on connect, then streams new segments live.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: sessionId } = await params

  // Confirm ownership before opening the stream.
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()
  if (!session) {
    return new Response('Not found', { status: 404 })
  }

  const sinceParam = req.nextUrl.searchParams.get('since')
  const since = sinceParam ? Number.parseInt(sinceParam, 10) : -1

  const encoder = new TextEncoder()
  let highestSequence = Number.isFinite(since) ? since : -1
  let unsubscribe: (() => void) | null = null
  let pollHandle: ReturnType<typeof setInterval> | null = null
  let heartbeatHandle: ReturnType<typeof setInterval> | null = null
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function write(event: string, data: unknown) {
        if (closed) return
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      function emitSegmentSafe(segment: TranscriptSegmentDTO) {
        if (segment.sequence <= highestSequence) return // dedupe
        highestSequence = segment.sequence
        write('segment', segment)
      }

      // 1. Replay everything since `since`
      const { data: backlog } = await supabaseAdmin
        .from('transcript_segments')
        .select('sequence, content, started_at, ended_at')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .gt('sequence', highestSequence)
        .order('sequence', { ascending: true })

      for (const seg of (backlog ?? []) as TranscriptSegmentDTO[]) {
        emitSegmentSafe(seg)
      }

      // 2. Subscribe to in-process bus for live emissions
      unsubscribe = subscribeToSession(sessionId, emitSegmentSafe)

      // 3. Heartbeat (SSE comments don't trigger client onmessage but keep proxies alive)
      heartbeatHandle = setInterval(() => {
        if (closed) return
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, HEARTBEAT_INTERVAL_MS)

      // 4. Poll fallback — covers cross-instance writes when chunk lambda lands on a
      //    different Node process than this stream lambda. See W-6 SCALING NOTE above:
      //    expected ceiling ~50 concurrent sessions per Vercel instance before Redis
      //    migration is the trigger.
      pollHandle = setInterval(async () => {
        if (closed) return
        const { data: fresh } = await supabaseAdmin
          .from('transcript_segments')
          .select('sequence, content, started_at, ended_at')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .gt('sequence', highestSequence)
          .order('sequence', { ascending: true })
        for (const seg of (fresh ?? []) as TranscriptSegmentDTO[]) {
          emitSegmentSafe(seg)
        }
      }, POLL_INTERVAL_MS)

      // 5. Initial 'open' event so client knows backlog is flushed.
      write('open', { since: highestSequence })
    },
    cancel() {
      closed = true
      if (unsubscribe) unsubscribe()
      if (pollHandle) clearInterval(pollHandle)
      if (heartbeatHandle) clearInterval(heartbeatHandle)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering on Vercel edge
    },
  })
}
