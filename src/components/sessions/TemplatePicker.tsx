'use client'

import { useEffect, useState } from 'react'
import { Loader2, FileText, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TemplateListItem } from '@/lib/templates/types'

const DEPARTMENT_LABELS: Record<string, string> = {
  genel: 'Genel',
  periodontoloji: 'Periodontoloji',
  pedodonti: 'Pedodonti',
  endodonti: 'Endodonti',
  cerrahi: 'Cerrahi',
  ortodonti: 'Ortodonti',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // versionId is null when the dentist chooses to start without a template.
  onSelect: (versionId: string | null) => void
}

/**
 * TPLT-05: lets the dentist pick a published template at session start.
 * Only templates with a published version (latest_version_id != null) are
 * selectable; the chosen template's latest_version_id is returned and bound
 * to the session via CreateSessionBody.template_version_id.
 */
export default function TemplatePicker({ open, onOpenChange, onSelect }: Props) {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch('/api/templates')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Şablonlar yüklenemedi (${res.status})`)
        return (await res.json()) as TemplateListItem[]
      })
      .then((items) => {
        if (cancelled) return
        // Only published templates are usable for a session.
        setTemplates(items.filter((t) => t.latest_version_id !== null))
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Şablonlar yüklenemedi.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const selected = templates.find((t) => t.id === selectedId)

  function confirmTemplate() {
    if (!selected?.latest_version_id) return
    onSelect(selected.latest_version_id)
    onOpenChange(false)
  }

  function startWithout() {
    onSelect(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Anamnez Şablonu Seç</DialogTitle>
          <DialogDescription>
            Seans bu yayınlanmış şablon sürümüne bağlanır. Şablonsuz başlatırsanız AI form
            doldurma çalışmaz.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Şablonlar yükleniyor...
            </div>
          ) : templates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Yayınlanmış şablon yok. Şablonsuz başlatabilirsiniz.
            </p>
          ) : (
            templates.map((t) => {
              const isSelected = t.id === selectedId
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {DEPARTMENT_LABELS[t.department] ?? t.department} · {t.question_count} soru
                    </span>
                  </span>
                  <Badge variant="secondary">v{t.current_version}</Badge>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={startWithout}>
            Şablonsuz Başlat
          </Button>
          <Button type="button" onClick={confirmTemplate} disabled={!selected}>
            Bu Şablonla Başlat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
