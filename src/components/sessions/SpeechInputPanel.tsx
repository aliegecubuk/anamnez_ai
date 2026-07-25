'use client'

// "Konuşma Girişi" — competitor-style speech input panel.
// Every STT sentence is an editable row; the hekim can fix, delete, or type new
// sentences without a microphone. This list is the single source the "İşle"
// parsers read from (it IS the transcript_segments table).

import { useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

interface Props {
  sessionId: string
  initialSegments: TranscriptSegmentDTO[]
  liveSegments?: TranscriptSegmentDTO[]
  editable?: boolean
  connected?: boolean
}

export default function SpeechInputPanel({
  sessionId,
  initialSegments,
  liveSegments = [],
  editable = true,
  connected,
}: Props) {
  const [added, setAdded] = useState<TranscriptSegmentDTO[]>([])
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [deleted, setDeleted] = useState<Set<number>>(new Set())
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const segments = useMemo(() => {
    const bySequence = new Map<number, TranscriptSegmentDTO>()
    for (const s of initialSegments) bySequence.set(s.sequence, s)
    for (const s of liveSegments) bySequence.set(s.sequence, s)
    for (const s of added) bySequence.set(s.sequence, s)
    return [...bySequence.values()]
      .filter((s) => !deleted.has(s.sequence))
      .filter((s) => s.content.trim().length > 0)
      .map((s) => (edits[s.sequence] !== undefined ? { ...s, content: edits[s.sequence] } : s))
      .sort((a, b) => a.sequence - b.sequence)
  }, [initialSegments, liveSegments, added, edits, deleted])

  async function addSentence() {
    const content = draft.trim()
    if (!content) return
    setAdding(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Cümle eklenemedi.')
      }
      const seg = (await res.json()) as TranscriptSegmentDTO
      setAdded((prev) => [...prev, seg])
      setDraft('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cümle eklenemedi.')
    } finally {
      setAdding(false)
    }
  }

  function editLocal(sequence: number, content: string) {
    setEdits((prev) => ({ ...prev, [sequence]: content }))
  }

  async function persistEdit(seg: TranscriptSegmentDTO) {
    const content = (edits[seg.sequence] ?? seg.content).trim()
    if (content === seg.content) return
    if (!content) {
      await removeSentence(seg.sequence)
      return
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transcript`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: seg.sequence, content }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Cümle güncellenemedi.')
    }
  }

  async function removeSentence(sequence: number) {
    setDeleted((prev) => new Set(prev).add(sequence))
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/transcript?sequence=${sequence}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Cümle silinemedi.')
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Konuşma Girişi</h2>
          {connected !== undefined && (
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`}
              title={connected ? 'Canlı' : 'Bağlantı yeniden kuruluyor'}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Mikrofonla ya da yazarak konuşmayı ekleyin. Satırları düzeltebilirsiniz; &quot;İşle ve
          Düzenle&quot; bu listeyi okur.
        </p>
      </div>

      <div className="space-y-2">
        {segments.length === 0 && (
          <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
            Mikrofonu başlatın ya da aşağıdan cümle ekleyin.
          </p>
        )}
        {segments.map((seg) => (
          <div key={seg.sequence} className="flex items-center gap-2">
            <Input
              value={seg.content}
              readOnly={!editable}
              onChange={(e) => editLocal(seg.sequence, e.target.value)}
              onBlur={() => persistEdit(seg)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              className="h-9 bg-muted/40 text-sm"
            />
            {editable && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeSentence(seg.sequence)}
                aria-label="Cümleyi sil"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            placeholder="Ham cümle ekleyin… (Enter ile ekle)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSentence()
            }}
            className="h-10"
          />
          <Button type="button" onClick={addSentence} disabled={adding} className="gap-1.5">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ekle
          </Button>
        </div>
      )}
    </section>
  )
}
