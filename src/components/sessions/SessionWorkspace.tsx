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

  // MediaRecorder does not survive page loads (browser security model). Any server-side
  // 'recording' state means the recorder was destroyed — treat as 'idle' so the user
  // sees "Kaydı Başlat" and can start a fresh mic stream. Prior transcript segments are
  // durable; the server sequence counter picks up from where it left off.
  // 'paused' is preserved so resumed sessions show "Devam Et" immediately on mount.
  const clientInitialState: RecorderState =
    recorderState === 'recording' ? 'idle' : recorderState

  return (
    <RecordingPanel
      sessionId={sessionId}
      audioFormat={audioFormat}
      initialRecorderState={clientInitialState}
      onCompleted={() => router.push(`/patients/${patientId}`)}
    />
  )
}
