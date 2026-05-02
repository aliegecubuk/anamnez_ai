import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { maskTc } from '@/lib/patients/types'
import type { PatientResponse, SessionSummary } from '@/lib/patients/types'

type RouteContext = { params: Promise<{ slug: string; id: string }> }

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

// GET /api/orgs/[slug]/patients/[id]
// Returns: PatientResponse (patient + sessions ordered started_at DESC)
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { slug, id } = await params
  const access = await verifyTenantAccess(slug)
  if (!access) {
    const { userId } = await auth()
    return NextResponse.json(
      { error: userId ? 'Forbidden' : 'Unauthorized' },
      { status: userId ? 403 : 401 }
    )
  }

  const supabase = await createSupabaseServerClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      id,
      full_name,
      tc_kimlik_no,
      created_at,
      sessions (
        id,
        form_type,
        status,
        started_at,
        completed_at
      )
    `)
    .eq('id', id)
    .eq('tenant_id', access.tenantId)   // application-layer tenant filter (defense-in-depth)
    .single()

  if (error || !patient) {
    return NextResponse.json({ error: 'Hasta bulunamadı.' }, { status: 404 })
  }

  // Sort sessions: most recent first
  const sessions: SessionSummary[] = ((patient.sessions as SessionSummary[] | null) ?? [])
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  const response: PatientResponse = {
    id: patient.id,
    full_name: patient.full_name,
    tc_kimlik_no_masked: maskTc(patient.tc_kimlik_no),
    created_at: patient.created_at,
    sessions,
  }

  return NextResponse.json(response)
}
