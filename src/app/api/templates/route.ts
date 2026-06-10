import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRole } from '@/lib/clerk/roles'
import { VALID_DEPARTMENTS } from '@/lib/templates/types'
import type { CreateTemplateBody, TemplateListItem } from '@/lib/templates/types'

// Admin-only template CRUD (T-04-05): every handler enforces superadmin.

// GET /api/templates — list non-archived templates for this admin
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('form_templates')
    .select('id, name, department, current_version, updated_at, template_questions(count)')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[templates GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const items: TemplateListItem[] = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    department: t.department,
    current_version: t.current_version,
    question_count: (t.template_questions as { count: number }[] | null)?.[0]?.count ?? 0,
    updated_at: t.updated_at,
  }))

  return NextResponse.json(items)
}

// POST /api/templates — create a draft template
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRole()) !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Partial<CreateTemplateBody>
  const name = (body.name ?? '').trim()
  const department = body.department

  if (!name) {
    return NextResponse.json({ error: 'Şablon adı zorunludur.' }, { status: 422 })
  }
  if (!department || !VALID_DEPARTMENTS.includes(department)) {
    return NextResponse.json({ error: 'Geçersiz bölüm.' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('form_templates')
    .insert({ user_id: userId, name, department })
    .select('id, name, department, current_version, updated_at')
    .single()

  if (error) {
    console.error('[templates POST]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const item: TemplateListItem = {
    id: data.id,
    name: data.name,
    department: data.department,
    current_version: data.current_version,
    question_count: 0,
    updated_at: data.updated_at,
  }

  return NextResponse.json(item, { status: 201 })
}
