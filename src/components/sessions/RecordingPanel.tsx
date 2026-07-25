'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mic, Pause, Play, Square, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import MicPermissionGate from './MicPermissionGate'
import MicSelector from '@/components/app/MicSelector'
import { useChunkedRecorder } from '@/hooks/useChunkedRecorder'
import { useMicDevice } from '@/hooks/useMicDevice'
import { useTranscriptStream } from '@/hooks/useTranscriptStream'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'

interface Props {
  sessionId: string
  audioFormat: AudioFormat
  initialRecorderState?: RecorderState   // W-5: forwarded into useChunkedRecorder
  onCompleted?: () => void
  // Live transcript segments (chunk responses + SSE, deduped) — the parent renders
  // them in SpeechInputPanel; this component is mic controls only.
  onSegmentsChange?: (segments: TranscriptSegmentDTO[], connected: boolean) => void
}

/**
 * Top-level recording UI. Composes:
 * - MicPermissionGate (renders nothing until granted)
 * - useChunkedRecorder (owns MediaRecorder lifecycle; honors initialRecorderState)
 * - useTranscriptStream (subscribes to SSE)
 * - LiveTranscript (renders segments)
 *
 * Lifecycle:
 *   mount → MicPermissionGate prompt → user grants → "Kaydı Başlat" button (or "Devam Et"
 *   if initialRecorderState='paused') → useChunkedRecorder.start() → recording → user
 *   pause/resume → user stop → useChunkedRecorder.stop() awaits uploads + transitions
 *   completed → onCompleted() fires.
 */
export default function RecordingPanel({
  sessionId,
  audioFormat,
  initialRecorderState = 'idle',
  onCompleted,
  onSegmentsChange,
}: Props) {
  const [, setAutoStart] = useState(false)

  // Segments returned directly by the chunk POST — rendered the instant the upload
  // finishes. The SSE stream stays on as replay/backup (page reloads, other viewers);
  // both sources are merged and deduped by sequence below.
  const [localSegments, setLocalSegments] = useState<TranscriptSegmentDTO[]>([])
  const handleSegment = useCallback((seg: TranscriptSegmentDTO) => {
    setLocalSegments((prev) =>
      prev.some((p) => p.sequence === seg.sequence) ? prev : [...prev, seg],
    )
  }, [])

  const [micDeviceId, setMicDeviceId] = useMicDevice()
  const recorder = useChunkedRecorder({
    sessionId,
    audioFormat,
    deviceId: micDeviceId,
    initialRecorderState,
    onError: (err) => toast.error(err.message),
    onSegment: handleSegment,
  })
  const stream = useTranscriptStream({ sessionId, enabled: recorder.state !== 'completed' })

  const segments = useMemo(() => {
    const bySequence = new Map<number, TranscriptSegmentDTO>()
    for (const s of stream.segments) bySequence.set(s.sequence, s)
    for (const s of localSegments) bySequence.set(s.sequence, s)
    return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence)
  }, [stream.segments, localSegments])

  useEffect(() => {
    onSegmentsChange?.(segments, stream.connected)
  }, [segments, stream.connected, onSegmentsChange])

  useEffect(() => {
    if (recorder.state === 'completed') onCompleted?.()
  }, [recorder.state, onCompleted])

  // Warn the user if they try to close the tab while uploads are pending.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (recorder.pendingUploads > 0 || recorder.state === 'recording' || recorder.state === 'paused') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [recorder.pendingUploads, recorder.state])

  return (
    <MicPermissionGate onGranted={() => setAutoStart(true)}>
      <div className="space-y-6">
        {/* W-8: retry banner — appears after 3 consecutive failures */}
        {recorder.retryRequired && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-semibold">Yükleme başarısız oldu</p>
              <p className="text-sm text-muted-foreground">
                Üst üste 3 ses parçası yüklenemedi. Bağlantınızı kontrol edin ve &quot;Devam Et&quot;e basarak tekrar deneyin.
              </p>
            </div>
          </div>
        )}

        {/* Mic picker: selectable before/after a recording; locked while one is live. */}
        <MicSelector
          value={micDeviceId}
          onChange={setMicDeviceId}
          disabled={recorder.state === 'recording' || recorder.state === 'paused' || recorder.state === 'stopped'}
        />

        {/* Controls */}
        <div className="flex items-center gap-3">
          {recorder.state === 'idle' && (
            <Button
              size="lg"
              className="gap-2"
              onClick={async () => {
                try { await recorder.start() } catch { /* toast already fired via onError */ }
              }}
            >
              <Mic className="h-4 w-4" />
              Kaydı Başlat
            </Button>
          )}

          {recorder.state === 'recording' && (
            <>
              <Button variant="secondary" className="gap-2" onClick={recorder.pause}>
                <Pause className="h-4 w-4" /> Duraklat
              </Button>
              <Button variant="destructive" className="gap-2" onClick={recorder.stop}>
                <Square className="h-4 w-4" /> Durdur
              </Button>
            </>
          )}

          {recorder.state === 'paused' && (
            <>
              {/* When resuming a session that was loaded from server-side 'paused' state,
                  the MediaRecorder may not exist yet — start() will create it. Otherwise
                  resume() unpauses the existing recorder. We detect via recorder presence
                  by attempting resume first; if no recorder exists the hook no-ops and
                  we fall through to start. Simpler: always call start() if recorder is
                  null, else resume(). The hook handles both internally — see Task 2. */}
              <Button className="gap-2" onClick={async () => {
                try { await recorder.resume() } catch { /* toast already fired */ }
              }}>
                <Play className="h-4 w-4" /> Devam Et
              </Button>
              <Button variant="destructive" className="gap-2" onClick={recorder.stop}>
                <Square className="h-4 w-4" /> Durdur
              </Button>
            </>
          )}

          {(recorder.state === 'stopped' || recorder.state === 'completed') && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              {recorder.state === 'stopped' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sonlandırılıyor — bekleyen parçalar yükleniyor...
                </>
              ) : (
                'Kayıt tamamlandı.'
              )}
            </div>
          )}

          {recorder.pendingUploads > 0 && recorder.state === 'recording' && (
            <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {recorder.pendingUploads} parça yükleniyor
            </span>
          )}

          {recorder.droppedChunks > 0 && (
            <span className="ml-auto text-xs text-amber-600">
              {recorder.droppedChunks} parça atlandı (kuyruk dolu)
            </span>
          )}
        </div>

        {/* autoStart: convenience — immediately invokes start once permission granted, if user opted in.
            Currently we don't auto-start; user clicks "Kaydı Başlat". autoStart state reserved for
            Plan 03-04 future "auto-start on session create" UX. */}
      </div>
    </MicPermissionGate>
  )
}
