'use client'

import { useEffect, type ReactNode } from 'react'
import { Mic, Pause, Play, Square, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import MicPermissionGate from '@/components/sessions/MicPermissionGate'
import MicSelector from '@/components/app/MicSelector'
import { useChunkedRecorder } from '@/hooks/useChunkedRecorder'
import { useMicDevice } from '@/hooks/useMicDevice'
import type { AudioFormat, RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'

interface Props {
  audioFormat: AudioFormat
  onSegment: (segment: TranscriptSegmentDTO) => void
  onStateChange?: (state: RecorderState) => void
  /** Extra action next to the record controls (e.g. "Yeni Kayıt Başlat"). */
  trailing?: ReactNode
}

/**
 * Mic controls for the stateless hospital flow: chunks stream to
 * /api/hospital/transcribe, segments come back in the POST response (no SSE,
 * no session row). The parent owns the segment list and wipes it on reset.
 */
export default function HospitalRecordingPanel({ audioFormat, onSegment, onStateChange, trailing }: Props) {
  const [micDeviceId, setMicDeviceId] = useMicDevice()
  const recorder = useChunkedRecorder({
    chunkUrl: `/api/hospital/transcribe?format=${encodeURIComponent(audioFormat)}`,
    audioFormat,
    deviceId: micDeviceId,
    onError: (err) => toast.error(err.message),
    onSegment,
  })

  // Sync from the hook's state, not from button intent — the hook can change
  // state on its own (auto-pause after repeated upload failures).
  const { state } = recorder
  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  function wrap(action: () => Promise<void>) {
    return async () => {
      try {
        await action()
      } catch {
        /* toast already fired via onError */
      }
    }
  }

  return (
    <MicPermissionGate>
      <div className="space-y-4">
        {recorder.retryRequired && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold">Yükleme başarısız oldu</p>
              <p className="text-sm text-muted-foreground">
                Üst üste 3 ses parçası yüklenemedi. Bağlantınızı kontrol edin ve
                &quot;Devam Et&quot;e basarak tekrar deneyin.
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

        <div className="flex items-center gap-3">
          {recorder.state === 'idle' && (
            <Button size="lg" className="gap-2" onClick={wrap(recorder.start)}>
              <Mic className="h-4 w-4" />
              Kaydı Başlat
            </Button>
          )}

          {recorder.state === 'recording' && (
            <>
              <Button variant="secondary" className="gap-2" onClick={wrap(recorder.pause)}>
                <Pause className="h-4 w-4" /> Duraklat
              </Button>
              <Button variant="destructive" className="gap-2" onClick={wrap(recorder.stop)}>
                <Square className="h-4 w-4" /> Durdur
              </Button>
            </>
          )}

          {recorder.state === 'paused' && (
            <>
              <Button className="gap-2" onClick={wrap(recorder.resume)}>
                <Play className="h-4 w-4" /> Devam Et
              </Button>
              <Button variant="destructive" className="gap-2" onClick={wrap(recorder.stop)}>
                <Square className="h-4 w-4" /> Durdur
              </Button>
            </>
          )}

          {recorder.state === 'stopped' && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sonlandırılıyor — bekleyen parçalar yükleniyor...
            </div>
          )}

          {recorder.state === 'completed' && (
            <>
              <span className="text-sm text-muted-foreground">Kayıt tamamlandı.</span>
              {/* start() fully resets the hook — lets the doctor append more speech. */}
              <Button variant="secondary" size="sm" className="gap-2" onClick={wrap(recorder.start)}>
                <Mic className="h-3.5 w-3.5" /> Kayda Devam Et
              </Button>
            </>
          )}

          {recorder.pendingUploads > 0 && recorder.state === 'recording' && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {recorder.pendingUploads} parça yükleniyor
            </span>
          )}

          {trailing}
        </div>
      </div>
    </MicPermissionGate>
  )
}
