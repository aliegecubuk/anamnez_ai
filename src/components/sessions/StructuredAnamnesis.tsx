'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Eraser,
  FileDown,
  Loader2,
  Pill,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AI_REPORT_DISCLAIMER,
  BLOCKS_TREATMENT_LABELS,
  GROUP_LABELS,
  SECTION_GROUPS,
  SECTION_LABELS,
  type AiReportDTO,
  type AnamnesisEntryDTO,
  type MedicationDTO,
  type SectionKey,
  type StructuredAnamnesisPayload,
} from '@/lib/anamnesis/structured-types'

interface Props {
  sessionId: string
  patientName: string
  sessionStartedAt: string
}

let draftCounter = 0
function nextDraftId() {
  draftCounter += 1
  return `draft-${draftCounter}`
}

function EntryConfidenceBadge({ entry }: { entry: AnamnesisEntryDTO }) {
  if (entry.edited_by_human) return <Badge variant="secondary">Düzenlendi</Badge>
  const c = entry.confidence
  if (c === null || c === undefined) return null
  if (c >= 0.8) return <Badge className="bg-emerald-600 text-white">Yüksek</Badge>
  if (c >= 0.5) return <Badge className="bg-amber-500 text-white">Orta</Badge>
  return <Badge variant="destructive">Düşük</Badge>
}

function BlocksBadge({ value }: { value: MedicationDTO['blocks_treatment'] }) {
  if (!value) return null
  if (value === 'engel_yok') {
    return <Badge className="bg-emerald-600 text-white">{BLOCKS_TREATMENT_LABELS[value]}</Badge>
  }
  if (value === 'dikkat') {
    return <Badge className="bg-amber-500 text-white">{BLOCKS_TREATMENT_LABELS[value]}</Badge>
  }
  return <Badge variant="destructive">{BLOCKS_TREATMENT_LABELS[value]}</Badge>
}

