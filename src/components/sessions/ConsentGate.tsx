'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  sessionId: string
  onSaved: () => void
}

/**
 * ANAM-06: gates session completion behind two explicit consents.
 * The save button is DISABLED until both checkboxes are checked; the
 * /complete route + DB CHECK are the server-side backstop (T-04-11).
 */
export default function ConsentGate({ sessionId, onSaved }: Props) {
  const [kvkk, setKvkk] = useState(false)
  const [informed, setInformed] = useState(false)
  const [saving, setSaving] = useState(false)

  const bothChecked = kvkk && informed

  async function handleSave() {
    if (!bothChecked || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kvkk_consent: true, informed_consent: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? `Seans kaydedilemedi (${res.status})`)
        return
      }
      toast.success('Seans kaydedildi.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Beklenmeyen hata.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        Onaylar
      </div>

      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={kvkk}
          onChange={(e) => setKvkk(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        <span>
          KVKK veri işleme onayı — hasta sağlık verilerinin işlenmesini onaylıyorum.
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={informed}
          onChange={(e) => setInformed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        <span>Aydınlatılmış onam — hasta bilgilendirildi ve onam alındı.</span>
      </label>

      <Button
        onClick={handleSave}
        disabled={!bothChecked || saving}
        className="h-11 w-full gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Kaydediliyor...
          </>
        ) : (
          'Seansı Kaydet'
        )}
      </Button>
      {!bothChecked && (
        <p className="text-xs text-muted-foreground">
          Kaydetmek için her iki onayı da işaretleyin.
        </p>
      )}
    </div>
  )
}
