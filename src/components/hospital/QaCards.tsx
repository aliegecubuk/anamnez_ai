'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { HospitalEntry } from '@/lib/hospital/types'

interface Props {
  entries: HospitalEntry[]
  onChange: (id: string, field: 'question' | 'answer', value: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

/**
 * Editable question/answer cards. Every keystroke propagates up so the Medula
 * text and PDF stay in sync instantly.
 */
export default function QaCards({ entries, onChange, onDelete, onAdd }: Props) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Input
              value={entry.question}
              onChange={(e) => onChange(entry.id, 'question', e.target.value)}
              placeholder="Başlık (örn. Şikâyet)"
              className="h-8 border-transparent bg-transparent px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground focus-visible:border-input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(entry.id)}
              aria-label="Satırı sil"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <textarea
            value={entry.answer}
            onChange={(e) => onChange(entry.id, 'answer', e.target.value)}
            placeholder="Cevap"
            rows={2}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ))}

      <Button variant="outline" size="sm" className="gap-2" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Satır Ekle
      </Button>
    </div>
  )
}
