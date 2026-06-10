import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRole } from '@/lib/clerk/roles'
import { VALID_DEPARTMENTS } from '@/lib/templates/types'
import type { Department } from '@/lib/templates/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/templates/[id] — template header + draft questions ordered by position
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params

  const { data: template, error } = await supabaseAdmin
    .from('form_templates')
    .select('id, user_id, name, department, is_archived, current_version, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[templates [id] GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!template) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  const { data: questions, error: qError } = await supabaseAdmin
    .from('template_questions')
    .select('id, user_id, template_id, prompt, question_type, options, position, required, created_at')
    .eq('template_id', id)
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (qError) {
    console.error('[templates [id] GET questions]', { code: qError.code, message: qError.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ...template, questions: questions ?? [] })
}

// PATCH /api/templates/[id] — update name/department
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as { name?: string; department?: Department }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) {
      return NextResponse.json({ error: 'Şablon adı zorunludur.' }, { status: 422 })
    }
    updates.name = name
  }
  if (body.department !== undefined) {
    if (!VALID_DEPARTMENTS.includes(body.department)) {
      return NextResponse.json({ error: 'Geçersiz bölüm.' }, { status: 422 })
    }
    updates.department = body.department
  }

  const { data, error } = await supabaseAdmin
    .from('form_templates')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, name, department, is_archived, current_version, created_at, updated_at')
    .maybeSingle()

  if (error) {
    console.error('[templates [id] PATCH]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// DELETE /api/templates/[id] — SOFT delete (archive).
// template_versions rows referenced by sessions must survive — never hard delete.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('form_templates')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[templates [id] DELETE]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Şablon bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, is_archived: true })
}
