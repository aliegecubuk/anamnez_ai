'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import ConsentGate from './ConsentGate'
import DescriptionPopover from './DescriptionPopover'
import { classifyAnswer, extractTerms } from '@/lib/descriptions/classifier'
import type {
  AnamnesisAnswerDTO,
  AnswerValue,
  MissingFieldAlert,
} from '@/lib/anamnesis/types'
import type { SnapshotQuestion } from '@/lib/templates/types'

interface Props {
  sessionId: string
  patientId: string
  questions: SnapshotQuestion[]
  initialAnswers: AnamnesisAnswerDTO[]
  initialMissing: MissingFieldAlert[]
}

interface FieldState {
  answer_value: AnswerValue
  confidence: number | null
  edited_by_human: boolean
}

function isEmpty(value: AnswerValue): boolean {
  if (value === null || value === undefined) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

// 3-tier confidence badge (ANAM-02).
function ConfidenceBadge({ field }: { field: FieldState }) {
  if (field.edited_by_human) {
    return <Badge variant="secondary">Düzenlendi</Badge>
  }
  const c = field.confidence
  if (c === null || c === undefined) return null
  if (c >= 0.8) return <Badge className="bg-emerald-600 text-white">Yüksek</Badge>
  if (c >= 0.5) return <Badge className="bg-amber-500 text-white">Orta</Badge>
  return <Badge variant="destructive">Düşük</Badge>
}

export default function AnamnesisForm({
  sessionId,
  patientId,
  questions,
  initialAnswers,
  initialMissing,
}: Props) {
  const router = useRouter()
  const orderedQuestions = useMemo(
    () => questions.slice().sort((a, b) => a.position - b.position),
    [questions],
  )

  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const map: Record<string, FieldState> = {}
    for (const q of orderedQuestions) {
      const a = initialAnswers.find((x) => x.question_id === q.id)
      map[q.id] = {
        answer_value: a?.answer_value ?? null,
        confidence: a?.confidence ?? null,
        edited_by_human: a?.edited_by_human ?? false,
      }
    }
    return map
  })

  const [filling, setFilling] = useState(false)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ANAM-01: run the AI fill on mount when no answers exist yet.
  useEffect(() => {
    if (initialAnswers.length > 0) return
    let cancelled = false
    setFilling(true)
    fetch(`/api/sessions/${sessionId}/anamnesis`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'AI form doldurma başarısız.')
        }
        return (await res.json()) as { answers: AnamnesisAnswerDTO[] }
      })
      .then((data) => {
        if (cancelled) return
        setFields((prev) => {
          const next = { ...prev }
          for (const a of data.answers) {
            next[a.question_id] = {
              answer_value: a.answer_value,
              confidence: a.confidence,
              edited_by_human: a.edited_by_human,
            }
          }
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'AI form doldurma başarısız.')
      })
      .finally(() => {
        if (!cancelled) setFilling(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // ANAM-03: persist a manual edit (debounced) + mark the field human-edited.
  function persistEdit(questionId: string, value: AnswerValue) {
    if (debounceTimers.current[questionId]) clearTimeout(debounceTimers.current[questionId])
    debounceTimers.current[questionId] = setTimeout(() => {
      fetch(`/api/sessions/${sessionId}/anamnesis`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, answer_value: value }),
      }).catch(() => {
        toast.error('Değişiklik kaydedilemedi.')
      })
    }, 600)
  }

  function updateField(questionId: string, value: AnswerValue) {
    setFields((prev) => ({
      ...prev,
      [questionId]: {
        answer_value: value,
        confidence: null,
        edited_by_human: true,
      },
    }))
    persistEdit(questionId, value)
  }

  // ANAM-04: recompute missing list client-side as fields fill.
  const missing = useMemo<MissingFieldAlert[]>(() => {
    const alerts: MissingFieldAlert[] = []
    for (const q of orderedQuestions) {
      if (!q.required) continue
      if (isEmpty(fields[q.id]?.answer_value ?? null)) {
        alerts.push({ question_id: q.id, prompt: q.prompt })
      }
    }
    return alerts
  }, [fields, orderedQuestions])

  // ANAM-05: focus + scroll a field by question id.
  function focusField(questionId: string) {
    const el = fieldRefs.current[questionId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  function renderInput(q: SnapshotQuestion) {
    const field = fields[q.id]
    const value = field?.answer_value

    if (q.question_type === 'yes_no') {
      const bool = value === true ? true : value === false ? false : null
      return (
        <div className="flex gap-2" ref={(el) => { fieldRefs.current[q.id] = el }} tabIndex={-1}>
          <Button
            type="button"
            size="sm"
            variant={bool === true ? 'default' : 'outline'}
            onClick={() => updateField(q.id, true)}
          >
            Evet
          </Button>
          <Button
            type="button"
            size="sm"
            variant={bool === false ? 'default' : 'outline'}
            onClick={() => updateField(q.id, false)}
          >
            Hayır
          </Button>
        </div>
      )
    }

    if (q.question_type === 'numeric') {
      return (
        <Input
          type="number"
          ref={(el) => { fieldRefs.current[q.id] = el }}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) =>
            updateField(q.id, e.target.value === '' ? null : Number(e.target.value))
          }
          className="max-w-[200px]"
        />
      )
    }

    if (q.question_type === 'multi_select') {
      const selected = Array.isArray(value) ? value : []
      return (
        <div
          className="flex flex-wrap gap-2"
          ref={(el) => { fieldRefs.current[q.id] = el }}
          tabIndex={-1}
        >
          {(q.options ?? []).map((opt) => {
            const on = selected.includes(opt)
            return (
              <Button
                key={opt}
                type="button"
                size="sm"
                variant={on ? 'default' : 'outline'}
                onClick={() =>
                  updateField(
                    q.id,
                    on ? selected.filter((s) => s !== opt) : [...selected, opt],
                  )
                }
              >
                {opt}
              </Button>
            )
          })}
        </div>
      )
    }

    // text
    return (
      <Input
        ref={(el) => { fieldRefs.current[q.id] = el }}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => updateField(q.id, e.target.value === '' ? null : e.target.value)}
      />
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Anamnez Formu</h2>
        {filling && (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI form dolduruyor…
          </span>
        )}
      </div>

      {/* ANAM-04/05: missing-field alerts that focus the field on click. */}
      {missing.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Cevaplanmamış zorunlu sorular ({missing.length})
          </div>
          <ul className="space-y-1">
            {missing.map((m) => (
              <li key={m.question_id}>
                <button
                  type="button"
                  onClick={() => focusField(m.question_id)}
                  className="text-left text-sm text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                >
                  {m.prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-5">
        {orderedQuestions.map((q) => (
          <div key={q.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <label className="text-sm font-medium text-foreground">
                {q.prompt}
                {q.required && <span className="ml-1 text-destructive">*</span>}
              </label>
              <ConfidenceBadge field={fields[q.id]} />
            </div>
            {renderInput(q)}
            {(() => {
              const field = fields[q.id]
              const cat = classifyAnswer({
                prompt: q.prompt,
                question_type: q.question_type,
                answer_value: field?.answer_value ?? null,
              })
              const terms = cat ? extractTerms(field?.answer_value ?? null) : []
              if (!cat || terms.length === 0) return null
              return (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Açıklamalar:</span>
                  {terms.map((t) => (
                    <DescriptionPopover key={t} term={t} category={cat} />
                  ))}
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      <ConsentGate sessionId={sessionId} onSaved={() => router.push(`/patients/${patientId}`)} />
    </section>
  )
}
