import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapTranscriptToAnswers, AnamnesisMappingError } from '@/lib/openai/anamnesis'
import { buildMissingAlerts } from '@/lib/anamnesis/mapper'
import type { AnamnesisAnswerDTO, AnswerValue, MissingFieldAlert } from '@/lib/anamnesis/types'
import type { SnapshotQuestion } from '@/lib/templates/types'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

interface SessionTemplateRow {
  id: string
  template_version_id: string | null
}

// Load the owned session + its bound template version questions.
// Returns { questions } on success, or a NextResponse to short-circuit.
async function loadSessionContext(
  sessionId: string,
  userId: string,
): Promise<
  | { questions: SnapshotQuestion[]; templateVersionId: string }
  | { error: NextResponse }
> {
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, template_version_id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<SessionTemplateRow>()

  if (!session) {
    return { error: NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 }) }
  }
  if (!session.template_version_id) {
    return {
      error: NextResponse.json({ error: 'Bu seansa şablon atanmamış.' }, { status: 422 }),
    }
  }

  const { data: version } = await supabaseAdmin
    .from('template_versions')
    .select('id, questions')
    .eq('id', session.template_version_id)
    .eq('user_id', userId)
    .single<{ id: string; questions: SnapshotQuestion[] }>()

  if (!version) {
    return { error: NextResponse.json({ error: 'Şablon sürümü bulunamadı.' }, { status: 404 }) }
  }

  return { questions: version.questions ?? [], templateVersionId: version.id }
}

// Order saved answer DTOs to match the question snapshot order.
function orderAnswers(
  rows: AnamnesisAnswerDTO[],
  questions: SnapshotQuestion[],
): AnamnesisAnswerDTO[] {
  const byId = new Map(rows.map((r) => [r.question_id, r]))
  return questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => byId.get(q.id))
    .filter((r): r is AnamnesisAnswerDTO => r !== undefined)
}

// POST /api/sessions/[id]/anamnesis — run GPT-4o mapping, upsert answers (ANAM-01/02).
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const ctx = await loadSessionContext(sessionId, userId)
  if ('error' in ctx) return ctx.error
  const { questions } = ctx

  // Concatenate transcript segments (ordered) into a single string.
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

  let result
  try {
    result = await mapTranscriptToAnswers(transcript, questions)
  } catch (err) {
    if (err instanceof AnamnesisMappingError) {
      console.error('[anamnesis POST mapping]', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'AI form doldurma başarısız.' }, { status: 502 })
    }
    throw err
  }

  const questionById = new Map(questions.map((q) => [q.id, q]))

  // Upsert one row per answered question — keyed by (session_id, question_id).
  const upsertRows = result.answers.map((a) => ({
    user_id: userId,
    session_id: sessionId,
    question_id: a.question_id,
    prompt: questionById.get(a.question_id)?.prompt ?? '',
    question_type: questionById.get(a.question_id)?.question_type ?? 'text',
    answer_value: a.answer_value,
    confidence: a.confidence,
    edited_by_human: false,
  }))

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('anamnesis_answers')
      .upsert(upsertRows, { onConflict: 'session_id,question_id' })

    if (upsertError) {
      console.error('[anamnesis POST upsert]', {
        code: upsertError.code,
        message: upsertError.message,
      })
      return NextResponse.json({ error: 'Cevaplar kaydedilemedi.' }, { status: 500 })
    }
  }

  const answers: AnamnesisAnswerDTO[] = result.answers.map((a) => ({
    question_id: a.question_id,
    prompt: questionById.get(a.question_id)?.prompt ?? '',
    question_type: questionById.get(a.question_id)?.question_type ?? 'text',
    answer_value: a.answer_value,
    confidence: a.confidence,
    edited_by_human: false,
  }))

  const missing: MissingFieldAlert[] = buildMissingAlerts(result.answers, questions)

  return NextResponse.json({
    answers: orderAnswers(answers, questions),
    missing,
    corrected_transcript: result.corrected_transcript ?? null,
  })
}

// GET /api/sessions/[id]/anamnesis — load saved answers (used on reload).
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const ctx = await loadSessionContext(sessionId, userId)
  if ('error' in ctx) return ctx.error
  const { questions } = ctx

  const { data: rows, error } = await supabaseAdmin
    .from('anamnesis_answers')
    .select('question_id, prompt, question_type, answer_value, confidence, edited_by_human')
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  if (error) {
    console.error('[anamnesis GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Cevaplar okunamadı.' }, { status: 500 })
  }

  const answers = orderAnswers((rows ?? []) as AnamnesisAnswerDTO[], questions)
  const missing = buildMissingAlerts(
    answers.map((a) => ({
      question_id: a.question_id,
      answer_value: a.answer_value,
      confidence: a.confidence ?? 0,
    })),
    questions,
  )

  return NextResponse.json({ answers, missing })
}

// PATCH /api/sessions/[id]/anamnesis — manual edit of one answer (ANAM-03).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const body = (await req.json().catch(() => ({}))) as {
    question_id?: string
    answer_value?: AnswerValue
  }
  const question_id = (body.question_id ?? '').trim()

  if (!question_id) {
    return NextResponse.json({ error: 'question_id zorunludur.' }, { status: 422 })
  }

  // Ownership: the answer row must belong to this user's session.
  const { data: existing } = await supabaseAdmin
    .from('anamnesis_answers')
    .select('id')
    .eq('session_id', sessionId)
    .eq('question_id', question_id)
    .eq('user_id', userId)
    .single<{ id: string }>()

  if (!existing) {
    return NextResponse.json({ error: 'Cevap bulunamadı.' }, { status: 404 })
  }

  // Human edit → confidence cleared (no AI confidence for a hand-set value).
  const { error } = await supabaseAdmin
    .from('anamnesis_answers')
    .update({
      answer_value: body.answer_value ?? null,
      edited_by_human: true,
      confidence: null,
    })
    .eq('id', existing.id)
    .eq('user_id', userId)

  if (error) {
    console.error('[anamnesis PATCH]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Cevap güncellenemedi.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
