import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import PatientProfileHeader from '@/components/patients/PatientProfileHeader'
import SessionHistoryTable from '@/components/patients/SessionHistoryTable'
import { Separator } from '@/components/ui/separator'
import type { PatientResponse } from '@/lib/patients/types'

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params

  // Fetch patient data server-side (auth cookie forwarded automatically in same-origin fetch)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

  const res = await fetch(`${baseUrl}/api/orgs/${slug}/patients/${id}`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  })

  if (res.status === 404) notFound()
  if (!res.ok) notFound()

  const patient: PatientResponse = await res.json()

  // Session count for badge
  const sessionCount = patient.sessions.length

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
        tcMasked={patient.tc_kimlik_no_masked}
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
      <SessionHistoryTable sessions={patient.sessions} slug={slug} />
    </div>
  )
}
