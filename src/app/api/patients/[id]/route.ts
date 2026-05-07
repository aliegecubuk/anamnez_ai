import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { maskTc } from '@/lib/patients/types'
import type { PatientResponse, SessionSummary } from '@/lib/patients/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/patients/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: patient, error } = await supabaseAdmin
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
    .eq('user_id', userId)
    .single()

  if (error || !patient) {
    return NextResponse.json({ error: 'Hasta bulunamadı.' }, { status: 404 })
  }

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
