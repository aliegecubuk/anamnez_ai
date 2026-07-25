'use client'

import { ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HospitalIdentity } from '@/lib/hospital/types'

interface Props {
  identity: HospitalIdentity
  onChange: (identity: HospitalIdentity) => void
}

/**
 * Patient identity — device-only. These values are never sent to the AI or any
 * server; they are used to mask the transcript and to stamp the PDF header.
 */
export default function IdentityPanel({ identity, onChange }: Props) {
  const set = (field: keyof HospitalIdentity) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...identity, [field]: e.target.value })

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Hasta Kimliği</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Cihazda kalır
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hosp-first-name">Ad</Label>
          <Input
            id="hosp-first-name"
            value={identity.firstName}
            onChange={set('firstName')}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hosp-last-name">Soyad</Label>
          <Input
            id="hosp-last-name"
            value={identity.lastName}
            onChange={set('lastName')}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hosp-tc">TC Kimlik No</Label>
          <Input
            id="hosp-tc"
            value={identity.tcNo}
            onChange={set('tcNo')}
            inputMode="numeric"
            maxLength={11}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hosp-phone">Telefon</Label>
          <Input
            id="hosp-phone"
            value={identity.phone}
            onChange={set('phone')}
            inputMode="tel"
            autoComplete="off"
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Kimlik bilgileri buluta ve yapay zekâya gönderilmez; yalnızca PDF çıktısına eklenir.
        Konuşma metninde geçerse otomatik maskelenir.
      </p>
    </section>
  )
}
