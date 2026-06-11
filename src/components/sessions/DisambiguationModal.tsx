'use client'

import { useState } from 'react'
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

export default function DisambiguationModal({ entries, onResolve, onSkip }: Props) {
  const [current, setCurrent] = useState(0)
  const open = current < entries.length
  const entry = entries[current]

  if (!open || !entry) return null

  function handleChoice(tooth: number) {
    onResolve(entry.index, tooth)
    setCurrent((c) => c + 1)
  }

  function handleSkip() {
    onSkip(entry.index)
    setCurrent((c) => c + 1)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
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
            {current + 1} / {entries.length} belirsiz ifade
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.candidates.map((tooth) => (
              <Button
                key={tooth}
                type="button"
                variant="outline"
                onClick={() => handleChoice(tooth)}
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
            onClick={handleSkip}
          >
            Bu ifadeyi atla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
