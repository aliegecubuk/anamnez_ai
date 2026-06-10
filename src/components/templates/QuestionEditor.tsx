'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Rocket, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { VALID_QUESTION_TYPES } from '@/lib/templates/types'
import type { QuestionType, TemplateQuestionRow } from '@/lib/templates/types'

const TYPE_LABELS: Record<QuestionType, string> = {
  yes_no: 'Evet/Hayır',
  text: 'Metin',
  multi_select: 'Çoklu Seçim',
  numeric: 'Sayısal',
}

interface QuestionDraft {
  prompt: string
  question_type: QuestionType
  options: string[]
  required: boolean
}

const EMPTY_DRAFT: QuestionDraft = {
  prompt: '',
  question_type: 'yes_no',
  options: [],
  required: false,
}

interface Props {
  templateId: string
  initialQuestions: TemplateQuestionRow[]
  currentVersion: number
}

function draftFromRow(q: TemplateQuestionRow): QuestionDraft {
  return {
    prompt: q.prompt,
    question_type: q.question_type,
    options: q.options ?? [],
    required: q.required,
  }
}

function draftToBody(d: QuestionDraft) {
  return {
    prompt: d.prompt.trim(),
    question_type: d.question_type,
    options:
      d.question_type === 'multi_select'
        ? d.options.map((o) => o.trim()).filter(Boolean)
        : null,
    required: d.required,
  }
}

export default function QuestionEditor({ templateId, initialQuestions, currentVersion }: Props) {
  const router = useRouter()
  const [questions, setQuestions] = useState<TemplateQuestionRow[]>(initialQuestions)
  const [newDraft, setNewDraft] = useState<QuestionDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<QuestionDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const apiBase = `/api/templates/${templateId}/questions`

  // ---- Add ----
  const addQuestion = async () => {
    setBusy(true)
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToBody(newDraft)),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Soru eklenemedi.')
        return
      }
      const created: TemplateQuestionRow = await res.json()
      setQuestions((prev) => [...prev, created])
      setNewDraft(EMPTY_DRAFT)
      toast.success('Soru eklendi.')
    } catch {
      toast.error('Soru eklenemedi. Bağlantıyı kontrol edin.')
    } finally {
      setBusy(false)
    }
  }

  // ---- Edit ----
  const saveEdit = async (questionId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`${apiBase}/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToBody(editDraft)),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Soru güncellenemedi.')
        return
      }
      const updated: TemplateQuestionRow = await res.json()
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)))
      setEditingId(null)
      toast.success('Soru güncellendi.')
    } catch {
      toast.error('Soru güncellenemedi. Bağlantıyı kontrol edin.')
    } finally {
      setBusy(false)
    }
  }

  // ---- Delete ----
  const deleteQuestion = async (questionId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`${apiBase}/${questionId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Soru silinemedi.')
        return
      }
      setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      toast.success('Soru silindi.')
    } catch {
      toast.error('Soru silinemedi. Bağlantıyı kontrol edin.')
    } finally {
      setBusy(false)
    }
  }

  // ---- Reorder (up/down) ----
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    ;[next[index], next[target]] = [next[target], next[index]]
    setQuestions(next) // optimistic
    setBusy(true)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((q) => q.id) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Sıralama kaydedilemedi.')
        setQuestions(questions) // rollback
        return
      }
      const updated: TemplateQuestionRow[] = await res.json()
      setQuestions(updated)
    } catch {
      toast.error('Sıralama kaydedilemedi. Bağlantıyı kontrol edin.')
      setQuestions(questions)
    } finally {
      setBusy(false)
    }
  }

  // ---- Publish ----
  const publish = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/templates/${templateId}/publish`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'Yayınlama başarısız oldu.')
        return
      }
      toast.success(`v${body.version} yayınlandı`)
      router.refresh()
    } catch {
      toast.error('Yayınlama başarısız oldu. Bağlantıyı kontrol edin.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section className="space-y-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[26px] leading-tight tracking-tight text-foreground">
            Sorular
          </h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {questions.length} soru
          </span>
        </div>
        <Button onClick={publish} disabled={publishing || questions.length === 0} className="h-10 gap-2">
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          Yayınla (v{currentVersion + 1})
        </Button>
      </div>

      {/* Question list */}
      {questions.length === 0 ? (
        <p className="border-y border-border py-10 text-center text-muted-foreground">
          Henüz soru yok. Aşağıdaki formdan ilk soruyu ekle.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {questions.map((q, i) => (
            <li key={q.id} className="py-4">
              {editingId === q.id ? (
                <div className="space-y-3">
                  <DraftFields
                    draft={editDraft}
                    onChange={setEditDraft}
                    idPrefix={`edit-${q.id}`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(q.id)} disabled={busy}>
                      Kaydet
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                    >
                      <X className="h-4 w-4" />
                      İptal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[15px] text-foreground truncate">
                      <span className="text-muted-foreground tabular-nums mr-2">{i + 1}.</span>
                      {q.prompt}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{TYPE_LABELS[q.question_type]}</Badge>
                      {q.required && <Badge variant="outline">Zorunlu</Badge>}
                      {q.question_type === 'multi_select' && q.options && (
                        <span className="text-xs text-muted-foreground truncate">
                          {q.options.join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Yukarı taşı"
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Aşağı taşı"
                      onClick={() => move(i, 1)}
                      disabled={busy || i === questions.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Düzenle"
                      onClick={() => {
                        setEditingId(q.id)
                        setEditDraft(draftFromRow(q))
                      }}
                      disabled={busy}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Sil"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteQuestion(q.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Separator />

      {/* Add form */}
      <div className="space-y-4">
        <h3 className="font-display text-[20px] leading-tight tracking-tight text-foreground">
          Soru Ekle
        </h3>
        <DraftFields draft={newDraft} onChange={setNewDraft} idPrefix="new" />
        <Button
          onClick={addQuestion}
          disabled={busy || !newDraft.prompt.trim()}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Soru Ekle
        </Button>
      </div>
    </section>
  )
}

// Shared field group for both the add form and inline edit.
function DraftFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: QuestionDraft
  onChange: (d: QuestionDraft) => void
  idPrefix: string
}) {
  const setOption = (i: number, value: string) => {
    const options = [...draft.options]
    options[i] = value
    onChange({ ...draft, options })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-prompt`}>Soru metni</Label>
          <Input
            id={`${idPrefix}-prompt`}
            placeholder="Örn: Bilinen bir alerjiniz var mı?"
            value={draft.prompt}
            onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Soru tipi</Label>
          <select
            id={`${idPrefix}-type`}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            value={draft.question_type}
            onChange={(e) => {
              const question_type = e.target.value as QuestionType
              onChange({
                ...draft,
                question_type,
                options:
                  question_type === 'multi_select' && draft.options.length === 0
                    ? ['']
                    : draft.options,
              })
            }}
          >
            {VALID_QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-foreground select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={draft.required}
            onChange={(e) => onChange({ ...draft, required: e.target.checked })}
          />
          Zorunlu
        </label>
      </div>

      {draft.question_type === 'multi_select' && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>Seçenekler</Label>
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Seçenek ${i + 1}`}
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Seçeneği kaldır"
                onClick={() =>
                  onChange({ ...draft, options: draft.options.filter((_, j) => j !== i) })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onChange({ ...draft, options: [...draft.options, ''] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Seçenek ekle
          </Button>
        </div>
      )}
    </div>
  )
}
