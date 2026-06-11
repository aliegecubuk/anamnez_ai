'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DisambiguationModal, { type AmbiguousEntry } from './DisambiguationModal'
import type {
  PerioChartDTO,
  PerioMeasurementDTO,
  PerioPoint,
  ParsedToothEntry,
} from '@/lib/perio/types'
import {
  UPPER_RIGHT, UPPER_LEFT, LOWER_LEFT, LOWER_RIGHT,
  BUCCAL_POINTS, LINGUAL_POINTS, PERIO_POINTS, ALL_FDI_TEETH,
} from '@/lib/perio/types'

// measurement map: tooth → point → value
type MeasMap = Map<number, Map<PerioPoint, { pocket_depth: number | null; attachment_loss: number | null; bleeding: boolean | null }>>

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

interface CellProps {
  value: number | null
  readonly: boolean
  onChange: (v: number | null) => void
}
function PdCell({ value, readonly, onChange }: CellProps) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      disabled={readonly}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`w-8 rounded border border-input bg-background text-center text-xs py-0.5 disabled:opacity-50 ${pdColor(value)}`}
      aria-label="cep derinliği"
    />
  )
}

// A single tooth column: tooth number label + 3 cells for one surface (buccal or lingual)
function ToothColumn({
  toothNumber,
  points,
  measMap,
  readonly,
  onUpdate,
}: {
  toothNumber: number
  points: readonly PerioPoint[]
  measMap: MeasMap
  readonly: boolean
  onUpdate: (tooth: number, point: PerioPoint, value: number | null) => void
}) {
  const toothData = measMap.get(toothNumber)
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[2.5rem]">
      <span className="text-[10px] text-muted-foreground leading-none">{toothNumber}</span>
      {points.map((pt) => (
        <PdCell
          key={pt}
          value={toothData?.get(pt)?.pocket_depth ?? null}
          readonly={readonly}
          onChange={(v) => onUpdate(toothNumber, pt, v)}
        />
      ))}
      <span className="text-[8px] text-muted-foreground mt-0.5 leading-none">
        {points.join('/')}
      </span>
    </div>
  )
}

