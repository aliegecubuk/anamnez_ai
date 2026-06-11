import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { maskTc } from '@/lib/patients/types'
import SessionHistoryTable from '@/components/patients/SessionHistoryTable'
import StartSessionButton from '@/components/patients/StartSessionButton'
import type { SessionSummary } from '@/lib/patients/types'

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

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

  if (error || !patient) notFound()

  const sessions: SessionSummary[] = ((patient.sessions as SessionSummary[] | null) ?? [])
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  const sessionCount = sessions.length
  const initials = patient.full_name
    .trim()
    .split(/\s+/)
    .map((p: string) => p[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-2">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <span aria-hidden>·</span>
        <Link href="/patients" className="hover:text-foreground transition-colors">Hastalar</Link>
        <span aria-hidden>·</span>
        <span className="text-foreground">{patient.full_name}</span>
      </p>

      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end pb-10 border-b border-border">
        <div className="flex items-end gap-6">
          <span
            aria-hidden
            className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-primary text-[22px] font-semibold text-primary-foreground"
          >
            {initials}
          </span>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Hasta dosyası</p>
            <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] leading-[1.02] tracking-tight text-foreground">
              {patient.full_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              TC: <span className="font-mono text-foreground">{maskTc(patient.tc_kimlik_no)}</span>
              <span aria-hidden className="mx-2">·</span>
              {sessionCount} seans kaydı
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 self-start lg:self-end">
          <StartSessionButton patientId={patient.id} formType="genel" title="Anamnez" />
          <StartSessionButton
            patientId={patient.id}
            formType="perio"
            title="Periodontal Chart"
            className="h-11 gap-2 self-start lg:self-end"
          />
          <StartSessionButton
            patientId={patient.id}
            formType="patoloji"
            title="Patoloji Chart"
            className="h-11 gap-2 self-start lg:self-end"
          />
        </div>
      </header>

      <section className="space-y-5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[26px] leading-tight tracking-tight text-foreground">
            Seans geçmişi
          </h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {sessionCount} kayıt
          </span>
        </div>
        <SessionHistoryTable sessions={sessions} patientId={patient.id} />
      </section>
    </main>
  )
}
