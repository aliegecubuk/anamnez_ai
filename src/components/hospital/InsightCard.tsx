'use client'

import { AlertTriangle, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AI_INSIGHT_DISCLAIMER, type HospitalInsightResult } from '@/lib/hospital/types'

export type InsightState = 'idle' | 'loading' | 'error' | 'done'

interface Props {
  state: InsightState
  insight: HospitalInsightResult | null
  canGenerate: boolean
  onGenerate: () => void
}

/**
 * AI clinical insight card: one flowing summary paragraph + differential
 * diagnoses + red flags. Screen-only for differentials/red flags — the PDF
 * carries just the summary. The disclaimer stays fixed at the card bottom.
 */
export default function InsightCard({ state, insight, canGenerate, onGenerate }: Props) {
  const loading = state === 'loading'

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Klinik Özet + Ayırıcı Tanı
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-2 text-muted-foreground"
          onClick={onGenerate}
          disabled={loading || !canGenerate}
          title={canGenerate ? undefined : 'Önce anamnezi işleyin'}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {state === 'done' || state === 'error' ? 'Yeniden Üret' : 'Üret'}
        </Button>
      </div>

      {state === 'idle' && (
        <p className="text-xs text-muted-foreground">
          Kayıt işlenince özet otomatik üretilir; düzenlemelerinizle tekrar üretebilirsiniz.
        </p>
      )}

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Klinik özet üretiliyor...
        </p>
      )}

      {state === 'error' && (
        <p className="text-sm text-muted-foreground">
          Özet üretilemedi — <button type="button" className="underline" onClick={onGenerate}>tekrar deneyin</button>.
        </p>
      )}

      {state === 'done' && insight && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground">{insight.summary}</p>

          {insight.differentials.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Olası Ayırıcı Tanılar
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                {insight.differentials.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.red_flags.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Kırmızı Bayraklar
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                {insight.red_flags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {AI_INSIGHT_DISCLAIMER}
      </p>
    </section>
  )
}
