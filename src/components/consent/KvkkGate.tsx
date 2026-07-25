'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type KvkkModule = 'dis' | 'hastane'

const MODULE_LABELS: Record<KvkkModule, string> = {
  dis: 'Diş Hekimliği',
  hastane: 'Hastane',
}

// Bump when the KVKK text changes — forces re-consent.
const KVKK_VERSION = 'v1'

const storageKey = (module: KvkkModule, userId: string) =>
  `anamnezal:kvkk:${KVKK_VERSION}:${module}:${userId}`

interface Props {
  module: KvkkModule
  children: ReactNode
}

/**
 * Module-entry KVKK gate: the module UI stays hidden until the clinician reads
 * the aydınlatma metni and ticks the consent box. Acceptance is stored per
 * user + module + text version in localStorage.
 *
 * NOTE: text below is a working draft — Turkish legal counsel review is a
 * pre-production checklist item (CLAUDE.md).
 */
export default function KvkkGate({ module, children }: Props) {
  const { user, isLoaded } = useUser()
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      setAccepted(false)
      return
    }
    try {
      setAccepted(window.localStorage.getItem(storageKey(module, user.id)) === 'true')
    } catch {
      setAccepted(false)
    }
  }, [isLoaded, user, module])

  function handleAccept() {
    if (!checked || !user) return
    try {
      window.localStorage.setItem(storageKey(module, user.id), 'true')
    } catch {
      /* private mode — consent still granted for this page view */
    }
    setAccepted(true)
  }

  // Avoid a flash of the gate (or the module) before localStorage resolves.
  if (accepted === null) return null
  if (accepted) return <>{children}</>

  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            KVKK Aydınlatma ve Onay — {MODULE_LABELS[module]} Modülü
          </h2>
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-input bg-secondary/30 p-4 text-sm leading-relaxed text-foreground">
          <p className="font-semibold">6698 Sayılı KVKK Kapsamında Aydınlatma Metni</p>
          <p>
            Bu modül, hasta görüşmelerinin ses kaydını yazıya döker ve yapay zekâ ile
            yapılandırılmış anamneze çevirir. İşlenen veriler sağlık verisi olup KVKK m.6
            kapsamında özel nitelikli kişisel veridir.
          </p>
          <p>
            <strong>İşlenen veriler:</strong> Görüşme ses kaydı ve yazıya dökülmüş metni,
            anamnez içeriği. Hasta kimlik bilgileri (ad, soyad, TC, telefon) — girildiği
            durumda — cihazda kalır, buluta ve yapay zekâ servislerine gönderilmez; konuşma
            metninde geçmesi hâlinde otomatik maskelenir.
          </p>
          <p>
            <strong>İşleme amacı:</strong> Anamnez oluşturma sürecinin hızlandırılması ve
            klinik dokümantasyonun desteklenmesi. Nihai klinik değerlendirme ve doğrulama
            sorumluluğu hekime aittir.
          </p>
          <p>
            <strong>Yurt dışı aktarım:</strong> Ses ve metin işleme için OpenAI (ABD)
            hizmetleri kullanılır; bu, kişisel verilerin yurt dışına aktarımı anlamına gelir.
          </p>
          <p>
            <strong>Saklama:</strong> Hastane modülünde veriler kalıcı olarak saklanmaz; PDF
            alındığında veya modül sıfırlandığında kimlik, konuşma ve çıktı verileri silinir.
          </p>
          <p>
            <strong>Haklarınız:</strong> KVKK m.11 kapsamındaki taleplerinizi veri
            sorumlusuna iletebilirsiniz. Hasta verisi işlenmeden önce hastanın
            bilgilendirilmesi ve gerekli onamların alınması kullanıcı hekimin
            sorumluluğundadır.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
          <span>
            KVKK Aydınlatma Metni&apos;ni okudum, anladım; kişisel verilerin yukarıda
            belirtilen kapsamda işlenmesini ve yurt dışına aktarımını onaylıyorum.
          </span>
        </label>

        <Button onClick={handleAccept} disabled={!checked} className="h-11 w-full">
          Onaylıyorum ve Devam Et
        </Button>
      </div>
    </div>
  )
}
