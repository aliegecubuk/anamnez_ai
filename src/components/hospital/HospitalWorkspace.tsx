'use client'

import { useCallback, useMemo, useState } from 'react'
import { FileDown, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import IdentityPanel from './IdentityPanel'
import HospitalRecordingPanel from './HospitalRecordingPanel'
import QaCards from './QaCards'
import MedulaBox from './MedulaBox'
import InsightCard, { type InsightState } from './InsightCard'
import { buildMedulaText } from '@/lib/hospital/medula'
import { maskIdentity } from '@/lib/hospital/masking'
import { missingCriticalTopics, type CriticalTopic } from '@/lib/hospital/checklist'
import {
  COMPLAINT_CHIPS,
  EMPTY_IDENTITY,
  HOSPITAL_MODE_LABELS,
  type HospitalEntry,
  type HospitalExtractEntry,
  type HospitalExtractResult,
  type HospitalIdentity,
  type HospitalInsightBody,
  type HospitalInsightResult,
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

// The two Q&A groups rendered as separate QaCards instances.
type EntryGroup = 'anamnez' | 'exam'

export default function HospitalWorkspace() {
  const [identity, setIdentity] = useState<HospitalIdentity>(EMPTY_IDENTITY)
  const [mode, setMode] = useState<HospitalMode>('hizli')
  const [segments, setSegments] = useState<SpeechSegment[]>([])
  const [entries, setEntries] = useState<HospitalEntry[] | null>(null)
  const [examEntries, setExamEntries] = useState<HospitalEntry[] | null>(null)
  // Extract entries dropped by the grounding gate — shown muted, never in output.
  const [dropped, setDropped] = useState<HospitalExtractEntry[]>([])
  const [insight, setInsight] = useState<HospitalInsightResult | null>(null)
  const [insightState, setInsightState] = useState<InsightState>('idle')
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

  // Medula text stays live with every keystroke in either group; the exam
  // findings follow the anamnez as a separate paragraph.
  const anamnezText = useMemo(() => buildMedulaText(entries ?? []), [entries])
  const examText = useMemo(() => buildMedulaText(examEntries ?? []), [examEntries])
  const medulaText = useMemo(
    () => [anamnezText, examText].filter(Boolean).join('\n\n'),
    [anamnezText, examText],
  )

  // Deterministic "not asked" checklist — recomputed on every card edit.
  const missingTopics = useMemo(
    () => (entries === null ? [] : missingCriticalTopics(entries, mode)),
    [entries, mode],
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
      const exam = Array.isArray(result.exam_entries) ? result.exam_entries : []
      setEntries(result.entries.map((e) => ({ id: crypto.randomUUID(), ...e })))
      setExamEntries(exam.map((e) => ({ id: crypto.randomUUID(), ...e })))
      setDropped(Array.isArray(result.dropped) ? result.dropped : [])
      // Stale insight from a previous extraction must not survive a re-process.
      setInsight(null)
      setInsightState('idle')
      if (result.entries.length === 0 && exam.length === 0) {
        toast.warning('Konuşmada anamneze girecek bilgi bulunamadı.')
      }
      // Auto-generate the clinical insight from the fresh extraction
      // (Q/A pairs only — identity never leaves this component).
      const body: HospitalInsightBody = {
        entries: result.entries.map(({ question, answer }) => ({ question, answer })),
        exam_entries: exam.map(({ question, answer }) => ({ question, answer })),
        mode,
      }
      if (body.entries.length > 0 || body.exam_entries.length > 0) {
        void fetchInsight(body)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Beklenmeyen hata.')
    } finally {
      setProcessing(false)
    }
  }

  async function fetchInsight(body: HospitalInsightBody) {
    setInsightState('loading')
    try {
      const res = await fetch('/api/hospital/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? `Klinik özet üretilemedi (${res.status})`)
        setInsightState('error')
        return
      }
      setInsight((await res.json()) as HospitalInsightResult)
      setInsightState('done')
    } catch {
      toast.error('Klinik özet üretilemedi — bağlantınızı kontrol edin.')
      setInsightState('error')
    }
  }

  // "Yeniden Üret" uses the CURRENT (possibly edited) cards, not the raw extraction.
  function handleInsightGenerate() {
    const clean = (list: HospitalEntry[] | null) =>
      (list ?? [])
        .map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() }))
        .filter((e) => e.question || e.answer)
    const body: HospitalInsightBody = { entries: clean(entries), exam_entries: clean(examEntries), mode }
    if (body.entries.length === 0 && body.exam_entries.length === 0) return
    void fetchInsight(body)
  }

  function setGroupEntries(group: EntryGroup) {
    return group === 'exam' ? setExamEntries : setEntries
  }

  function handleEntryChange(group: EntryGroup, id: string, field: 'question' | 'answer', value: string) {
    setGroupEntries(group)((prev) =>
      prev?.map((e) => (e.id === id ? { ...e, [field]: value } : e)) ?? prev,
    )
  }

  function handleEntryDelete(group: EntryGroup, id: string) {
    setGroupEntries(group)((prev) => prev?.filter((e) => e.id !== id) ?? prev)
  }

  function handleEntryAdd(group: EntryGroup, question = '') {
    setGroupEntries(group)((prev) => [...(prev ?? []), { id: crypto.randomUUID(), question, answer: '' }])
  }

  // "Sorulmadı" chip → empty row with the topic heading, ready to fill in.
  function handleMissingTopic(topic: CriticalTopic) {
    handleEntryAdd('anamnez', topic.question)
  }

  // Complaint chip → append to the existing Şikâyet row, or create one. Works
  // even before extraction (initializes the card list with a single row).
  function handleComplaintChip(complaint: string) {
    setEntries((prev) => {
      const list = prev ?? []
      const idx = list.findIndex((e) => {
        const q = e.question.toLocaleLowerCase('tr-TR')
        return q.includes('şikâyet') || q.includes('şikayet')
      })
      if (idx === -1) {
        return [...list, { id: crypto.randomUUID(), question: 'Şikâyet', answer: complaint }]
      }
      const current = list[idx]
      if (current.answer.toLocaleLowerCase('tr-TR').includes(complaint.toLocaleLowerCase('tr-TR'))) {
        return list // already recorded — no duplicate
      }
      const trimmed = current.answer.trim().replace(/[.!?…,\s]+$/, '')
      // Lowercase the first letter when appending mid-sentence.
      const tail = complaint[0].toLocaleLowerCase('tr-TR') + complaint.slice(1)
      const appended = trimmed ? `${trimmed}, ${tail}` : complaint
      return list.map((e, i) => (i === idx ? { ...e, answer: appended } : e))
    })
    toast.success(`"${complaint}" Şikâyet satırına eklendi.`)
  }

  const resetAll = useCallback(() => {
    setIdentity(EMPTY_IDENTITY)
    setSegments([])
    setEntries(null)
    setExamEntries(null)
    setDropped([])
    setInsight(null)
    setInsightState('idle')
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
        clinicalText: anamnezText,
        examText,
        summary: insightState === 'done' ? insight?.summary : undefined,
      })
      // Requirement: PDF closes the encounter — identity + transcript + output
      // are wiped so the next patient starts from a clean slate.
      resetAll()
      toast.success('PDF indirildi — modül yeni hasta için sıfırlandı.')
    } catch (err) {
      // Surface the real error — a generic toast hides field reports.
      console.error('[hospital] PDF oluşturulamadı:', err)
      toast.error(`PDF oluşturulamadı: ${err instanceof Error ? err.message : 'bilinmeyen hata'}`)
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
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            İpucu: Hastanın söylediklerini mikrofona kısaca tekrarlayın — nota ancak duyulanlar
            yazılır.
          </p>
        </section>

        {/* Quick complaint chips: the patient points instead of saying it —
            one tap records the complaint without extra typing. */}
        <section className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Sık Şikâyetler</h2>
          <div className="flex flex-wrap gap-2">
            {COMPLAINT_CHIPS[mode].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleComplaintChip(c)}
                className="rounded-full border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Hasta söylemiyor, gösteriyorsa dokunun — Şikâyet satırına eklenir.
          </p>
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
            title={
              !medulaText
                ? 'PDF için önce kaydı işleyin ya da en az bir kart doldurun (örn. Sık Şikâyetler)'
                : undefined
            }
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
          <>
            {/* Deterministic "not asked" checklist — amber chips insert a
                ready-to-fill row for the missing topic. */}
            {missingTopics.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Sorulmadı:</span>
                {missingTopics.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleMissingTopic(t)}
                    title={`"${t.question}" başlıklı boş satır ekler`}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800 transition-colors outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                  >
                    {t.label} sorulmadı
                  </button>
                ))}
              </div>
            )}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Anamnez</h2>
              <QaCards
                entries={entries}
                onChange={(id, field, value) => handleEntryChange('anamnez', id, field, value)}
                onDelete={(id) => handleEntryDelete('anamnez', id)}
                onAdd={() => handleEntryAdd('anamnez')}
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Fizik Muayene</h2>
              <QaCards
                entries={examEntries ?? []}
                onChange={(id, field, value) => handleEntryChange('exam', id, field, value)}
                onDelete={(id) => handleEntryDelete('exam', id)}
                onAdd={() => handleEntryAdd('exam')}
              />
            </section>

            {/* Grounding drops: visible for trust, never enter Medula/PDF. */}
            {dropped.length > 0 && (
              <section className="space-y-2 rounded-lg border border-dashed border-border p-4 opacity-70">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Doğrulanamayan ifadeler (transkriptte bulunamadı, atlandı)
                </h3>
                <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                  {dropped.map((d, i) => (
                    <li key={i}>
                      • {d.question}: {d.answer}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <InsightCard
              state={insightState}
              insight={insight}
              canGenerate={(entries?.length ?? 0) + (examEntries?.length ?? 0) > 0}
              onGenerate={handleInsightGenerate}
            />
          </>
        )}

        <MedulaBox text={medulaText} />

        <p className="text-xs leading-relaxed text-muted-foreground">
          PDF indirildiğinde modül tamamen sıfırlanır: kimlik, konuşma ve çıktı silinir.
        </p>
      </div>
    </div>
  )
}
