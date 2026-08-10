'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  text: string
  onChange?: (value: string) => void
}

/**
 * Medula copy-paste box: the answers as one flowing clinical text, no question
 * headings — matches the free-text anamnesis field in Medula. Directly
 * editable: manual text wins over the card-derived text until the next
 * extraction or reset (see HospitalWorkspace), and flows into copy/PDF/save.
 */
export default function MedulaBox({ text, onChange }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Panoya kopyalandı — Medula anamnez alanına yapıştırın.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Kopyalanamadı — metni elle seçip kopyalayın.')
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-primary/25 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-primary">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-blue-700" />
            Medula
          </p>
          <h2 className="mt-1.5 text-sm font-semibold text-foreground">Kopyala-yapıştır metni</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Başlıksız akıcı klinik metin — Medula serbest metin alanına birebir uygundur.
            Kopyalama, PDF ve kayıt öncesi doğrudan buradan düzenleyebilirsiniz.
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={handleCopy} disabled={!text}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </Button>
      </div>

      <textarea
        value={text}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Henüz metin yok — kaydı işleyin ya da doğrudan buraya yazın."
        rows={4}
        className="min-h-20 w-full resize-y whitespace-pre-wrap rounded-md border border-input bg-secondary/40 px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:italic placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </section>
  )
}
