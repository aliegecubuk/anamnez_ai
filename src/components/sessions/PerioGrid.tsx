'use client'

// Periodontoloji — Tam Charting (competitor-parity card layout).
// Speech list is processed via "İşle ve Düzenle"; each mentioned tooth becomes an
// editable card (ÖN = fasial/bukkal MB·B·DB, ARKA = palatal/lingual ML·L·DL) with a
// "kan" checkbox per point. "Onayla & PDF" finalizes the chart and hands over the PDF.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle, FileDown, Settings2, Check, Plus, X, Eraser } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DisambiguationModal, { type AmbiguousEntry } from './DisambiguationModal'
import type {
  PerioChartDTO,
  PerioMeasurementDTO,
  PerioPoint,
  ParsedToothEntry,
} from '@/lib/perio/types'
import { BUCCAL_POINTS, LINGUAL_POINTS, ALL_FDI_TEETH } from '@/lib/perio/types'

interface PointValues {
  pocket_depth: number | null
  attachment_loss: number | null
  bleeding: boolean | null
}

// measurement map: tooth → point → values (Map preserves parse/add order for card order)
type MeasMap = Map<number, Map<PerioPoint, PointValues>>

const EMPTY_POINT: PointValues = { pocket_depth: null, attachment_loss: null, bleeding: null }

function buildMap(measurements: PerioMeasurementDTO[]): MeasMap {
  const map: MeasMap = new Map()
  for (const m of measurements) {
    if (!map.has(m.tooth_number)) map.set(m.tooth_number, new Map())
    map.get(m.tooth_number)!.set(m.point, {
      pocket_depth: m.pocket_depth,
      attachment_loss: m.attachment_loss,
      bleeding: m.bleeding,
    })
  }
  return map
}

function pdColor(pd: number | null): string {
  if (pd === null) return ''
  if (pd >= 6) return 'text-red-600 font-bold'
  if (pd >= 4) return 'text-amber-600 font-semibold'
  return 'text-emerald-600'
}

function isUpperTooth(tooth: number): boolean {
  return tooth < 30
}

interface Props {
  sessionId: string
  patientId: string
  patientName?: string
  sessionStartedAt?: string
  onSaved?: () => void
}

