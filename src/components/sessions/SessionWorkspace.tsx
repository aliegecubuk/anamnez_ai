'use client'

import { useRouter } from 'next/navigation'
import RecordingPanel from './RecordingPanel'
import LiveTranscript from './LiveTranscript'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'

interface Props {
  sessionId: string
  patientId: string
  audioFormat: AudioFormat | null
  recorderState: RecorderState
  sessionStatus: 'draft' | 'completed'
  initialTranscript: TranscriptSegmentDTO[]
}

export default function SessionWorkspace({
  sessionId,
  patientId,
  audioFormat,
  recorderState,
  sessionStatus,
  initialTranscript,
}: Props) {
  const router = useRouter()

  // Completed session OR session that finished recording — show static replay only.
  if (sessionStatus === 'completed' || recorderState === 'completed') {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Transkript</h2>
        <LiveTranscript segments={initialTranscript} connected={false} />
      </section>
    )
  }

  // Draft session that was never finished AND has no audio_format — broken row, do not render recorder.
  if (!audioFormat) {
    return (
      <p className="text-sm text-destructive">
        Bu seans geçerli bir ses formatı olmadan oluşturulmuş. Yeni bir seans başlatın.
      </p>
    )
  }

  // Live or resumable session. Pass server-side recorder_state into RecordingPanel
  // (which forwards it into useChunkedRecorder as initialRecorderState) so the
  // client mirrors server truth on mount instead of falsely starting in 'idle'.
  //
  // Reload limitation: the browser destroys MediaRecorder on page reload (security model).
  // Prior transcript segments are durable; user clicks "Kaydı Başlat" to open a fresh
  // mic stream — the server sequence counter picks up from where it left off.
  return (
    <RecordingPanel
      sessionId={sessionId}
      audioFormat={audioFormat}
      initialRecorderState={recorderState}
      onCompleted={() => router.push(`/patients/${patientId}`)}
    />
  )
}
