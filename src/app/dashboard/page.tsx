import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import TopBar from '@/components/app/TopBar'
import KvkkGate from '@/components/consent/KvkkGate'

async function getStats(userId: string) {
  const [{ count: patientCount }, { data: lastPatient }] = await Promise.all([
    supabaseAdmin
      .from('patients')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', userId),
    supabaseAdmin
      .from('patients')
      .select('full_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  return {
    patients: patientCount ?? 0,
    lastPatient: lastPatient ?? null,
  }
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'henüz kayıt yok'
  const d = new Date(iso)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (diffMin < 1) return 'az önce'
  if (diffMin < 60) return `${diffMin} dakika önce`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} saat önce`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} gün önce`
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Clerk profile fetch and Supabase stats are independent — overlap them.
  const [user, stats] = await Promise.all([currentUser(), getStats(userId)])
  const firstName =
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ??
    'doktor'

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <div className="mb-8">
          <Link
            href="/modules"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Modüller
          </Link>
        </div>
        <KvkkGate module="dis">
        {/* Greeting */}
        <section className="mb-16 lg:mb-20">
          <p className="mb-3 inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span aria-hidden className="inline-block h-px w-7 bg-primary" />
            Bugün
          </p>
          <h1 className="font-display text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.02] tracking-tight text-foreground">
            Hoş geldin,{' '}
            <em className="italic font-normal text-primary">{firstName}</em>.
          </h1>
          <p className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-muted-foreground">
            Sesle dolan diş anamnezi. Hastanı seç, kaydı başlat, formun ve chartların
            kendiliğinden dolmasını izle. Ellerin hastada, gözün hastada kalsın.
          </p>
        </section>

        {/* Stat strip */}
        <section className="mb-14 grid grid-cols-1 gap-y-7 sm:grid-cols-3 sm:gap-x-10 border-y border-border py-7">
          <StatRow label="Hastalar" value={stats.patients.toString()} hint={stats.lastPatient?.full_name ?? '—'} />
          <StatRow label="Son kayıt" value={formatRelative(stats.lastPatient?.created_at)} />
          <StatRow label="Aktif modül" value="1" hint="hasta yönetimi" />
        </section>

        {/* Primary editorial block */}
        <Link
          href="/patients"
          className="group block py-10 border-b border-border transition-colors hover:bg-secondary/40 -mx-6 px-6"
        >
          <div className="flex items-start justify-between gap-8">
            <div className="space-y-3 max-w-[52ch]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Asıl iş</p>
              <h2 className="font-display text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.05] tracking-tight text-foreground">
                Hastalar
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Yeni hasta ekle, kayıtlıları ad veya TC ile ara, profilden seans geçmişini
                incele. KVKK için TC her yerde maskeli.
              </p>
            </div>
            <ArrowUpRight
              className="mt-4 h-7 w-7 flex-shrink-0 text-muted-foreground transition-all duration-300 ease-out group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1"
              aria-hidden
            />
          </div>
        </Link>

        <footer className="mt-20 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>KVKK uyumlu · Frankfurt eu-central-1</span>
          <span className="font-mono normal-case tracking-normal">v0.1 · test</span>
        </footer>
        </KvkkGate>
      </main>
    </div>
  )
}

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-[40px] leading-none tracking-tight text-foreground">{value}</p>
      {hint && (
        <p className="mt-1.5 truncate text-sm text-muted-foreground" title={hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
