import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'
import type { AnamnesisAnswerDTO, MissingFieldAlert } from '@/lib/anamnesis/types'
import type { SnapshotQuestion } from '@/lib/templates/types'
import { buildMissingAlerts } from '@/lib/anamnesis/mapper'
import SessionWorkspace from '@/components/sessions/SessionWorkspace'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>
}

export default async function SessionPage({ params }: PageProps) {
  const { id: patientId, sessionId } = await params

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // All four lookups only need URL params — run them in one parallel batch instead
  // of five serial Frankfurt roundtrips (was the dominant TTFB cost on this page).
  const [
    { data: session, error: sessionErr },
    { data: patient },
    { data: transcriptRows },
    { data: answerRows },
  ] = await Promise.all([
    supabaseAdmin
      .from('sessions')
      .select('id, patient_id, form_type, status, started_at, completed_at, audio_format, recorder_state, template_version_id')
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
        template_version_id: string | null
      }>(),
    supabaseAdmin
      .from('patients')
      .select('id, full_name')
      .eq('id', patientId)
      .eq('user_id', userId)
      .single<{ id: string; full_name: string }>(),
    supabaseAdmin
      .from('transcript_segments')
      .select('sequence, content, started_at, ended_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('sequence', { ascending: true }),
    supabaseAdmin
      .from('anamnesis_answers')
      .select('question_id, prompt, question_type, answer_value, confidence, edited_by_human')
      .eq('session_id', sessionId)
      .eq('user_id', userId),
  ])

  if (sessionErr || !session || session.patient_id !== patientId) notFound()
  if (!patient) notFound()

  const transcript: TranscriptSegmentDTO[] = (transcriptRows ?? []) as TranscriptSegmentDTO[]

  // TPLT-05: if a template version is bound, load its frozen questions + any saved answers.
  let templateVersionQuestions: SnapshotQuestion[] | null = null
  let initialAnswers: AnamnesisAnswerDTO[] = []
  let initialMissing: MissingFieldAlert[] = []

  if (session.template_version_id) {
    const { data: version } = await supabaseAdmin
      .from('template_versions')
      .select('questions')
      .eq('id', session.template_version_id)
      .eq('user_id', userId)
      .single<{ questions: SnapshotQuestion[] }>()

    if (version?.questions) {
      templateVersionQuestions = version.questions
        .slice()
        .sort((a, b) => a.position - b.position)

      const byId = new Map(
        ((answerRows ?? []) as AnamnesisAnswerDTO[]).map((a) => [a.question_id, a]),
      )
      initialAnswers = templateVersionQuestions
        .map((q) => byId.get(q.id))
        .filter((a): a is AnamnesisAnswerDTO => a !== undefined)

      initialMissing = buildMissingAlerts(
        initialAnswers.map((a) => ({
          question_id: a.question_id,
          answer_value: a.answer_value,
          confidence: a.confidence ?? 0,
        })),
        templateVersionQuestions,
      )
    }
  }

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
        patientName={patient.full_name}
        formType={session.form_type}
        audioFormat={session.audio_format}
        recorderState={session.recorder_state}
        sessionStatus={session.status}
        sessionStartedAt={session.started_at}
        initialTranscript={transcript}
        templateVersionQuestions={templateVersionQuestions}
        initialAnswers={initialAnswers}
        initialMissing={initialMissing}
      />
    </main>
  )
}
