'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DisambiguationModal, { type AmbiguousEntry } from './DisambiguationModal'
import type {
  ToothConditionDTO,
  PathologyCondition,
  ParsedToothCondition,
} from '@/lib/perio/types'
import {
  ALL_CONDITIONS,
  CONDITION_LABELS,
  CONDITION_COLORS,
  UPPER_RIGHT, UPPER_LEFT, LOWER_LEFT, LOWER_RIGHT,
} from '@/lib/perio/types'

const UPPER_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT]
const LOWER_TEETH = [...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT]

// Build a map: tooth_number → conditions[]
type ConditionMap = Map<number, ToothConditionDTO[]>
function buildCondMap(conditions: ToothConditionDTO[]): ConditionMap {
  const map: ConditionMap = new Map()
  for (const c of conditions) {
    if (!map.has(c.tooth_number)) map.set(c.tooth_number, [])
    map.get(c.tooth_number)!.push(c)
  }
  return map
}

// SVG tooth shape
function ToothShape({
  toothNumber,
  conditions,
  onClick,
}: {
  toothNumber: number
  conditions: ToothConditionDTO[]
  onClick: () => void
}) {
  const primaryColor = conditions.length > 0 ? CONDITION_COLORS[conditions[0].condition_type] : '#e5e7eb'
  const hasMultiple = conditions.length > 1
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick} role="button" aria-label={`Diş ${toothNumber}`}>
      <ellipse
        cx={18}
        cy={22}
        rx={12}
        ry={16}
        fill={primaryColor}
        stroke={conditions.length > 0 ? '#374151' : '#d1d5db'}
        strokeWidth={1}
        opacity={conditions.length > 0 ? 0.85 : 0.5}
      />
      {hasMultiple && (
        <circle cx={28} cy={8} r={5} fill="#374151" />
      )}
      {hasMultiple && (
        <text x={28} y={12} textAnchor="middle" fontSize={6} fill="white">{conditions.length}</text>
      )}
      <text x={18} y={47} textAnchor="middle" fontSize={7} fill="#6b7280">{toothNumber}</text>
    </g>
  )
}

// Condition selection popover for a tooth
function ConditionPicker({
  toothNumber,
  existing,
  onAdd,
  onRemove,
  onClose,
}: {
  toothNumber: number
  existing: ToothConditionDTO[]
  onAdd: (tooth: number, cond: PathologyCondition) => void
  onRemove: (id: string) => void
  onClose: () => void
}) {
  const existingTypes = new Set(existing.map((e) => e.condition_type))
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-lg space-y-3 min-w-[220px]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Diş {toothNumber}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {existing.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Mevcut durumlar</p>
          {existing.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: CONDITION_COLORS[c.condition_type] }}
              />
              <span className="flex-1">{CONDITION_LABELS[c.condition_type]}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => onRemove(c.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Durum ekle</p>
        {ALL_CONDITIONS.filter((c) => !existingTypes.has(c)).map((cond) => (
          <button
            key={cond}
            type="button"
            onClick={() => onAdd(toothNumber, cond)}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: CONDITION_COLORS[cond] }} />
            {CONDITION_LABELS[cond]}
          </button>
        ))}
        {ALL_CONDITIONS.every((c) => existingTypes.has(c)) && (
          <p className="text-xs text-muted-foreground">Tüm durumlar eklenmiş.</p>
        )}
      </div>
    </div>
  )
}

// A row of SVG teeth
function TeethRow({
  teeth,
  condMap,
  onToothClick,
}: {
  teeth: number[]
  condMap: ConditionMap
  onToothClick: (tooth: number) => void
}) {
  return (
    <svg viewBox={`0 0 ${teeth.length * 40} 55`} className="w-full" style={{ minWidth: teeth.length * 28 }}>
      {teeth.map((t, i) => (
        <g key={t} transform={`translate(${i * 40 + 2}, 0)`}>
          <ToothShape
            toothNumber={t}
            conditions={condMap.get(t) ?? []}
            onClick={() => onToothClick(t)}
          />
        </g>
      ))}
    </svg>
  )
}

interface Props {
  sessionId: string
}

