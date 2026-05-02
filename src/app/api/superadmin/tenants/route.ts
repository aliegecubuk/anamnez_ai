import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/clerk/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  try {
    await requireSuperadmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenants: data })
}

export async function POST(req: Request) {
  try {
    await requireSuperadmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const body = await req.json()
  const { clerk_org_id, slug, name } = body
  if (!clerk_org_id || !slug || !name) {
    return NextResponse.json({ error: 'clerk_org_id, slug, name zorunlu' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .insert({ clerk_org_id, slug, name })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenant: data }, { status: 201 })
}
