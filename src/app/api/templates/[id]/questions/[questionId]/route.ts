import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRole } from '@/lib/clerk/roles'
import { VALID_QUESTION_TYPES } from '@/lib/templates/types'
import type { QuestionType, UpsertQuestionBody } from '@/lib/templates/types'

type RouteContext = { params: Promise<{ id: string; questionId: string }> }

const QUESTION_COLUMNS =
  'id, user_id, template_id, prompt, question_type, options, position, required, created_at'

// PATCH /api/templates/[id]/questions/[questionId] — partial update of a draft question
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id, questionId } = await params

  // Load the current row (ownership + template scoping in one check).
  const { data: current, error: currentError } = await supabaseAdmin
    .from('template_questions')
    .select(QUESTION_COLUMNS)
    .eq('id', questionId)
    .eq('template_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (currentError) {
    console.error('[question PATCH]', { code: currentError.code, message: currentError.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!current) {
    return NextResponse.json({ error: 'Soru bulunamadı.' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as Partial<UpsertQuestionBody>
  const updates: Record<string, unknown> = {}

  if (body.prompt !== undefined) {
    const prompt = body.prompt.trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Soru metni zorunludur.' }, { status: 422 })
    }
    updates.prompt = prompt
  }

  if (body.question_type !== undefined) {
    if (!VALID_QUESTION_TYPES.includes(body.question_type)) {
      return NextResponse.json({ error: 'Geçersiz soru tipi.' }, { status: 422 })
    }
    updates.question_type = body.question_type
  }

  if (body.options !== undefined) {
    updates.options = body.options
  }

  if (body.required !== undefined) {
    updates.required = !!body.required
  }

  // Re-validate the multi_select options rule against the EFFECTIVE post-update state.
  const effectiveType = (updates.question_type ?? current.question_type) as QuestionType
  const effectiveOptions = (
    updates.options !== undefined ? updates.options : current.options
  ) as string[] | null
  if (effectiveType === 'multi_select') {
    if (
      !Array.isArray(effectiveOptions) ||
      effectiveOptions.length === 0 ||
      effectiveOptions.some((o) => typeof o !== 'string' || !o.trim())
    ) {
      return NextResponse.json(
        { error: 'Çoklu seçim için en az bir seçenek gerekir.' },
        { status: 422 },
      )
    }
  } else if (updates.question_type !== undefined && updates.options === undefined) {
    // Type changed away from multi_select — clear stale options.
    updates.options = null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(current)
  }

  const { data, error } = await supabaseAdmin
    .from('template_questions')
    .update(updates)
    .eq('id', questionId)
    .eq('template_id', id)
    .eq('user_id', userId)
    .select(QUESTION_COLUMNS)
    .maybeSingle()

  if (error) {
    console.error('[question PATCH]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Soru bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// DELETE /api/templates/[id]/questions/[questionId] — hard delete from the DRAFT set.
// Published template_versions snapshots are independent jsonb copies — unaffected.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id, questionId } = await params

  const { data, error } = await supabaseAdmin
    .from('template_questions')
    .delete()
    .eq('id', questionId)
    .eq('template_id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[question DELETE]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Soru bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, deleted: true })
}