export default function PathologyChart({ sessionId }: Props) {
  const [conditions, setConditions] = useState<ToothConditionDTO[]>([])
  const [condMap, setCondMap] = useState<ConditionMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [ambiguousQueue, setAmbiguousQueue] = useState<AmbiguousEntry[]>([])
  const pendingAmbiguous = useRef<ParsedToothCondition[]>([])

  const loadConditions = useCallback(async () => {
    setLoading(true)
    try {
      await refetchConditions()
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Silent refetch — no loading spinner, no unmount of the chart/modal subtree.
  // Used after mutations so the disambiguation queue survives the refresh.
  async function refetchConditions() {
    const res = await fetch(`/api/sessions/${sessionId}/pathology`)
    if (!res.ok) { toast.error('Patoloji chart yüklenemedi.'); return }
    const data = (await res.json()) as { conditions: ToothConditionDTO[] }
    setConditions(data.conditions)
    setCondMap(buildCondMap(data.conditions))
  }

  useEffect(() => { void loadConditions() }, [loadConditions])

  // Auto-parse on mount if no conditions (PATH-02)
  useEffect(() => {
    if (!loading && conditions.length === 0) void triggerParse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function triggerParse() {
    setParsing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pathology`, { method: 'POST' })
      if (!res.ok) { toast.error('Transkript çözümlenemedi.'); return }
      const data = (await res.json()) as { conditions: ToothConditionDTO[]; ambiguous: ParsedToothCondition[] }
      setConditions(data.conditions)
      setCondMap(buildCondMap(data.conditions))

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

  async function handleAddCondition(tooth: number, cond: PathologyCondition) {
    await fetch(`/api/sessions/${sessionId}/pathology`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tooth_number: tooth, condition_type: cond }),
    })
    await loadConditions()
  }

  async function handleRemoveCondition(conditionId: string) {
    await fetch(`/api/sessions/${sessionId}/pathology`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ condition_id: conditionId }),
    })
    await loadConditions()
    setSelectedTooth(null)
  }

  async function handleDisambiguationResolve(index: number, chosenTooth: number) {
    const entry = pendingAmbiguous.current[index]
    // Consume the queue entry immediately — the modal is parent-controlled.
    setAmbiguousQueue((q) => q.filter((e) => e.index !== index))
    if (!entry) return
    const res = await fetch(`/api/sessions/${sessionId}/pathology`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tooth_number: chosenTooth, condition_type: entry.condition_type }),
    })
    if (!res.ok) { toast.error('Durum kaydedilemedi.'); return }
    await refetchConditions()
  }

  function handleDisambiguationSkip(index: number) {
    setAmbiguousQueue((q) => q.filter((e) => e.index !== index))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Patoloji chart yükleniyor…
      </div>
    )
  }

  const selectedConditions = selectedTooth ? (condMap.get(selectedTooth) ?? []) : []

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Patoloji Chartı</h2>
          <p className="text-xs text-muted-foreground">Dişe tıklayarak durum ekleyin veya düzenleyin</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={triggerParse} disabled={parsing}>
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yeniden Çözümle'}
        </Button>
      </div>

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Transkript çözümleniyor…
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-4 overflow-x-auto">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Üst Çene</p>
          <TeethRow teeth={UPPER_TEETH} condMap={condMap} onToothClick={setSelectedTooth} />
        </div>
        <div className="border-t border-border" />
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Alt Çene</p>
          <TeethRow teeth={LOWER_TEETH} condMap={condMap} onToothClick={setSelectedTooth} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {ALL_CONDITIONS.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CONDITION_COLORS[c] }} />
            {CONDITION_LABELS[c]}
          </span>
        ))}
      </div>

      {/* Condition picker panel */}
      {selectedTooth && (
        <div className="fixed bottom-6 right-6 z-50">
          <ConditionPicker
            toothNumber={selectedTooth}
            existing={selectedConditions}
            onAdd={handleAddCondition}
            onRemove={handleRemoveCondition}
            onClose={() => setSelectedTooth(null)}
          />
        </div>
      )}

      <DisambiguationModal
        entries={ambiguousQueue}
        onResolve={handleDisambiguationResolve}
        onSkip={handleDisambiguationSkip}
      />
    </section>
  )
}
