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
const KVKK_VERSION = 'v2'

const storageKey = (module: KvkkModule, userId: string) =>
  `anamnezal:kvkk:${KVKK_VERSION}:${module}:${userId}`

// Module-specific aydınlatma metinleri. The 'hastane' text was strengthened in
// v2 alongside the record-history feature (labeled, time-boxed storage).
const MODULE_TEXTS: Record<KvkkModule, ReactNode> = {
  dis: (
    <>
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
    </>
  ),
  hastane: (
    <>
      <p className="font-semibold">
        6698 Sayılı KVKK Kapsamında Aydınlatma Metni — Hastane Anamnez Modülü
      </p>
      <p>
        <strong>Veri Sorumlusu:</strong> [Veri Sorumlusu Unvanı] — İletişim: [iletişim
        e-postası]
      </p>
      <p>
        <strong>İşlenen veri kategorileri:</strong> Hasta görüşmesinin ses kaydı ile
        yazıya dökülmüş metni; bu metinden yapay zekâ ile üretilen yapılandırılmış anamnez
        çıktısı (soru-cevap kartları, fizik muayene bulguları, Medula metni, klinik özet) ve
        kayıt için verdiğiniz etiket. Bu veriler sağlık verisi olup KVKK m.6 kapsamında özel
        nitelikli kişisel veridir. Hasta kimlik bilgileri (ad, soyad, TC, telefon) yalnızca
        cihazınızda işlenir; sunucuya ve yapay zekâ servislerine gönderilmez, konuşma
        metninde geçmesi hâlinde otomatik olarak maskelenir.
      </p>
      <p>
        <strong>İşleme amacı ve hukuki sebep:</strong> Anamnez oluşturma sürecinin
        hızlandırılması ve klinik dokümantasyonun desteklenmesi. Özel nitelikli kişisel
        veriler, KVKK m.6/2 uyarınca açık rızanıza dayanılarak işlenir. Nihai klinik
        değerlendirme ve doğrulama sorumluluğu hekime aittir.
      </p>
      <p>
        <strong>Aktarım:</strong> Ses ve metin işleme için OpenAI (ABD) hizmetleri
        kullanılır; kayıtlarınız Supabase (Avrupa Birliği / Frankfurt) sunucularında
        saklanır. Bu kapsamda kişisel verileriniz, açık rızanıza dayanarak yurt dışına
        aktarılır.
      </p>
      <p>
        <strong>Saklama süresi:</strong> Ses kaydı ve ham konuşma metni saklanmaz. Yalnızca
        siz &quot;Kaydet&quot; dediğinizde yapılandırılmış anamnez çıktısı, seçtiğiniz saklama
        süresi (30/90/120/240/365 gün) sonunda otomatik olarak silinmek üzere saklanır.
        &quot;Otomatik silme yok&quot; seçiliyse kayıt, siz silene kadar saklanır.
        Kayıtlarınızı dilediğiniz zaman Geçmiş Kayıtlar bölümünden silebilirsiniz.
      </p>
      <p>
        <strong>Haklarınız (KVKK m.11):</strong> Kişisel verilerinizin işlenip
        işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme; işlenme amacını ve
        amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında
        aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini ve
        KVKK m.7 kapsamında silinmesini/yok edilmesini isteme; bu işlemlerin verilerin
        aktarıldığı üçüncü kişilere bildirilmesini isteme; işlemenin otomatik sistemlerle
        analizi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme; kanuna aykırı
        işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme
        haklarına sahipsiniz.
      </p>
      <p>
        <strong>Başvuru yöntemi:</strong> KVKK m.11 kapsamındaki taleplerinizi [iletişim
        e-postası] adresine yazılı olarak iletebilirsiniz; başvurular niteliğine göre en geç
        30 gün içinde yanıtlanır. Hasta verisi işlenmeden önce hastanın bilgilendirilmesi ve
        gerekli onamların alınması kullanıcı hekimin sorumluluğundadır.
      </p>
    </>
  ),
}

const CONSENT_LABELS: Record<KvkkModule, string> = {
  dis: 'KVKK Aydınlatma Metni\u2019ni okudum, anladım; kişisel verilerin yukarıda belirtilen kapsamda işlenmesini ve yurt dışına aktarımını onaylıyorum.',
  hastane:
    'KVKK Aydınlatma Metni\u2019ni okudum, anladım; sağlık verileri dahil kişisel verilerin yukarıda belirtilen kapsamda işlenmesine ve yurt dışına aktarılmasına açık rıza veriyorum.',
}

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
 * pre-production checklist item (CLAUDE.md / .planning/STATE.md).
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
          {MODULE_TEXTS[module]}
        </div>

        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Not: Bu metin taslaktır; hukuk müşaviri incelemesi devam etmektedir ve üretime
          alınmadan önce güncellenecektir.
        </p>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
          <span>{CONSENT_LABELS[module]}</span>
        </label>

        <Button onClick={handleAccept} disabled={!checked} className="h-11 w-full">
          Onaylıyorum ve Devam Et
        </Button>
      </div>
    </div>
  )
}
