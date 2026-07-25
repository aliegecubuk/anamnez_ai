import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateAiReport, AiReportError } from '@/lib/openai/report'
import type {
  AiReportDTO,
  AnamnesisEntryDTO,
  MedicationDTO,
} from '@/lib/anamnesis/structured-types'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteCtx = { params: Promise<{ id: string }> }

const REPORT_COLUMNS = 'summary, dental_considerations, risk_flags, recommendations, generated_at'

async function getOwnedSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()
  return data
}

// GET /api/sessions/[id]/report — stored AI report (or null)
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const { data } = await supabaseAdmin
    .from('anamnesis_reports')
    .select(REPORT_COLUMNS)
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({ report: (data ?? null) as AiReportDTO | null })
}

// POST /api/sessions/[id]/report — (re)generate the AI assessment from the
// current classified entries + medications, then upsert.
export async function POST(_req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const [{ data: entries }, { data: medications }] = await Promise.all([
    supabaseAdmin
      .from('anamnesis_entries')
      .select('id, section_key, content, confidence, source, edited_by_human, display_order')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('anamnesis_medications')
      .select('id, name, active_ingredient, summary, dental_significance, surgical_precautions, blocks_treatment, risk_level')
      .eq('session_id', sessionId)
      .eq('user_id', userId),
  ])

  const entryList = (entries ?? []) as AnamnesisEntryDTO[]
  const medicationList = (medications ?? []) as MedicationDTO[]

  if (entryList.length === 0 && medicationList.length === 0) {
    return NextResponse.json(
      { error: 'Rapor için önce anamnez bilgileri işlenmelidir.' },
      { status: 422 },
    )
  }

  let result
  try {
    result = await generateAiReport(entryList, medicationList)
  } catch (err) {
    if (err instanceof AiReportError) {
      console.error('[report POST]', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'AI raporu oluşturulamadı.' }, { status: 502 })
    }
    throw err
  }

  const { data, error } = await supabaseAdmin
    .from('anamnesis_reports')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        summary: result.summary,
        dental_considerations: result.dental_considerations,
        risk_flags: result.risk_flags,
        recommendations: result.recommendations,
        model: 'gpt-4o',
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    )
    .select(REPORT_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[report POST upsert]', error)
    return NextResponse.json({ error: 'Rapor kaydedilemedi.' }, { status: 500 })
  }

  return NextResponse.json({ report: data as AiReportDTO })
}
