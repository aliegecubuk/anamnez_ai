import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import TopBar from '@/components/app/TopBar'
import KvkkGate from '@/components/consent/KvkkGate'
import HospitalWorkspace from '@/components/hospital/HospitalWorkspace'

// Hospital module: voice → anamnesis tool for poliklinik/acil.
// Identity + raw transcript stay on device; the structured output can
// optionally be saved as a labeled, time-boxed record (HospitalHistory).
export default async function HospitalPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <div className="mb-8">
          <Link
            href="/modules"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Modüller
          </Link>
          <h1 className="mt-3 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.05] tracking-tight text-foreground">
            Hastane <em className="font-normal italic text-primary">Anamnez</em>
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
            Hastayı dinle, yapay zekâ konuşulan soru-cevapları çıkarsın; düzelt, Medula&apos;ya
            kopyala veya PDF al. Kimlik cihazında kalır; anamnez çıktısını dilersen etiketleyip
            seçtiğin süre kadar saklayabilir, istediğinde silebilirsin.
          </p>
        </div>

        <KvkkGate module="hastane">
          <HospitalWorkspace />
        </KvkkGate>
      </main>
    </div>
  )
}
