'use client'

import { useCallback, useMemo, useState } from 'react'
import { FileDown, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import IdentityPanel from './IdentityPanel'
import HospitalRecordingPanel from './HospitalRecordingPanel'
import QaCards from './QaCards'
import MedulaBox from './MedulaBox'
import { buildMedulaText } from '@/lib/hospital/medula'
import { maskIdentity } from '@/lib/hospital/masking'
import {
  EMPTY_IDENTITY,
  HOSPITAL_MODE_LABELS,
  type HospitalEntry,
  type HospitalExtractResult,
  type HospitalIdentity,
  type HospitalMode,
} from '@/lib/hospital/types'
import { pickSupportedMimeType } from '@/lib/sessions/codec'
import type { RecorderState, TranscriptSegmentDTO } from '@/lib/sessions/types'

// Segments carry their own key: the recorder's sequence resets to 0 when a new
// recording starts after a stop, so sequence alone cannot be the identity.
interface SpeechSegment {
  key: string
  content: string
}

export default function HospitalWorkspace() {
  const [identity, setIdentity] = useState<HospitalIdentity>(EMPTY_IDENTITY)
  const [mode, setMode] = useState<HospitalMode>('hizli')
  const [segments, setSegments] = useState<SpeechSegment[]>([])
  const [entries, setEntries] = useState<HospitalEntry[] | null>(null)
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [processing, setProcessing] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [workspaceKey, setWorkspaceKey] = useState(0) // bump to hard-remount the recorder on reset

  const audioFormat = useMemo(() => {
    try {
      return pickSupportedMimeType()
    } catch {
      return null
    }
  }, [])

  const rawTranscript = useMemo(
    () => segments.map((s) => s.content).join(' ').replace(/\s+/g, ' ').trim(),
    [segments],
  )

  // Identity may be typed before, during, or after recording — masking is
  // derived, so it always reflects the latest identity fields.
  const maskedTranscript = useMemo(
    () => maskIdentity(rawTranscript, identity),
    [rawTranscript, identity],
  )

  const medulaText = useMemo(
    () => buildMedulaText((entries ?? []).map((e) => e.answer)),
    [entries],
  )

  const handleSegment = useCallback((seg: TranscriptSegmentDTO) => {
    if (!seg.content.trim()) return
    setSegments((prev) => [...prev, { key: crypto.randomUUID(), content: seg.content }])
  }, [])

  async function handleProcess() {
    if (!maskedTranscript || processing) return
    setProcessing(true)
    try {
      const res = await fetch('/api/hospital/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: maskedTranscript, mode }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? `Anamnez çıkarılamadı (${res.status})`)
        return
      }
      const result = (await res.json()) as HospitalExtractResult
      setEntries(result.entries.map((e) => ({ id: crypto.randomUUID(), ...e })))
      if (result.entries.length === 0) {
        toast.warning('Konuşmada anamneze girecek bilgi bulunamadı.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Beklenmeyen hata.')
    } finally {
      setProcessing(false)
    }
  }

  function handleEntryChange(id: string, field: 'question' | 'answer', value: string) {
    setEntries((prev) => prev?.map((e) => (e.id === id ? { ...e, [field]: value } : e)) ?? prev)
  }

  function handleEntryDelete(id: string) {
    setEntries((prev) => prev?.filter((e) => e.id !== id) ?? prev)
  }

  function handleEntryAdd() {
    setEntries((prev) => [...(prev ?? []), { id: crypto.randomUUID(), question: '', answer: '' }])
  }

  const resetAll = useCallback(() => {
    setIdentity(EMPTY_IDENTITY)
    setSegments([])
    setEntries(null)
    setRecorderState('idle')
    setConfirmingReset(false)
    setWorkspaceKey((k) => k + 1)
  }, [])

  async function handlePdf() {
    if (!medulaText) return
    try {
      const { downloadHospitalPdf } = await import('@/lib/pdf/hospital-pdf')
      await downloadHospitalPdf({
        fullName: `${identity.firstName} ${identity.lastName}`.trim(),
        tcNo: identity.tcNo.trim(),
        phone: identity.phone.trim(),
        dateStr: new Date().toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        modeLabel: HOSPITAL_MODE_LABELS[mode],
        clinicalText: medulaText,
      })
      // Requirement: PDF closes the encounter — identity + transcript + output
      // are wiped so the next patient starts from a clean slate.
      resetAll()
      toast.success('PDF indirildi — modül yeni hasta için sıfırlandı.')
    } catch {
      toast.error('PDF oluşturulamadı.')
    }
  }

  function handleManualReset() {
    // Two-step inline confirm — no blocking native dialog.
    if ((segments.length > 0 || entries !== null) && !confirmingReset) {
      setConfirmingReset(true)
      return
    }
    resetAll()
    toast.success('Modül sıfırlandı.')
  }

  if (!audioFormat) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Bu tarayıcıda ses kaydı desteklenmiyor. Lütfen güncel Chrome veya Safari kullanın.
      </div>
    )
  }

  const busyRecording = recorderState === 'recording' || recorderState === 'paused'

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" key={workspaceKey}>
      {/* Left: identity + mode + mic + live transcript */}
      <div className="space-y-6">
        <IdentityPanel identity={identity} onChange={setIdentity} />

        {/* Mode toggle */}
        <section className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Anamnez Modu</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(HOSPITAL_MODE_LABELS) as HospitalMode[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md border px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  mode === m
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {HOSPITAL_MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Hızlı: acil için en kritik başlıklar. Detaylı: poliklinik için kapsamlı anamnez.
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Kayıt</h2>
          <HospitalRecordingPanel
            audioFormat={audioFormat}
            onSegment={handleSegment}
            onStateChange={setRecorderState}
          />
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Konuşma Metni</h2>
          <div
            aria-live="polite"
            className="max-h-72 min-h-16 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground"
          >
            {maskedTranscript || (
              <span className="italic text-muted-foreground">
                Kayıt başlayınca konuşma burada belirir. Kimlik bilgileri otomatik maskelenir.
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Right: process → Q&A cards → Medula box → PDF */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="gap-2"
            onClick={handleProcess}
            disabled={!maskedTranscript || processing || busyRecording}
            title={busyRecording ? 'Önce kaydı durdurun' : undefined}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> İşleniyor...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {entries ? 'Yeniden İşle' : 'İşle'}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={handlePdf}
            disabled={!medulaText}
          >
            <FileDown className="h-4 w-4" /> PDF İndir
          </Button>
          {confirmingReset ? (
            <span className="ml-auto inline-flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tüm veriler silinsin mi?</span>
              <Button variant="destructive" size="sm" onClick={handleManualReset}>
                Evet, sıfırla
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(false)}>
                Vazgeç
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="lg"
              className="ml-auto gap-2 text-muted-foreground"
              onClick={handleManualReset}
            >
              <RotateCcw className="h-4 w-4" /> Sıfırla
            </Button>
          )}
        </div>

        {entries === null ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Hastayı dinleyin, kaydı durdurun ve <strong>İşle</strong>&apos;ye basın — konuşmada
            açıkça geçen soru-cevaplar burada kart olarak belirir. Konuşulmayan başlık eklenmez.
          </div>
        ) : (
          <QaCards
            entries={entries}
            onChange={handleEntryChange}
            onDelete={handleEntryDelete}
            onAdd={handleEntryAdd}
          />
        )}

        <MedulaBox text={medulaText} />

        <p className="text-xs leading-relaxed text-muted-foreground">
          PDF indirildiğinde modül tamamen sıfırlanır: kimlik, konuşma ve çıktı silinir.
        </p>
      </div>
    </div>
  )
}
