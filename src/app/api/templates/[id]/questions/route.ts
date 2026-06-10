import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRole } from '@/lib/clerk/roles'
import { VALID_QUESTION_TYPES } from '@/lib/templates/types'
import type { TemplateQuestionRow, UpsertQuestionBody } from '@/lib/templates/types'

type RouteContext = { params: Promise<{ id: string }> }

const QUESTION_COLUMNS =
  'id, user_id, template_id, prompt, question_type, options, position, required, created_at'

async function ownsTemplate(id: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('form_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// GET /api/templates/[id]/questions — draft questions ordered by position
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params
  if (!(await ownsTemplate(id, userId))) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('template_questions')
    .select(QUESTION_COLUMNS)
    .eq('template_id', id)
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (error) {
    console.error('[questions GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

function validateQuestionBody(body: Partial<UpsertQuestionBody>): string | null {
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return 'Soru metni zorunludur.'
  if (!body.question_type || !VALID_QUESTION_TYPES.includes(body.question_type)) {
    return 'Geçersiz soru tipi.'
  }
  if (body.question_type === 'multi_select') {
    const options = body.options
    if (
      !Array.isArray(options) ||
      options.length === 0 ||
      options.some((o) => typeof o !== 'string' || !o.trim())
    ) {
      return 'Çoklu seçim için en az bir seçenek gerekir.'
    }
  }
  return null
}

// POST /api/templates/[id]/questions — append a question at max(position)+1
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params
  if (!(await ownsTemplate(id, userId))) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as Partial<UpsertQuestionBody>
  const validationError = validateQuestionBody(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 })
  }

  const insertRow = async (): Promise<{ data: TemplateQuestionRow | null; code?: string }> => {
    const { data: maxRow } = await supabaseAdmin
      .from('template_questions')
      .select('position')
      .eq('template_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const position = maxRow ? maxRow.position + 1 : 0

    const { data, error } = await supabaseAdmin
      .from('template_questions')
      .insert({
        user_id: userId,
        template_id: id,
        prompt: (body.prompt as string).trim(),
        question_type: body.question_type,
        options: body.question_type === 'multi_select' ? body.options : null,
        position,
        required: body.required ?? false,
      })
      .select(QUESTION_COLUMNS)
      .single()

    if (error) {
      if (error.code !== '23505') {
        console.error('[questions POST]', { code: error.code, message: error.message })
      }
      return { data: null, code: error.code }
    }
    return { data: data as TemplateQuestionRow }
  }

  // 23505 on (template_id, position) → retry once with recomputed position.
  let result = await insertRow()
  if (!result.data && result.code === '23505') {
    result = await insertRow()
    if (!result.data && result.code === '23505') {
      return NextResponse.json(
        { error: 'Soru eklenirken pozisyon çakışması oluştu. Tekrar deneyin.' },
        { status: 409 },
      )
    }
  }
  if (!result.data) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(result.data, { status: 201 })
}

// PATCH /api/templates/[id]/questions — reorder: body { order: string[] }.
// Two-phase write (+1000 offset) keeps UNIQUE(template_id, position) satisfied throughout (T-04-07).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params
  if (!(await ownsTemplate(id, userId))) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as { order?: unknown }
  const order = body.order
  if (!Array.isArray(order) || order.length === 0 || order.some((q) => typeof q !== 'string')) {
    return NextResponse.json({ error: 'Geçersiz sıralama listesi.' }, { status: 422 })
  }

  // Validate all ids belong to this template (and nothing is missing).
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('template_questions')
    .select('id, position')
    .eq('template_id', id)
    .eq('user_id', userId)

  if (existingError) {
    console.error('[questions PATCH reorder]', {
      code: existingError.code,
      message: existingError.message,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const existingIds = new Set((existing ?? []).map((q) => q.id))
  const orderSet = new Set(order as string[])
  if (
    orderSet.size !== order.length ||
    order.length !== existingIds.size ||
    (order as string[]).some((qid) => !existingIds.has(qid))
  ) {
    return NextResponse.json(
      { error: 'Sıralama listesi şablonun sorularıyla eşleşmiyor.' },
      { status: 422 },
    )
  }

  // Phase 1: offset every row's position by +1000 to clear the UNIQUE range.
  for (const q of existing ?? []) {
    const { error } = await supabaseAdmin
      .from('template_questions')
      .update({ position: q.position + 1000 })
      .eq('id', q.id)
      .eq('user_id', userId)
    if (error) {
      console.error('[questions PATCH reorder phase1]', { code: error.code, message: error.message })
      return NextResponse.json({ error: 'Sıralama güncellenemedi.' }, { status: 500 })
    }
  }

  // Phase 2: write final positions = index in the order array.
  for (let i = 0; i < order.length; i++) {
    const { error } = await supabaseAdmin
      .from('template_questions')
      .update({ position: i })
      .eq('id', order[i] as string)
      .eq('user_id', userId)
    if (error) {
      console.error('[questions PATCH reorder phase2]', { code: error.code, message: error.message })
      return NextResponse.json({ error: 'Sıralama güncellenemedi.' }, { status: 500 })
    }
  }

  const { data: updated, error: updatedError } = await supabaseAdmin
    .from('template_questions')
    .select(QUESTION_COLUMNS)
    .eq('template_id', id)
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (updatedError) {
    console.error('[questions PATCH reorder reload]', {
      code: updatedError.code,
      message: updatedError.message,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(updated ?? [])
}
