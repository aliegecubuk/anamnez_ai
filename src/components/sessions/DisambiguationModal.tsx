'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export interface AmbiguousEntry {
  raw_mention: string
  candidates: number[]
  index: number      // position in queue for tracking
}

interface Props {
  entries: AmbiguousEntry[]
  onResolve: (index: number, chosenTooth: number) => void
  onSkip: (index: number) => void
}

// Fallback when the parser returns an ambiguous entry with no candidates
// (model failed to list guesses): offer the full FDI set so the hekim can
// always resolve instead of being forced to skip.
const ALL_FDI_TEETH = [
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
]

// The queue is parent-controlled: every resolve/skip MUST remove the entry in
// the parent, and the modal always shows entries[0]. Keeping progress in local
// state broke whenever the parent re-rendered/unmounted the modal (the entry
// came back forever — the infinite "Diş Numarası Belirsiz" loop).
export default function DisambiguationModal({ entries, onResolve, onSkip }: Props) {
  const entry = entries[0]
  if (!entry) return null

  const candidates = entry.candidates.length > 0 ? entry.candidates : ALL_FDI_TEETH

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <DialogTitle>Diş Numarası Belirsiz</DialogTitle>
          </div>
          <DialogDescription>
            Transkriptte <span className="font-medium text-foreground">&quot;{entry.raw_mention}&quot;</span> ifadesinin
            hangi dişe ait olduğu belirsiz. Lütfen doğru dişi seçin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {entries.length} belirsiz ifade kaldı
          </p>
          {entry.candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aday önerilemedi — doğru dişi listeden seçin.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {candidates.map((tooth) => (
              <Button
                key={tooth}
                type="button"
                variant="outline"
                onClick={() => onResolve(entry.index, tooth)}
                className="min-w-[52px]"
              >
                Diş {tooth}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => onSkip(entry.index)}
          >
            Bu ifadeyi atla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
