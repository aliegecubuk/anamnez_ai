import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { maskTc } from '@/lib/patients/types'
import type { PatientListItem } from '@/lib/patients/types'

type RouteContext = { params: Promise<{ slug: string }> }

// Helper: verify the caller's active org matches the URL slug
// Returns { tenantId, orgId } if valid, null otherwise
async function verifyTenantAccess(slug: string): Promise<{ tenantId: string; orgId: string } | null> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return null

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, clerk_org_id')
    .eq('slug', slug)
    .single()

  if (!tenant || tenant.clerk_org_id !== orgId) return null
  return { tenantId: tenant.id, orgId }
}

// GET /api/orgs/[slug]/patients?q=
// Returns: PatientListItem[] sorted by full_name ASC
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const access = await verifyTenantAccess(slug)
  if (!access) {
    const { userId } = await auth()
    return NextResponse.json(
      { error: userId ? 'Forbidden' : 'Unauthorized' },
      { status: userId ? 403 : 401 }
    )
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const supabase = await createSupabaseServerClient()

  // Base query: patients for this tenant with their most recent session date
  let query = supabase
    .from('patients')
    .select(`
      id,
      full_name,
      tc_kimlik_no,
      sessions ( started_at )
    `)
    .eq('tenant_id', access.tenantId)   // application-layer tenant filter (defense-in-depth)
    .order('full_name', { ascending: true })

  if (q) {
    // Numeric-only input → TC prefix search; otherwise → name ILIKE search
    if (/^[0-9]+$/.test(q)) {
      query = query.ilike('tc_kimlik_no', `${q}%`)
    } else {
      query = query.ilike('full_name', `%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) {
    console.error('[patients GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Shape response: mask TC, compute last_session_at
  const items: PatientListItem[] = (data ?? []).map((p) => {
    const sessionDates = (p.sessions as { started_at: string }[] | null) ?? []
    const last = sessionDates
      .map((s) => s.started_at)
      .sort()
      .at(-1) ?? null

    return {
      id: p.id,
      full_name: p.full_name,
      tc_kimlik_no_masked: maskTc(p.tc_kimlik_no),
      last_session_at: last,
    }
  })

  return NextResponse.json(items)
}

// POST /api/orgs/[slug]/patients
// Body: { full_name: string, tc_kimlik_no: string }
// Returns 201 PatientListItem on success
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params
  const access = await verifyTenantAccess(slug)
  if (!access) {
    const { userId } = await auth()
    return NextResponse.json(
      { error: userId ? 'Forbidden' : 'Unauthorized' },
      { status: userId ? 403 : 401 }
    )
  }

  const { userId } = await auth()
  const body = await req.json().catch(() => ({}))
  const full_name = (body.full_name ?? '').trim()
  const tc_kimlik_no = (body.tc_kimlik_no ?? '').trim()

  // Validation
  if (!full_name) {
    return NextResponse.json({ error: 'Ad soyad zorunludur.' }, { status: 422 })
  }
  if (!tc_kimlik_no) {
    return NextResponse.json({ error: 'TC kimlik numarası zorunludur.' }, { status: 422 })
  }
  if (!/^[0-9]{11}$/.test(tc_kimlik_no)) {
    return NextResponse.json(
      { error: /[^0-9]/.test(tc_kimlik_no)
          ? 'TC kimlik numarası yalnızca rakam içermelidir.'
          : 'TC kimlik numarası tam 11 haneli olmalıdır.' },
      { status: 422 }
    )
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('patients')
    .insert({
      tenant_id: access.tenantId,
      full_name,
      tc_kimlik_no,
      created_by: userId!,
    })
    .select('id, full_name, tc_kimlik_no, created_at')
    .single()

  if (error) {
    // Unique constraint violation: (tenant_id, tc_kimlik_no)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var.' },
        { status: 409 }
      )
    }
    console.error('[patients POST]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const item: PatientListItem = {
    id: data.id,
    full_name: data.full_name,
    tc_kimlik_no_masked: maskTc(data.tc_kimlik_no),
    last_session_at: null,
  }

  return NextResponse.json(item, { status: 201 })
}
