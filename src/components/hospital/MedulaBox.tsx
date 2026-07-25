'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  text: string
}

/**
 * Medula copy-paste box: the answers as one flowing clinical text, no question
 * headings — matches the free-text anamnesis field in Medula. Updates live as
 * the cards above are edited.
 */
export default function MedulaBox({ text }: Props) {
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
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={handleCopy} disabled={!text}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </Button>
      </div>

      <div className="min-h-20 whitespace-pre-wrap rounded-md border border-input bg-secondary/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
        {text || <span className="italic text-muted-foreground">Henüz metin yok — kaydı işleyin.</span>}
      </div>
    </section>
  )
}
