import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRole } from '@/lib/clerk/roles'
import type { SnapshotQuestion, TemplateQuestionRow } from '@/lib/templates/types'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/templates/[id]/publish
// Snapshots the live template_questions into an IMMUTABLE template_versions row
// (TPLT-04) and bumps form_templates.current_version. Insert-only — prior
// template_versions rows are NEVER updated or deleted (T-04-06).
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params

  // 1. Load template header — 404 if not owned.
  const { data: template, error: templateError } = await supabaseAdmin
    .from('form_templates')
    .select('id, name, department, current_version')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (templateError) {
    console.error('[templates publish]', {
      code: templateError.code,
      message: templateError.message,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!template) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  // Load live draft questions ordered by position.
  const { data: questions, error: questionsError } = await supabaseAdmin
    .from('template_questions')
    .select('id, prompt, question_type, options, position, required')
    .eq('template_id', id)
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (questionsError) {
    console.error('[templates publish questions]', {
      code: questionsError.code,
      message: questionsError.message,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 2. Cannot publish an empty template.
  if (!questions || questions.length === 0) {
    return NextResponse.json(
      { error: 'Yayınlamak için en az bir soru ekleyin.' },
      { status: 422 },
    )
  }

  // 3. Next version number.
  const nextVersion = template.current_version + 1

  // 4. Build the FROZEN snapshot — sessions reference this jsonb copy,
  //    never the live template_questions rows.
  const snapshot: SnapshotQuestion[] = (
    questions as Pick<
      TemplateQuestionRow,
      'id' | 'prompt' | 'question_type' | 'options' | 'position' | 'required'
    >[]
  ).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    question_type: q.question_type,
    options: q.options,
    position: q.position,
    required: q.required,
  }))

  // 5. Insert the immutable version row (INSERT only — never update/delete).
  const { data: version, error: insertError } = await supabaseAdmin
    .from('template_versions')
    .insert({
      user_id: userId,
      template_id: id,
      version: nextVersion,
      name: template.name,
      department: template.department,
      questions: snapshot,
    })
    .select('id, version')
    .single()

  if (insertError || !version) {
    // 7. UNIQUE (template_id, version) violation → concurrent publish guard.
    if (insertError?.code === '23505') {
      return NextResponse.json({ error: 'Bu sürüm zaten yayınlanmış.' }, { status: 409 })
    }
    console.error('[templates publish insert]', {
      code: insertError?.code,
      message: insertError?.message,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 6. Bump current_version on the mutable header.
  const { error: bumpError } = await supabaseAdmin
    .from('form_templates')
    .update({ current_version: nextVersion, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (bumpError) {
    console.error('[templates publish bump]', {
      code: bumpError.code,
      message: bumpError.message,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 8. Done.
  return NextResponse.json(
    {
      version: nextVersion,
      template_version_id: version.id,
      question_count: snapshot.length,
    },
    { status: 201 },
  )
}
