import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import TopBar from '@/components/app/TopBar'

// Module selection — the first screen after sign-in. Editorial rows (same
// language as the dashboard), one accent dot per module: diş=teal, hastane=mavi.
export default async function ModulesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <section className="mb-12 lg:mb-16">
          <p className="mb-3 inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span aria-hidden className="inline-block h-px w-7 bg-primary" />
            Modüller
          </p>
          <h1 className="font-display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[1.05] tracking-tight text-foreground">
            Nerede çalışıyorsun?
          </h1>
          <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-muted-foreground">
            Sesle dolan anamnez — çalıştığın ortama göre modülünü seç.
          </p>
        </section>

        <section className="border-y border-border">
          <ModuleRow
            href="/dashboard"
            dotClass="bg-teal-600"
            title="Diş"
            note="Anamnez, periodontoloji ve patoloji chartları. Hasta kayıtlı, seans geçmişli."
          />
          <ModuleRow
            href="/hospital"
            dotClass="bg-blue-700"
            title="Hastane"
            note="Poliklinik ve acil için hızlı anamnez. Medula metni, PDF, kayıt tutulmaz."
          />
        </section>

        <footer className="mt-20 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>KVKK uyumlu · Frankfurt eu-central-1</span>
          <span className="font-mono normal-case tracking-normal">v0.1 · test</span>
        </footer>
      </main>
    </div>
  )
}

function ModuleRow({
  href,
  dotClass,
  title,
  note,
}: {
  href: string
  dotClass: string
  title: string
  note: string
}) {
  return (
    <Link
      href={href}
      className="group -mx-6 block border-b border-border px-6 py-9 transition-colors last:border-b-0 hover:bg-secondary/40"
    >
      <div className="flex items-start justify-between gap-8">
        <div className="max-w-[52ch] space-y-2.5">
          <p className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
            Modül
          </p>
          <h2 className="font-display text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.05] tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{note}</p>
        </div>
        <ArrowUpRight
          className="mt-4 h-7 w-7 flex-shrink-0 text-muted-foreground transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-primary"
          aria-hidden
        />
      </div>
    </Link>
  )
}
