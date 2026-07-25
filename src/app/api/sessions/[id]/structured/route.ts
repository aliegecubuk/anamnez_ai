import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseStructuredAnamnesis, StructuredParseError } from '@/lib/openai/structured-anamnesis'
import { enrichMedication } from '@/lib/openai/medications'
import {
  SECTION_KEYS,
  isSectionKey,
  type AnamnesisEntryDTO,
  type MedicationDTO,
  type AiReportDTO,
  type StructuredAnamnesisPayload,
} from '@/lib/anamnesis/structured-types'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteCtx = { params: Promise<{ id: string }> }

const ENTRY_COLUMNS = 'id, section_key, content, confidence, source, edited_by_human, display_order'
const MEDICATION_COLUMNS =
  'id, name, active_ingredient, summary, dental_significance, surgical_precautions, blocks_treatment, risk_level'

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR')
}

async function getOwnedSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('id, form_type')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string; form_type: string }>()
  return data
}

async function loadPayload(sessionId: string, userId: string): Promise<StructuredAnamnesisPayload> {
  const [{ data: entries }, { data: medications }, { data: report }] = await Promise.all([
    supabaseAdmin
      .from('anamnesis_entries')
      .select(ENTRY_COLUMNS)
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('anamnesis_medications')
      .select(MEDICATION_COLUMNS)
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('anamnesis_reports')
      .select('summary, dental_considerations, risk_flags, recommendations, generated_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  return {
    entries: (entries ?? []) as AnamnesisEntryDTO[],
    medications: (medications ?? []) as MedicationDTO[],
    report: (report ?? null) as AiReportDTO | null,
  }
}

// GET /api/sessions/[id]/structured — entries + medications + report
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json(await loadPayload(sessionId, userId))
}

// POST /api/sessions/[id]/structured — GPT-4o classify transcript into the 6
// sections + extract/enrich medications. Human-edited and manual entries are
// preserved; previous unedited AI entries are replaced by the new run.
export async function POST(_req: NextRequest, { params }: RouteCtx) {
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

  if (!transcript) {
    return NextResponse.json({ error: 'Bu seansta işlenecek ses kaydı transkripti yok.' }, { status: 422 })
  }

  let parseResult
  try {
    parseResult = await parseStructuredAnamnesis(transcript)
  } catch (err) {
    if (err instanceof StructuredParseError) {
      console.error('[structured POST parse]', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'Transkript çözümlenemedi.' }, { status: 502 })
    }
    throw err
  }

  // Replace unedited AI entries; keep manual + human-edited rows.
  await supabaseAdmin
    .from('anamnesis_entries')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('source', 'ai')
    .eq('edited_by_human', false)

  const { data: keptRows } = await supabaseAdmin
    .from('anamnesis_entries')
    .select('content')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
  const keptContents = new Set(
    ((keptRows ?? []) as { content: string }[]).map((r) => r.content.trim().toLocaleLowerCase('tr-TR')),
  )

  const entryRows = SECTION_KEYS.flatMap((sectionKey) =>
    (parseResult.sections[sectionKey] ?? [])
      .filter((item) => item.content.trim().length > 0)
      .filter((item) => !keptContents.has(item.content.trim().toLocaleLowerCase('tr-TR')))
      .map((item, index) => ({
        user_id: userId,
        session_id: sessionId,
        section_key: sectionKey,
        content: item.content.trim(),
        confidence: Math.max(0, Math.min(1, item.confidence)),
        source: 'ai',
        edited_by_human: false,
        display_order: index,
      })),
  )

  if (entryRows.length > 0) {
    const { error } = await supabaseAdmin.from('anamnesis_entries').insert(entryRows)
    if (error) {
      console.error('[structured POST insert entries]', error)
      return NextResponse.json({ error: 'Bilgiler kaydedilemedi.' }, { status: 500 })
    }
  }

  // Enrich only medications not already stored for this session.
  const { data: existingMeds } = await supabaseAdmin
    .from('anamnesis_medications')
    .select('name_key')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
  const existingKeys = new Set(((existingMeds ?? []) as { name_key: string }[]).map((m) => m.name_key))

  const newNames = [...new Map(
    parseResult.medications
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      .map((n) => [normalizeNameKey(n), n] as const),
  ).entries()].filter(([key]) => !existingKeys.has(key))

  if (newNames.length > 0) {
    const enriched = await Promise.allSettled(newNames.map(([, name]) => enrichMedication(name)))
    const medicationRows = newNames.map(([key, name], i) => {
      const result = enriched[i]
      if (result.status === 'fulfilled') {
        const m = result.value
        return {
          user_id: userId,
          session_id: sessionId,
          name: m.name || name,
          name_key: key,
          active_ingredient: m.active_ingredient,
          summary: m.summary,
          dental_significance: m.dental_significance,
          surgical_precautions: m.surgical_precautions,
          blocks_treatment: m.blocks_treatment,
          risk_level: m.risk_level,
        }
      }
      console.error('[structured POST enrich]', { name, reason: String(result.reason) })
      // Keep the drug visible even if enrichment failed; hekim can delete + re-add.
      return {
        user_id: userId,
        session_id: sessionId,
        name,
        name_key: key,
        active_ingredient: null,
        summary: null,
        dental_significance: null,
        surgical_precautions: null,
        blocks_treatment: null,
        risk_level: null,
      }
    })

    await supabaseAdmin
      .from('anamnesis_medications')
      .upsert(medicationRows, { onConflict: 'session_id,name_key' })
  }

  return NextResponse.json(await loadPayload(sessionId, userId))
}