export default function PerioGrid({ sessionId, patientName, sessionStartedAt, onSaved }: Props) {
  const [chart, setChart] = useState<PerioChartDTO | null>(null)
  const [measMap, setMeasMap] = useState<MeasMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [parsedOnce, setParsedOnce] = useState(false)
  const [newTooth, setNewTooth] = useState('')
  const [ambiguousQueue, setAmbiguousQueue] = useState<AmbiguousEntry[]>([])
  const pendingAmbiguous = useRef<ParsedToothEntry[]>([])
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const loadChart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/perio`)
      if (!res.ok) { toast.error('Perio chart yüklenemedi.'); return }
      const data = (await res.json()) as PerioChartDTO
      setChart(data)
      setMeasMap(buildMap(data.measurements))
      if (data.measurements.length > 0) setParsedOnce(true)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadChart()
  }, [loadChart])

  // "İşle ve Düzenle" — GPT-4o reads the speech list and fills the tooth cards.
  async function triggerParse() {
    setParsing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/perio`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? 'Transkript çözümlenemedi.')
        return
      }
      const data = (await res.json()) as { measurements: PerioMeasurementDTO[]; ambiguous: ParsedToothEntry[] }
      setMeasMap(buildMap(data.measurements))
      setChart((c) => c ? { ...c, measurements: data.measurements } : c)
      setParsedOnce(true)

      if (data.ambiguous.length > 0) {
        pendingAmbiguous.current = data.ambiguous
        setAmbiguousQueue(
          data.ambiguous.map((a, i) => ({
            index: i,
            raw_mention: a.raw_mention,
            candidates: a.candidates ?? [],
          })),
        )
      }
    } finally {
      setParsing(false)
    }
  }

  // Full point values are always persisted together so a bleeding toggle can't
  // wipe a pocket depth (and vice versa).
  function persistPoint(tooth: number, point: PerioPoint, values: PointValues) {
    const key = `${tooth}-${point}`
    const existing = debounceTimers.current.get(key)
    if (existing) clearTimeout(existing)
    debounceTimers.current.set(key, setTimeout(() => {
      void fetch(`/api/sessions/${sessionId}/perio`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tooth_number: tooth, point, ...values }),
      }).catch(() => toast.error('Değişiklik kaydedilemedi.'))
    }, 500))
  }

  function updatePoint(tooth: number, point: PerioPoint, patch: Partial<PointValues>) {
    setMeasMap((prev) => {
      const next = new Map(prev)
      if (!next.has(tooth)) next.set(tooth, new Map())
      const toothMap = new Map(next.get(tooth)!)
      const merged = { ...(toothMap.get(point) ?? EMPTY_POINT), ...patch }
      toothMap.set(point, merged)
      next.set(tooth, toothMap)
      persistPoint(tooth, point, merged)
      return next
    })
  }

  function addTooth() {
    const tooth = Number.parseInt(newTooth, 10)
    if (!ALL_FDI_TEETH.has(tooth)) {
      toast.error('Geçerli bir FDI diş numarası girin (11-18, 21-28, 31-38, 41-48).')
      return
    }
    setMeasMap((prev) => {
      if (prev.has(tooth)) return prev
      const next = new Map(prev)
      next.set(tooth, new Map())
      return next
    })
    setNewTooth('')
  }

  function removeTooth(tooth: number) {
    const points = measMap.get(tooth)
    // Null out any persisted values so the removal survives a reload.
    if (points) {
      for (const [point, vals] of points) {
        if (vals.pocket_depth !== null || vals.attachment_loss !== null || vals.bleeding !== null) {
          void fetch(`/api/sessions/${sessionId}/perio`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tooth_number: tooth, point, ...EMPTY_POINT }),
          }).catch(() => {})
        }
      }
    }
    setMeasMap((prev) => {
      const next = new Map(prev)
      next.delete(tooth)
      return next
    })
  }

  async function handleClear() {
    if (!window.confirm('Tüm periodontal ölçümler silinecek. Emin misiniz?')) return
    setClearing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/perio`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Ölçümler temizlenemedi.'); return }
      setMeasMap(new Map())
      setParsedOnce(false)
    } finally {
      setClearing(false)
    }
  }

  async function handleDisambiguationResolve(index: number, chosenTooth: number) {
    const entry = pendingAmbiguous.current[index]
    // Consume the queue entry immediately — the modal is parent-controlled.
    setAmbiguousQueue((q) => q.filter((e) => e.index !== index))
    if (!entry) return
    for (const [pt, vals] of Object.entries(entry.measurements)) {
      if (!vals) continue
      updatePoint(chosenTooth, pt as PerioPoint, {
        pocket_depth: vals.pocket_depth ?? null,
        attachment_loss: vals.attachment_loss ?? null,
        bleeding: vals.bleeding ?? null,
      })
    }
  }

  function handleDisambiguationSkip(index: number) {
    setAmbiguousQueue((q) => q.filter((e) => e.index !== index))
  }

  // Flatten the (possibly hand-edited) in-memory map for PDF export.
  function mapToMeasurements(): PerioMeasurementDTO[] {
    const rows: PerioMeasurementDTO[] = []
    for (const [tooth, points] of measMap) {
      for (const [point, vals] of points) {
        rows.push({ tooth_number: tooth, point, ...vals })
      }
    }
    return rows
  }

  async function handlePdf() {
    setPdfBusy(true)
    try {
      const { downloadPerioPdf } = await import('@/lib/pdf/perio-pdf')
      await downloadPerioPdf({
        patientName: patientName ?? 'Hasta',
        sessionDate: sessionStartedAt
          ? new Date(sessionStartedAt).toLocaleString('tr-TR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : new Date().toLocaleDateString('tr-TR'),
        measurements: mapToMeasurements(),
      })
    } catch {
      toast.error('PDF oluşturulamadı.')
    } finally {
      setPdfBusy(false)
    }
  }

  // "Onayla & PDF" — finalize the chart (immutable) then hand the hekim the PDF.
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/perio`, { method: 'PUT' })
      if (!res.ok) { toast.error('Chart kaydedilemedi.'); return }
      setChart((c) => c ? { ...c, status: 'saved', saved_at: new Date().toISOString() } : c)
      toast.success('Periodontal chart kaydedildi.')
      await handlePdf()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const readonly = chart?.status === 'saved'
  const teeth = [...measMap.keys()]
  let measurementCount = 0
  for (const points of measMap.values()) {
    for (const v of points.values()) {
      if (v.pocket_depth !== null || v.attachment_loss !== null || v.bleeding !== null) measurementCount++
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Perio chart yükleniyor…
      </div>
    )
  }

  function renderPointRow(tooth: number, points: readonly PerioPoint[], labels: readonly string[], title: string) {
    const toothData = measMap.get(tooth)
    return (
      <div className="flex-1 space-y-2 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="grid grid-cols-3 gap-3">
          {points.map((pt, i) => {
            const vals = toothData?.get(pt) ?? EMPTY_POINT
            return (
              <div key={pt} className="space-y-1.5">
                <p className="text-center text-[10px] text-muted-foreground">{labels[i]}</p>
                <input
                  type="number"
                  min={0}
                  max={20}
                  disabled={readonly}
                  value={vals.pocket_depth ?? ''}
                  onChange={(e) =>
                    updatePoint(tooth, pt, {
                      pocket_depth: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className={`h-9 w-full rounded-md border border-input bg-background text-center text-sm disabled:opacity-50 ${pdColor(vals.pocket_depth)}`}
                  aria-label={`${tooth} ${pt} cep derinliği`}
                />
                <label className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={readonly}
                    checked={vals.bleeding === true}
                    onChange={(e) => updatePoint(tooth, pt, { bleeding: e.target.checked ? true : null })}
                    className="h-3 w-3 accent-red-600"
                  />
                  kan
                </label>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold">Periodontoloji — Tam Charting</h2>
        <p className="text-xs text-muted-foreground">
          Doktor başlangıç dişini söyler (&quot;17&apos;den başlıyorum&quot;), sonra diş diş ilerleyerek her diş
          için önce 3 ön sonra 3 arka ölçümü sayar. AI bunları doğru dişe yerleştirir; hekim düzeltebilir.
        </p>
      </div>

      {teeth.length === 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          <p>Konuşmayı yukarıdan ekleyip &quot;İşle ve Düzenle&quot;ye basın.</p>
          <p className="mt-1 text-xs">
            Örn: <code className="rounded bg-muted px-1.5 py-0.5">17&apos;den başlıyorum. 5 6 6, 2 3 4. 16: 3 4 5, mesialde kanama var…</code>
          </p>
        </div>
      )}

      <div className="space-y-3">
        {teeth.map((tooth) => (
          <div key={tooth} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 bg-teal-500/10 px-4 py-2">
              <span className="rounded-md bg-background px-2.5 py-1 text-sm font-semibold shadow-sm">{tooth}</span>
              <span className="text-xs text-muted-foreground">
                {isUpperTooth(tooth) ? 'Üst çene' : 'Alt çene'}
              </span>
              {!readonly && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTooth(tooth)}
                  aria-label={`${tooth} numaralı dişi kaldır`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
              {renderPointRow(tooth, BUCCAL_POINTS, ['MB', 'B', 'DB'], 'Ön (Fasial/Bukkal)')}
              {renderPointRow(
                tooth,
                LINGUAL_POINTS,
                isUpperTooth(tooth) ? ['MP', 'P', 'DP'] : ['ML', 'L', 'DL'],
                isUpperTooth(tooth) ? 'Arka (Palatal)' : 'Arka (Lingual)',
              )}
            </div>
          </div>
        ))}
      </div>

      {!readonly && (
        <div className="flex items-center gap-2">
          <Input
            value={newTooth}
            placeholder="Diş no (örn. 36)"
            inputMode="numeric"
            onChange={(e) => setNewTooth(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTooth()
            }}
            className="h-8 w-32 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={addTooth} className="h-8 gap-1 border-dashed text-xs">
            <Plus className="h-3.5 w-3.5" />
            diş ekle
          </Button>
        </div>
      )}

      {parsedOnce && !readonly && measurementCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          Ölçümler işlendi. Değerleri düzeltip PDF oluşturabilirsiniz.
        </div>
      )}

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Konuşma çözümleniyor…
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <p className="flex-1 min-w-[200px] text-sm text-muted-foreground">
          Ölçümler hekim onayından sonra kayda geçer.
        </p>
        {!readonly && (
          <>
            <Button type="button" variant="outline" onClick={handleClear} disabled={clearing || parsing} className="gap-1.5">
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              Temizle
            </Button>
            <Button type="button" onClick={triggerParse} disabled={parsing} className="gap-1.5">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
              İşle ve Düzenle
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || pdfBusy || measurementCount === 0}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Onayla &amp; PDF
            </Button>
          </>
        )}
        {readonly && (
          <>
            <Button type="button" variant="outline" onClick={handlePdf} disabled={pdfBusy} className="gap-1.5">
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF İndir
            </Button>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Kaydedildi
            </span>
          </>
        )}
      </div>

      {measurementCount > 0 && !readonly && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          {measurementCount} ölçüm taslakta — &quot;Onayla &amp; PDF&quot; ile kalıcılaşır.
          <span className="ml-2">
            Renk: <span className="text-emerald-600">1–3 mm</span> ·{' '}
            <span className="text-amber-600">4–5 mm</span> ·{' '}
            <span className="text-red-600">≥6 mm</span>
          </span>
        </p>
      )}

      <DisambiguationModal
        entries={ambiguousQueue}
        onResolve={handleDisambiguationResolve}
        onSkip={handleDisambiguationSkip}
      />
    </section>
  )
}
