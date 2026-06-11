'use client'

import { useState } from 'react'
import { Info, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { DescriptionCategory, DentalDescription } from '@/lib/descriptions/types'

interface Props {
  term: string
  category: DescriptionCategory
}

export default function DescriptionPopover({ term, category }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DentalDescription | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchDescription() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, category }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Açıklama yüklenemedi.')
      }
      const desc = (await res.json()) as DentalDescription
      setData(desc)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Açıklama yüklenemedi.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    // Fetch only on first open when no data yet.
    if (next && data === null && !loading && error === null) {
      void fetchDescription()
    }
  }

  function retry() {
    setError(null)
    void fetchDescription()
  }

  const Icon = open ? ChevronUp : ChevronDown

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        className="inline-flex h-auto items-center gap-1 px-2 py-0.5 text-xs font-normal text-muted-foreground hover:text-foreground"
      >
        <Info className="h-3 w-3" />
        {term}
        <Icon className="h-3 w-3" />
      </Button>

      {open && (
        <div className="ml-1 w-full max-w-md rounded-lg border border-border bg-card p-3 text-sm">
          {loading && (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Açıklama yükleniyor…
            </span>
          )}

          {!loading && error && (
            <div className="space-y-2">
              <p className="text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                Tekrar dene
              </Button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-1.5">
              <p>
                <span className="font-medium text-muted-foreground">Diş/cerrahi/anestezi etkisi:</span>{' '}
                {data.dental_impact}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Risk düzeyi:</span>{' '}
                {data.risk_level}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Önerilen önlem:</span>{' '}
                {data.precaution}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{data.disclaimer}</p>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
