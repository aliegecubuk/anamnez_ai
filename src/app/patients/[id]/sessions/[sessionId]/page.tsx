import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'
import SessionWorkspace from '@/components/sessions/SessionWorkspace'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>
}

export default async function SessionPage({ params }: PageProps) {
  const { id: patientId, sessionId } = await params

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Server-side fetch session row (ownership-checked) and transcript backlog.
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, patient_id, form_type, status, started_at, completed_at, audio_format, recorder_state')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{
      id: string
      patient_id: string
      form_type: string
      status: 'draft' | 'completed'
      started_at: string
      completed_at: string | null
      audio_format: AudioFormat | null
      recorder_state: RecorderState
    }>()

  if (sessionErr || !session || session.patient_id !== patientId) notFound()

  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id, full_name')
    .eq('id', patientId)
    .eq('user_id', userId)
    .single<{ id: string; full_name: string }>()

  if (!patient) notFound()

  const { data: transcriptRows } = await supabaseAdmin
    .from('transcript_segments')
    .select('sequence, content, started_at, ended_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('sequence', { ascending: true })

  const transcript: TranscriptSegmentDTO[] = (transcriptRows ?? []) as TranscriptSegmentDTO[]

  // KVKK: do NOT put patient.full_name into <title> — Next.js falls back to root layout title.

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-2">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <span aria-hidden>·</span>
        <Link href="/patients" className="hover:text-foreground transition-colors">Hastalar</Link>
        <span aria-hidden>·</span>
        <Link href={`/patients/${patient.id}`} className="hover:text-foreground transition-colors">
          {patient.full_name}
        </Link>
        <span aria-hidden>·</span>
        <span className="text-foreground">Seans</span>
      </p>

      <header className="space-y-2 pb-6 border-b border-border">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Seans</p>
        <h1 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-tight text-foreground">
          {patient.full_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date(session.started_at).toLocaleString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
          <span aria-hidden className="mx-2">·</span>
          {session.form_type}
          <span aria-hidden className="mx-2">·</span>
          {session.status === 'completed' ? 'Tamamlandı' : 'Taslak'}
        </p>
      </header>

      <SessionWorkspace
        sessionId={session.id}
        patientId={patient.id}
        audioFormat={session.audio_format}
        recorderState={session.recorder_state}
        sessionStatus={session.status}
        initialTranscript={transcript}
      />
    </main>
  )
}
