'use client'

// Single-screen session workspace (competitor-parity layout):
// mic controls + editable "Konuşma Girişi" sentence list + the form/chart are all
// live at the same time — no "complete the session first" gate. The hekim records,
// fixes sentences, hits "İşle ve Düzenle", edits values, exports PDF, in one place.

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordingPanel from './RecordingPanel'
import SpeechInputPanel from './SpeechInputPanel'
import AnamnesisForm from './AnamnesisForm'
import StructuredAnamnesis from './StructuredAnamnesis'
import PerioGrid from './PerioGrid'
import PathologyChart from './PathologyChart'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'
import type { AnamnesisAnswerDTO, MissingFieldAlert } from '@/lib/anamnesis/types'
import type { SnapshotQuestion } from '@/lib/templates/types'

interface Props {
  sessionId: string
  patientId: string
  patientName: string
  formType: string
  audioFormat: AudioFormat | null
  recorderState: RecorderState
  sessionStatus: 'draft' | 'completed'
  sessionStartedAt: string
  initialTranscript: TranscriptSegmentDTO[]
  templateVersionQuestions: SnapshotQuestion[] | null
  initialAnswers: AnamnesisAnswerDTO[]
  initialMissing: MissingFieldAlert[]
}

export default function SessionWorkspace({
  sessionId,
  patientId,
  patientName,
  formType,
  audioFormat,
  recorderState,
  sessionStatus,
  sessionStartedAt,
  initialTranscript,
  templateVersionQuestions,
  initialAnswers,
  initialMissing,
}: Props) {
  const router = useRouter()
  const [liveSegments, setLiveSegments] = useState<TranscriptSegmentDTO[]>([])
  const [liveConnected, setLiveConnected] = useState<boolean | undefined>(undefined)

  const handleSegmentsChange = useCallback(
    (segments: TranscriptSegmentDTO[], connected: boolean) => {
      setLiveSegments(segments)
      setLiveConnected(connected)
    },
    [],
  )

  const recorderActive =
    sessionStatus !== 'completed' && recorderState !== 'completed' && !!audioFormat

  // MediaRecorder does not survive page loads (browser security model). Any server-side
  // 'recording' state means the recorder was destroyed — treat as 'idle' so the user
  // sees "Kaydı Başlat" and can start a fresh mic stream. Prior transcript segments are
  // durable; the server sequence counter picks up from where it left off.
  const clientInitialState: RecorderState =
    recorderState === 'recording' ? 'idle' : recorderState

  return (
    <div className="space-y-8">
      {recorderActive && (
        <RecordingPanel
          sessionId={sessionId}
          audioFormat={audioFormat!}
          initialRecorderState={clientInitialState}
          onSegmentsChange={handleSegmentsChange}
          onCompleted={() => router.refresh()}
        />
      )}

      <SpeechInputPanel
        sessionId={sessionId}
        initialSegments={initialTranscript}
        liveSegments={liveSegments}
        connected={recorderActive ? liveConnected : undefined}
      />

      {formType === 'perio' && (
        <PerioGrid
          sessionId={sessionId}
          patientId={patientId}
          patientName={patientName}
          sessionStartedAt={sessionStartedAt}
        />
      )}
      {formType === 'patoloji' && (
        <PathologyChart sessionId={sessionId} />
      )}
      {formType !== 'perio' && formType !== 'patoloji' && (
        <StructuredAnamnesis
          sessionId={sessionId}
          patientName={patientName}
          sessionStartedAt={sessionStartedAt}
        />
      )}
      {formType !== 'perio' && formType !== 'patoloji' && templateVersionQuestions && templateVersionQuestions.length > 0 && (
        <AnamnesisForm
          sessionId={sessionId}
          patientId={patientId}
          questions={templateVersionQuestions}
          initialAnswers={initialAnswers}
          initialMissing={initialMissing}
        />
      )}
    </div>
  )
}