// One jaw row: label + all tooth columns
function JawRow({
  label,
  teeth,
  points,
  measMap,
  readonly,
  onUpdate,
}: {
  label: string
  teeth: readonly number[]
  points: readonly PerioPoint[]
  measMap: MeasMap
  readonly: boolean
  onUpdate: (tooth: number, point: PerioPoint, value: number | null) => void
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground pt-5">{label}</span>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {teeth.map((t) => (
          <ToothColumn
            key={t}
            toothNumber={t}
            points={points}
            measMap={measMap}
            readonly={readonly}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}

interface Props {
  sessionId: string
  patientId: string
  onSaved?: () => void
}

export default function PerioGrid({ sessionId, patientId, onSaved }: Props) {
  const [chart, setChart] = useState<PerioChartDTO | null>(null)
  const [measMap, setMeasMap] = useState<MeasMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
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
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Auto-parse on mount if chart is draft with no measurements (PERIO-02)
  useEffect(() => {
    void loadChart().then(async () => {
      // Re-read after load to check if parsing needed
    })
  }, [loadChart])

  // Auto-trigger parse when chart loads with no measurements
  useEffect(() => {
    if (!chart || chart.status !== 'draft' || chart.measurements.length > 0) return
    void triggerParse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart?.id])

  async function triggerParse() {
    setParsing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/perio`, { method: 'POST' })
      if (!res.ok) { toast.error('Transkript çözümlenemedi.'); return }
      const data = (await res.json()) as { measurements: PerioMeasurementDTO[]; ambiguous: ParsedToothEntry[] }
      setMeasMap(buildMap(data.measurements))
      setChart((c) => c ? { ...c, measurements: data.measurements } : c)

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

  function handleCellUpdate(tooth: number, point: PerioPoint, value: number | null) {
    // Optimistic update
    setMeasMap((prev) => {
      const next = new Map(prev)
      if (!next.has(tooth)) next.set(tooth, new Map())
      const toothMap = new Map(next.get(tooth)!)
      const existing = toothMap.get(point) ?? { pocket_depth: null, attachment_loss: null, bleeding: null }
      toothMap.set(point, { ...existing, pocket_depth: value })
      next.set(tooth, toothMap)
      return next
    })

    // Debounced persist
    const key = `${tooth}-${point}`
    const existing = debounceTimers.current.get(key)
    if (existing) clearTimeout(existing)
    debounceTimers.current.set(key, setTimeout(() => {
      void fetch(`/api/sessions/${sessionId}/perio`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tooth_number: tooth, point, pocket_depth: value }),
      }).catch(() => toast.error('Değişiklik kaydedilemedi.'))
    }, 600))
  }

  async function handleDisambiguationResolve(index: number, chosenTooth: number) {
    const entry = pendingAmbiguous.current[index]
    if (!entry) return
    // Apply measurements for chosen tooth
    for (const [pt, vals] of Object.entries(entry.measurements)) {
      if (vals?.pocket_depth !== null && vals?.pocket_depth !== undefined) {
        handleCellUpdate(chosenTooth, pt as PerioPoint, vals.pocket_depth)
      }
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/perio`, { method: 'PUT' })
      if (!res.ok) { toast.error('Chart kaydedilemedi.'); return }
      setChart((c) => c ? { ...c, status: 'saved', saved_at: new Date().toISOString() } : c)
      toast.success('Periodontal chart kaydedildi.')
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const readonly = chart?.status === 'saved'
  const measurementCount = Array.from(measMap.values()).reduce((acc, m) => acc + m.size, 0)
  const hasUnsaved = measurementCount > 0 && !readonly

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Perio chart yükleniyor…
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Periodontal Chart</h2>
          <p className="text-xs text-muted-foreground">FDI numaralama · Cep derinliği (mm)</p>
        </div>
        <div className="flex gap-2">
          {!readonly && (
            <Button type="button" variant="outline" size="sm" onClick={triggerParse} disabled={parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yeniden Çözümle'}
            </Button>
          )}
          {!readonly && (
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || measurementCount === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Kaydet</>}
            </Button>
          )}
          {readonly && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Kaydedildi
            </span>
          )}
        </div>
      </div>

      {hasUnsaved && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {measurementCount} ölçüm kaydedilmemiş. Kaydetmeden çıkarsanız kaybolur.
        </div>
      )}

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Transkript çözümleniyor…
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card p-4 space-y-5">
        {/* Upper jaw */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Üst Çene (Maksilla)</p>
          <JawRow
            label="Palatal"
            teeth={[...UPPER_RIGHT, ...UPPER_LEFT]}
            points={LINGUAL_POINTS}
            measMap={measMap}
            readonly={!!readonly}
            onUpdate={handleCellUpdate}
          />
          <div className="border-t border-dashed border-border" />
          <JawRow
            label="Bukkal"
            teeth={[...UPPER_RIGHT, ...UPPER_LEFT]}
            points={BUCCAL_POINTS}
            measMap={measMap}
            readonly={!!readonly}
            onUpdate={handleCellUpdate}
          />
        </div>

        <div className="border-t-2 border-border" />

        {/* Lower jaw */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Alt Çene (Mandibula)</p>
          <JawRow
            label="Bukkal"
            teeth={[...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT]}
            points={BUCCAL_POINTS}
            measMap={measMap}
            readonly={!!readonly}
            onUpdate={handleCellUpdate}
          />
          <div className="border-t border-dashed border-border" />
          <JawRow
            label="Lingual"
            teeth={[...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT]}
            points={LINGUAL_POINTS}
            measMap={measMap}
            readonly={!!readonly}
            onUpdate={handleCellUpdate}
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Renk: <span className="text-emerald-600">1–3 mm</span> ·{' '}
        <span className="text-amber-600">4–5 mm</span> ·{' '}
        <span className="text-red-600">≥6 mm</span>
      </p>

      <DisambiguationModal
        entries={ambiguousQueue}
        onResolve={handleDisambiguationResolve}
        onSkip={() => {}}
      />
    </section>
  )
}
