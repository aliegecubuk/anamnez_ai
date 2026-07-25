import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/sessions/[id]/transcript
// Returns: TranscriptSegmentDTO[] ordered by sequence ASC
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  // Confirm ownership.
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()
  if (!session) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('transcript_segments')
    .select('sequence, content, started_at, ended_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('sequence', { ascending: true })

  if (error) {
    console.error('[transcript GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Transkript okunamadı.' }, { status: 500 })
  }

  return NextResponse.json((data ?? []) as TranscriptSegmentDTO[])
}

async function getOwnedSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()
  return data
}

// POST /api/sessions/[id]/transcript — manually add a sentence (typed, no audio).
// Body: { content }. Sequence = max+1; retried on the unique race.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { content?: string }
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'Boş cümle eklenemez.' }, { status: 422 })

  const now = new Date().toISOString()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: last } = await supabaseAdmin
      .from('transcript_segments')
      .select('sequence')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle<{ sequence: number }>()

    const { data, error } = await supabaseAdmin
      .from('transcript_segments')
      .insert({
        user_id: userId,
        session_id: sessionId,
        sequence: (last?.sequence ?? -1) + 1,
        content,
        started_at: now,
        ended_at: now,
      })
      .select('sequence, content, started_at, ended_at')
      .single<TranscriptSegmentDTO>()

    if (!error && data) return NextResponse.json(data, { status: 201 })
    if (error?.code !== '23505') {
      console.error('[transcript POST]', { code: error?.code, message: error?.message })
      return NextResponse.json({ error: 'Cümle eklenemedi.' }, { status: 500 })
    }
    // 23505: a live audio chunk grabbed the same sequence — recompute and retry.
  }
  return NextResponse.json({ error: 'Cümle eklenemedi (sıra çakışması).' }, { status: 409 })
}

// PATCH /api/sessions/[id]/transcript — hekim edits a sentence.
// Body: { sequence, content }
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { sequence?: number; content?: string }
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!Number.isInteger(body.sequence) || (body.sequence as number) < 0) {
    return NextResponse.json({ error: 'Geçersiz sequence.' }, { status: 422 })
  }
  if (!content) return NextResponse.json({ error: 'Boş içerik kaydedilemez.' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('transcript_segments')
    .update({ content })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('sequence', body.sequence)
    .select('sequence, content, started_at, ended_at')
    .single<TranscriptSegmentDTO>()

  if (error || !data) {
    return NextResponse.json({ error: 'Cümle güncellenemedi.' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/sessions/[id]/transcript?sequence=N — remove a sentence.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const sequence = Number.parseInt(req.nextUrl.searchParams.get('sequence') ?? '', 10)
  if (!Number.isInteger(sequence) || sequence < 0) {
    return NextResponse.json({ error: 'Geçersiz sequence.' }, { status: 422 })
  }

  await supabaseAdmin
    .from('transcript_segments')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('sequence', sequence)

  return NextResponse.json({ ok: true })
}
