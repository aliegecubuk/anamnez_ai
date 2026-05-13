import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { transcribeAudio, WhisperError } from '@/lib/openai/whisper'
import { emitSegment } from '@/lib/sessions/bus'
import type { AudioFormat, TranscriptSegmentDTO } from '@/lib/sessions/types'

// Force Node.js runtime — multipart parsing + openai SDK are not Edge-compatible
// and Whisper calls can take several seconds (Edge has stricter limits).
export const runtime = 'nodejs'
// Allow up to 60s for slow Whisper round-trips; default 10s on Vercel hobby is too tight.
export const maxDuration = 60

// W-3: hard upper bound on audio chunk size. Whisper API itself caps at 25MB; we
// reject at 24MB to leave headroom for multipart overhead. This is enforced BEFORE
// any Whisper call so a malicious client can't burn our quota.
const MAX_AUDIO_BYTES = 24 * 1024 * 1024
// Pre-flight check on the whole request body — multipart wrapper is small, so
// 25MB content-length is a reliable upper bound for the audio Blob inside it.
const MAX_REQUEST_BYTES = 25 * 1024 * 1024

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/sessions/[id]/chunks
// multipart/form-data: audio (Blob), sequence (string), started_at (ISO), ended_at (ISO)
// Returns 201 TranscriptSegmentDTO on success, 200 if (session_id, sequence) already exists, 413 on >24MB.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  // W-3: pre-flight Content-Length check BEFORE buffering or auth lookup.
  // Whisper's hard cap is 25MB; we reject at 25MB request-level (covers multipart overhead).
  const contentLength = Number.parseInt(req.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: `Ses parçası çok büyük (≤${MAX_AUDIO_BYTES / (1024 * 1024)}MB).` },
      { status: 413 },
    )
  }

  // Confirm ownership + fetch audio_format from the session row.
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, audio_format, recorder_state')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string; audio_format: AudioFormat | null; recorder_state: string }>()

  if (!session) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }
  if (!session.audio_format) {
    return NextResponse.json({ error: 'Seansa ses formatı atanmamış.' }, { status: 409 })
  }
  if (session.recorder_state === 'completed') {
    return NextResponse.json({ error: 'Tamamlanmış seansa parça eklenemez.' }, { status: 409 })
  }

  // Parse multipart form-data
  const form = await req.formData()
  const audio = form.get('audio')
  const sequenceRaw = form.get('sequence')
  const startedAt = form.get('started_at')
  const endedAt = form.get('ended_at')

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Multipart 'audio' alanı eksik." }, { status: 422 })
  }
  if (typeof sequenceRaw !== 'string' || typeof startedAt !== 'string' || typeof endedAt !== 'string') {
    return NextResponse.json({ error: 'sequence/started_at/ended_at eksik.' }, { status: 422 })
  }

  // W-3: post-parse audio Blob size check (covers cases where Content-Length was misreported).
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Ses parçası çok büyük (≤${MAX_AUDIO_BYTES / (1024 * 1024)}MB).` },
      { status: 413 },
    )
  }

  const sequence = Number.parseInt(sequenceRaw, 10)
  if (!Number.isFinite(sequence) || sequence < 0) {
    return NextResponse.json({ error: 'sequence negatif olamaz.' }, { status: 422 })
  }
  if (audio.size === 0) {
    // Treat as silence — store an empty content row so sequence numbering stays dense.
    return persistAndReturn({
      sessionId,
      userId,
      sequence,
      content: '',
      startedAt,
      endedAt,
    })
  }

  // Transcribe
  let content: string
  try {
    content = await transcribeAudio(audio, session.audio_format)
  } catch (err) {
    if (err instanceof WhisperError) {
      console.error('[chunks POST] WhisperError', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'Transkripsiyon başarısız.', code: err.code }, { status: 502 })
    }
    console.error('[chunks POST] unexpected', err)
    return NextResponse.json({ error: 'Transkripsiyon başarısız.' }, { status: 500 })
  }

  return persistAndReturn({ sessionId, userId, sequence, content, startedAt, endedAt })
}

async function persistAndReturn(args: {
  sessionId: string
  userId: string
  sequence: number
  content: string
  startedAt: string
  endedAt: string
}): Promise<NextResponse> {
  const { sessionId, userId, sequence, content, startedAt, endedAt } = args

  const { data, error } = await supabaseAdmin
    .from('transcript_segments')
    .insert({
      user_id: userId,
      session_id: sessionId,
      sequence,
      content,
      started_at: startedAt,
      ended_at: endedAt,
    })
    .select('sequence, content, started_at, ended_at')
    .single<TranscriptSegmentDTO>()

  if (error) {
    // Idempotent retry: 23505 = unique violation on (session_id, sequence)
    if (error.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('transcript_segments')
        .select('sequence, content, started_at, ended_at')
        .eq('session_id', sessionId)
        .eq('sequence', sequence)
        .single<TranscriptSegmentDTO>()
      if (existing) return NextResponse.json(existing, { status: 200 })
    }
    console.error('[chunks INSERT]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Segment kaydedilemedi.' }, { status: 500 })
  }

  // Notify SSE subscribers in this Node process.
  emitSegment(sessionId, data)

  return NextResponse.json(data, { status: 201 })
}