export default function StructuredAnamnesis({ sessionId, patientName, sessionStartedAt }: Props) {
  const [entries, setEntries] = useState<AnamnesisEntryDTO[]>([])
  const [medications, setMedications] = useState<MedicationDTO[]>([])
  const [report, setReport] = useState<AiReportDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [newDrug, setNewDrug] = useState('')
  const [drugBusy, setDrugBusy] = useState(false)
  const savedContents = useRef<Record<string, string>>({})

  const applyPayload = useCallback((payload: StructuredAnamnesisPayload) => {
    setEntries(payload.entries)
    setMedications(payload.medications)
    setReport(payload.report)
    savedContents.current = Object.fromEntries(payload.entries.map((e) => [e.id, e.content]))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/sessions/${sessionId}/structured`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Anamnez bilgileri yüklenemedi.')
        return (await res.json()) as StructuredAnamnesisPayload
      })
      .then((payload) => {
        if (!cancelled) applyPayload(payload)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Yükleme hatası.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, applyPayload])

  // "İşle ve Düzenle" — GPT-4o transkripti 6 bölüme yerleştirir + ilaçları çıkarır.
  async function handleProcess() {
    setProcessing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/structured`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'İşleme başarısız.')
      }
      applyPayload((await res.json()) as StructuredAnamnesisPayload)
      toast.success('Ses kaydı bölümlere yerleştirildi.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşleme başarısız.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleClear() {
    if (!window.confirm('Tüm anamnez satırları, ilaçlar ve AI raporu silinecek. Emin misiniz?')) return
    setClearing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/structured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'clear' }),
      })
      if (!res.ok) throw new Error('Temizleme başarısız.')
      setEntries([])
      setMedications([])
      setReport(null)
      savedContents.current = {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Temizleme başarısız.')
    } finally {
      setClearing(false)
    }
  }

  function addDraftRow(sectionKey: SectionKey) {
    setEntries((prev) => [
      ...prev,
      {
        id: nextDraftId(),
        section_key: sectionKey,
        content: '',
        confidence: null,
        source: 'manual',
        edited_by_human: true,
        display_order: prev.filter((e) => e.section_key === sectionKey).length,
      },
    ])
  }

  function updateEntryLocal(id: string, content: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, content } : e)))
  }

  async function persistEntry(entry: AnamnesisEntryDTO) {
    const isDraft = entry.id.startsWith('draft-')
    const content = entry.content.trim()

    if (isDraft && !content) {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
      return
    }
    if (!isDraft && content === savedContents.current[entry.id]) return
    if (!isDraft && !content) {
      // Boş bırakılan mevcut satır silinir.
      await deleteEntry(entry.id)
      return
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/structured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'upsert_entry',
          id: isDraft ? undefined : entry.id,
          section_key: entry.section_key,
          content,
        }),
      })
      if (!res.ok) throw new Error('Satır kaydedilemedi.')
      const { entry: saved } = (await res.json()) as { entry: AnamnesisEntryDTO }
      savedContents.current[saved.id] = saved.content
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? saved : e)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Satır kaydedilemedi.')
    }
  }

  async function deleteEntry(id: string) {
    if (id.startsWith('draft-')) {
      setEntries((prev) => prev.filter((e) => e.id !== id))
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    delete savedContents.current[id]
    try {
      const res = await fetch(`/api/sessions/${sessionId}/structured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'delete_entry', id }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Satır silinemedi.')
    }
  }

  async function addMedication() {
    const name = newDrug.trim()
    if (!name) return
    setDrugBusy(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/structured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'add_medication', name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'İlaç eklenemedi.')
      }
      const { medication } = (await res.json()) as { medication: MedicationDTO }
      setMedications((prev) => [...prev.filter((m) => m.id !== medication.id), medication])
      setNewDrug('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İlaç eklenemedi.')
    } finally {
      setDrugBusy(false)
    }
  }

  async function deleteMedication(id: string) {
    setMedications((prev) => prev.filter((m) => m.id !== id))
    try {
      const res = await fetch(`/api/sessions/${sessionId}/structured`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'delete_medication', id }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('İlaç silinemedi.')
    }
  }

  async function generateReport(): Promise<AiReportDTO | null> {
    setReportBusy(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'AI raporu oluşturulamadı.')
      }
      const { report: fresh } = (await res.json()) as { report: AiReportDTO }
      setReport(fresh)
      return fresh
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI raporu oluşturulamadı.')
      return null
    } finally {
      setReportBusy(false)
    }
  }

  // PDF her indirmede güncel verilerle taze rapor üretir (bayat AI raporu riski yok).
  async function handlePdf() {
    if (entries.length === 0 && medications.length === 0) {
      toast.error('PDF için önce anamnez bilgilerini işleyin veya ekleyin.')
      return
    }
    setPdfBusy(true)
    try {
      const fresh = await generateReport()
      const { downloadAnamnesisPdf } = await import('@/lib/pdf/anamnesis-pdf')
      await downloadAnamnesisPdf({
        patientName,
        sessionDate: new Date(sessionStartedAt).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        entries,
        medications,
        report: fresh ?? report,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF oluşturulamadı.')
    } finally {
      setPdfBusy(false)
    }
  }

  function renderSectionCard(sectionKey: SectionKey) {
    const rows = entries.filter((e) => e.section_key === sectionKey)
    return (
      <div key={sectionKey} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">{SECTION_LABELS[sectionKey]}</p>
        {rows.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <Input
              value={entry.content}
              autoFocus={entry.id.startsWith('draft-')}
              placeholder="Bilgi girin…"
              onChange={(e) => updateEntryLocal(entry.id, e.target.value)}
              onBlur={() => persistEntry(entry)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              className="h-8 text-sm"
            />
            <EntryConfidenceBadge entry={entry} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteEntry(entry.id)}
              aria-label="Satırı sil"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-dashed text-xs text-muted-foreground"
          onClick={() => addDraftRow(sectionKey)}
        >
          <Plus className="mr-1 h-3 w-3" />
          satır
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <section className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Anamnez bilgileri yükleniyor…
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Anamnez — Section-Bazlı Sınıflandırma</h2>
        <p className="text-sm text-muted-foreground">
          AI bilgileri doğru section&apos;lara yerleştirir. Hekim taşıyabilir, düzeltebilir.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {GROUP_LABELS.genel}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTION_GROUPS.genel.map(renderSectionCard)}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {GROUP_LABELS.ozgecmis}
            </p>
            {SECTION_GROUPS.ozgecmis.map(renderSectionCard)}
          </div>
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {GROUP_LABELS.soygecmis}
            </p>
            {SECTION_GROUPS.soygecmis.map(renderSectionCard)}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {GROUP_LABELS.muayene}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTION_GROUPS.muayene.map(renderSectionCard)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <p className="flex-1 min-w-[200px] text-sm text-muted-foreground">
          Yerleştirme önerisini hekim düzeltir.
        </p>
        <Button type="button" variant="outline" onClick={handleClear} disabled={clearing || processing}>
          {clearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}
          Temizle
        </Button>
        <Button type="button" onClick={handleProcess} disabled={processing}>
          {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
          {processing ? 'İşleniyor…' : 'İşle ve Düzenle'}
        </Button>
      </div>

      {/* Kullanılan ilaçlar — etken madde + dental önem + cerrahi engel kartları */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Kullanılan İlaçlar</h3>
        </div>

        {medications.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Henüz ilaç eklenmedi. &quot;İşle ve Düzenle&quot; transkriptteki ilaçları otomatik çıkarır.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {medications.map((m) => (
            <div key={m.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{m.name}</p>
                  <BlocksBadge value={m.blocks_treatment} />
                  {m.risk_level && (
                    <span className="text-xs text-muted-foreground">risk: {m.risk_level}</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMedication(m.id)}
                  aria-label="İlacı sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {m.active_ingredient === null && m.summary === null ? (
                <p className="text-xs text-muted-foreground">
                  Bilgi alınamadı — ilacı silip yeniden ekleyerek tekrar deneyebilirsiniz.
                </p>
              ) : (
                <dl className="space-y-1.5 text-xs">
                  <div>
                    <dt className="font-medium text-muted-foreground">Etken madde</dt>
                    <dd>{m.active_ingredient ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Özet</dt>
                    <dd>{m.summary ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Diş hekimliği önemi</dt>
                    <dd>{m.dental_significance ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Cerrahi / işlem önlemi</dt>
                    <dd>{m.surgical_precautions ?? '—'}</dd>
                  </div>
                </dl>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newDrug}
            placeholder="İlaç adı ekle (örn. Coraspin)"
            onChange={(e) => setNewDrug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMedication()
            }}
            className="h-9 max-w-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={addMedication} disabled={drugBusy}>
            {drugBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            Ekle
          </Button>
        </div>
      </div>

      {/* AI değerlendirme raporu */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">AI Değerlendirme Raporu</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={generateReport} disabled={reportBusy || pdfBusy}>
              {reportBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              {report ? 'Raporu Yenile' : 'Rapor Oluştur'}
            </Button>
            <Button type="button" size="sm" onClick={handlePdf} disabled={pdfBusy || reportBusy}>
              {pdfBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1 h-3.5 w-3.5" />}
              PDF İndir
            </Button>
          </div>
        </div>

        {report ? (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
            <p>{report.summary}</p>
            {report.dental_considerations.length > 0 && (
              <div>
                <p className="font-medium">Dental tedavi planlamasında dikkat edilecekler</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {report.dental_considerations.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            {report.risk_flags.length > 0 && (
              <div>
                <p className="font-medium text-destructive">Risk uyarıları</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {report.risk_flags.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            {report.recommendations.length > 0 && (
              <div>
                <p className="font-medium">Öneriler</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {report.recommendations.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            <p className="text-xs italic text-muted-foreground">{AI_REPORT_DISCLAIMER}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Rapor henüz oluşturulmadı. PDF indirirken güncel verilerle otomatik oluşturulur.
          </p>
        )}
      </div>
    </section>
  )
}
