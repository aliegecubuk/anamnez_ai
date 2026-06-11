import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parsePathologyTranscript, PathologyParseError } from '@/lib/openai/pathology'
import type { ToothConditionDTO, ToothConditionRow, PathologyCondition } from '@/lib/perio/types'
import { ALL_CONDITIONS, ALL_FDI_TEETH } from '@/lib/perio/types'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteCtx = { params: Promise<{ id: string }> }

async function getOwnedSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()
  return data
}

async function getConditions(sessionId: string, userId: string): Promise<ToothConditionDTO[]> {
  const { data } = await supabaseAdmin
    .from('tooth_conditions')
    .select('id, tooth_number, condition_type, notes')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('tooth_number', { ascending: true })
  return (data ?? []) as ToothConditionDTO[]
}

// GET /api/sessions/[id]/pathology — fetch conditions
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ conditions: await getConditions(sessionId, userId) })
}

// POST /api/sessions/[id]/pathology/parse — GPT-4o parse transcript → upsert conditions
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const { data: segments } = await supabaseAdmin
    .from('transcript_segments')
    .select('content, sequence')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('sequence', { ascending: true })

  const transcript = (segments ?? [])
    .map((s) => (s as { content: string }).content)
    .filter((c) => typeof c === 'string' && c.trim().length > 0)
    .join('\n')

  let parseResult
  try {
    parseResult = await parsePathologyTranscript(transcript)
  } catch (err) {
    if (err instanceof PathologyParseError) {
      console.error('[pathology POST parse]', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'Transkript çözümlenemedi.' }, { status: 502 })
    }
    throw err
  }

  const validConditions = new Set<string>(ALL_CONDITIONS)
  const upsertRows = parseResult.confirmed
    .filter((c) => ALL_FDI_TEETH.has(c.tooth_number) && validConditions.has(c.condition_type))
    .map((c) => ({
      user_id:        userId,
      session_id:     sessionId,
      tooth_number:   c.tooth_number,
      condition_type: c.condition_type as PathologyCondition,
    }))

  if (upsertRows.length > 0) {
    await supabaseAdmin
      .from('tooth_conditions')
      .upsert(upsertRows, { onConflict: 'session_id,tooth_number,condition_type' })
  }

  return NextResponse.json({
    conditions: await getConditions(sessionId, userId),
    ambiguous: parseResult.ambiguous,
  })
}

// PUT /api/sessions/[id]/pathology — add a single condition manually
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { tooth_number?: number; condition_type?: string; notes?: string }
  const { tooth_number, condition_type, notes } = body

  if (!tooth_number || !ALL_FDI_TEETH.has(tooth_number)) {
    return NextResponse.json({ error: 'Geçersiz diş numarası.' }, { status: 422 })
  }
  if (!condition_type || !(ALL_CONDITIONS as string[]).includes(condition_type)) {
    return NextResponse.json({ error: 'Geçersiz durum türü.' }, { status: 422 })
  }

  await supabaseAdmin
    .from('tooth_conditions')
    .upsert(
      { user_id: userId, session_id: sessionId, tooth_number, condition_type: condition_type as PathologyCondition, notes: notes ?? null },
      { onConflict: 'session_id,tooth_number,condition_type' },
    )

  return NextResponse.json({ ok: true })
}

// DELETE /api/sessions/[id]/pathology — remove a condition by id
export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const body = await req.json().catch(() => ({})) as { condition_id?: string }
  if (!body.condition_id) return NextResponse.json({ error: 'condition_id zorunludur.' }, { status: 422 })

  const { data: existing } = await supabaseAdmin
    .from('tooth_conditions')
    .select('id')
    .eq('id', body.condition_id)
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()

  if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404 })

  await supabaseAdmin.from('tooth_conditions').delete().eq('id', body.condition_id).eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
