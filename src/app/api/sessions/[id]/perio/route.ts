import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parsePerioTranscript, PerioParseError } from '@/lib/openai/perio'
import type {
  PerioChartDTO,
  PerioChartRow,
  PerioMeasurementDTO,
  PerioMeasurementRow,
  PerioPatchBody,
  PerioPoint,
} from '@/lib/perio/types'
import { PERIO_POINTS, ALL_FDI_TEETH } from '@/lib/perio/types'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteCtx = { params: Promise<{ id: string }> }

async function getOwnedSession(sessionId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('id, form_type')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string; form_type: string }>()
  return data
}

async function getOrCreateChart(sessionId: string, userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('perio_charts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single<PerioChartRow>()

  if (existing) return existing

  const { data: created } = await supabaseAdmin
    .from('perio_charts')
    .insert({ session_id: sessionId, user_id: userId })
    .select('*')
    .single<PerioChartRow>()

  return created
}

async function getMeasurements(chartId: string, userId: string): Promise<PerioMeasurementDTO[]> {
  const { data } = await supabaseAdmin
    .from('perio_measurements')
    .select('tooth_number, point, pocket_depth, attachment_loss, bleeding')
    .eq('chart_id', chartId)
    .eq('user_id', userId)
  return (data ?? []) as PerioMeasurementDTO[]
}

// GET /api/sessions/[id]/perio — fetch chart + measurements (or create draft)
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const chart = await getOrCreateChart(sessionId, userId)
  if (!chart) return NextResponse.json({ error: 'Chart oluşturulamadı.' }, { status: 500 })

  const measurements = await getMeasurements(chart.id, userId)
  const dto: PerioChartDTO = {
    id: chart.id,
    session_id: chart.session_id,
    status: chart.status,
    saved_at: chart.saved_at,
    addendum: chart.addendum,
    measurements,
  }
  return NextResponse.json(dto)
}

// POST /api/sessions/[id]/perio/parse — GPT-4o parse transcript → upsert measurements
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const chart = await getOrCreateChart(sessionId, userId)
  if (!chart) return NextResponse.json({ error: 'Chart oluşturulamadı.' }, { status: 500 })

  if (chart.status === 'saved') {
    return NextResponse.json({ error: 'Kaydedilmiş chart değiştirilemez.' }, { status: 409 })
  }

  // Load transcript
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
    parseResult = await parsePerioTranscript(transcript)
  } catch (err) {
    if (err instanceof PerioParseError) {
      console.error('[perio POST parse]', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'Transkript çözümlenemedi.' }, { status: 502 })
    }
    throw err
  }

  // Upsert confirmed measurements
  const upsertRows = parseResult.confirmed.flatMap((entry) => {
    if (!ALL_FDI_TEETH.has(entry.tooth_number)) return []
    return PERIO_POINTS.map((point) => {
      const m = entry.measurements[point]
      return {
        user_id:         userId,
        chart_id:        chart.id,
        tooth_number:    entry.tooth_number,
        point,
        pocket_depth:    m?.pocket_depth ?? null,
        attachment_loss: m?.attachment_loss ?? null,
        bleeding:        m?.bleeding ?? null,
      }
    }).filter((r) =>
      r.pocket_depth !== null || r.attachment_loss !== null || r.bleeding !== null,
    )
  })

  if (upsertRows.length > 0) {
    await supabaseAdmin
      .from('perio_measurements')
      .upsert(upsertRows, { onConflict: 'chart_id,tooth_number,point' })
  }

  const measurements = await getMeasurements(chart.id, userId)
  return NextResponse.json({
    measurements,
    ambiguous: parseResult.ambiguous,
  })
}

// PATCH /api/sessions/[id]/perio — update single measurement cell
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Partial<PerioPatchBody>
  const { tooth_number, point } = body

  if (!tooth_number || !ALL_FDI_TEETH.has(tooth_number)) {
    return NextResponse.json({ error: 'Geçersiz diş numarası.' }, { status: 422 })
  }
  if (!point || !PERIO_POINTS.includes(point as PerioPoint)) {
    return NextResponse.json({ error: 'Geçersiz ölçüm noktası.' }, { status: 422 })
  }

  const chart = await getOrCreateChart(sessionId, userId)
  if (!chart) return NextResponse.json({ error: 'Chart bulunamadı.' }, { status: 500 })
  if (chart.status === 'saved') {
    return NextResponse.json({ error: 'Kaydedilmiş chart değiştirilemez.' }, { status: 409 })
  }

  await supabaseAdmin
    .from('perio_measurements')
    .upsert(
      {
        user_id:         userId,
        chart_id:        chart.id,
        tooth_number,
        point,
        pocket_depth:    body.pocket_depth ?? null,
        attachment_loss: body.attachment_loss ?? null,
        bleeding:        body.bleeding ?? null,
      },
      { onConflict: 'chart_id,tooth_number,point' },
    )

  return NextResponse.json({ ok: true })
}

// PUT /api/sessions/[id]/perio — save (finalize) chart; immutable after this
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  if (!await getOwnedSession(sessionId, userId)) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const chart = await getOrCreateChart(sessionId, userId)
  if (!chart) return NextResponse.json({ error: 'Chart bulunamadı.' }, { status: 500 })
  if (chart.status === 'saved') {
    return NextResponse.json({ error: 'Chart zaten kaydedilmiş.' }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('perio_charts')
    .update({ status: 'saved', saved_at: new Date().toISOString() })
    .eq('id', chart.id)
    .eq('user_id', userId)

  if (error) {
    console.error('[perio PUT save]', error)
    return NextResponse.json({ error: 'Chart kaydedilemedi.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
