import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { maskTc } from '@/lib/patients/types'
import PatientProfileHeader from '@/components/patients/PatientProfileHeader'
import SessionHistoryTable from '@/components/patients/SessionHistoryTable'
import { Separator } from '@/components/ui/separator'
import type { SessionSummary } from '@/lib/patients/types'

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params

  // Verify caller's active org matches the URL slug
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/sign-in')

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, clerk_org_id')
    .eq('slug', slug)
    .single()

  if (!tenant || tenant.clerk_org_id !== orgId) notFound()

  // Direct DB query — no HTTP self-fetch, no raw cookie forwarding
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
    .eq('tenant_id', tenant.id)
    .single()

  if (error || !patient) notFound()

  // Sort sessions: most recent first
  const sessions: SessionSummary[] = ((patient.sessions as SessionSummary[] | null) ?? [])
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  const sessionCount = sessions.length

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb: "Hastalar" › patient name */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/orgs/${slug}/patients`} className="hover:text-foreground transition-colors">
          Hastalar
        </Link>
        <span>›</span>
        <span className="text-foreground font-medium truncate max-w-[30ch]">
          {patient.full_name}
        </span>
      </nav>

      {/* Patient header card */}
      <PatientProfileHeader
        fullName={patient.full_name}
        tcMasked={maskTc(patient.tc_kimlik_no)}
        slug={slug}
        patientId={patient.id}
      />

      <Separator />

      {/* Session history section heading */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Seans Geçmişi</h2>
        <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2.5 py-0.5 rounded-full">
          {sessionCount} seans
        </span>
      </div>

      {/* Session history table */}
      <SessionHistoryTable sessions={sessions} slug={slug} />
    </div>
  )
}