// PATCH /api/sessions/[id]/structured — hekim düzeltmeleri.
// Ops: upsert_entry | delete_entry | add_medication | delete_medication | clear
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as {
    op?: string
    id?: string
    section_key?: string
    content?: string
    name?: string
  }

  if (body.op === 'upsert_entry') {
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) return NextResponse.json({ error: 'Boş satır kaydedilemez.' }, { status: 422 })
    if (!isSectionKey(body.section_key)) {
      return NextResponse.json({ error: 'Geçersiz bölüm.' }, { status: 422 })
    }

    if (body.id) {
      const { data, error } = await supabaseAdmin
        .from('anamnesis_entries')
        .update({ content, section_key: body.section_key, edited_by_human: true, confidence: null })
        .eq('id', body.id)
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .select(ENTRY_COLUMNS)
        .single()
      if (error || !data) return NextResponse.json({ error: 'Satır güncellenemedi.' }, { status: 500 })
      return NextResponse.json({ entry: data as AnamnesisEntryDTO })
    }

    const { count } = await supabaseAdmin
      .from('anamnesis_entries')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('section_key', body.section_key)

    const { data, error } = await supabaseAdmin
      .from('anamnesis_entries')
      .insert({
        user_id: userId,
        session_id: sessionId,
        section_key: body.section_key,
        content,
        confidence: null,
        source: 'manual',
        edited_by_human: true,
        display_order: (count ?? 0),
      })
      .select(ENTRY_COLUMNS)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Satır eklenemedi.' }, { status: 500 })
    return NextResponse.json({ entry: data as AnamnesisEntryDTO })
  }

  if (body.op === 'delete_entry') {
    if (!body.id) return NextResponse.json({ error: 'Satır kimliği gerekli.' }, { status: 422 })
    await supabaseAdmin
      .from('anamnesis_entries')
      .delete()
      .eq('id', body.id)
      .eq('session_id', sessionId)
      .eq('user_id', userId)
    return NextResponse.json({ ok: true })
  }

  if (body.op === 'add_medication') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'İlaç adı gerekli.' }, { status: 422 })
    const nameKey = normalizeNameKey(name)

    let enrichment = null
    try {
      enrichment = await enrichMedication(name)
    } catch (err) {
      console.error('[structured PATCH add_medication]', { name, err: String(err) })
    }

    const { data, error } = await supabaseAdmin
      .from('anamnesis_medications')
      .upsert(
        {
          user_id: userId,
          session_id: sessionId,
          name: enrichment?.name || name,
          name_key: nameKey,
          active_ingredient: enrichment?.active_ingredient ?? null,
          summary: enrichment?.summary ?? null,
          dental_significance: enrichment?.dental_significance ?? null,
          surgical_precautions: enrichment?.surgical_precautions ?? null,
          blocks_treatment: enrichment?.blocks_treatment ?? null,
          risk_level: enrichment?.risk_level ?? null,
        },
        { onConflict: 'session_id,name_key' },
      )
      .select(MEDICATION_COLUMNS)
      .single()
    if (error || !data) return NextResponse.json({ error: 'İlaç eklenemedi.' }, { status: 500 })
    return NextResponse.json({ medication: data as MedicationDTO })
  }

  if (body.op === 'delete_medication') {
    if (!body.id) return NextResponse.json({ error: 'İlaç kimliği gerekli.' }, { status: 422 })
    await supabaseAdmin
      .from('anamnesis_medications')
      .delete()
      .eq('id', body.id)
      .eq('session_id', sessionId)
      .eq('user_id', userId)
    return NextResponse.json({ ok: true })
  }

  if (body.op === 'clear') {
    await Promise.all([
      supabaseAdmin.from('anamnesis_entries').delete().eq('session_id', sessionId).eq('user_id', userId),
      supabaseAdmin.from('anamnesis_medications').delete().eq('session_id', sessionId).eq('user_id', userId),
      supabaseAdmin.from('anamnesis_reports').delete().eq('session_id', sessionId).eq('user_id', userId),
    ])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 422 })
}
