import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  heading: string
  subheading?: string
}

// Two-pane auth layout. Restrained: porcelain throughout, typography carries identity.
// Single hairline accent in primary tone marks the seam.
export default function AuthShell({ children, heading, subheading }: Props) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_1fr] bg-background">
      {/* Hero pane — quiet porcelain with editorial type */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-border bg-card">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-display text-[26px] leading-none tracking-tight text-foreground"
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          AnamnezAl
        </Link>

        <div className="space-y-7 max-w-[34ch]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground inline-flex items-center gap-3">
            <span aria-hidden className="inline-block h-px w-8 bg-primary" />
            Sesli diş anamnezi
          </p>
          <h2 className="font-display leading-[0.98] tracking-tight text-foreground text-[clamp(2.6rem,4.6vw,4.4rem)]">
            Sesin yeter.{' '}
            <em className="italic font-normal text-primary">
              Form kendini doldursun.
            </em>
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground max-w-[44ch]">
            Diş hekimi konuşur, AnamnezAl dinler. Anamnez formu, periodontoloji ve patoloji
            chartları hands-free dolar. Eldiven çıkarmak, kalem tutmak, ekrana dokunmak yok.
          </p>
        </div>

        <div className="flex items-end justify-between gap-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>KVKK uyumlu · Frankfurt</span>
          <span className="font-mono normal-case tracking-normal text-[10px] text-muted-foreground/80">
            v0.1 · test
          </span>
        </div>
      </aside>

      {/* Form pane */}
      <main className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="lg:hidden mb-10 inline-flex items-center gap-2.5 font-display text-[24px] leading-none tracking-tight text-foreground"
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            AnamnezAl
          </Link>

          <div className="mb-9 space-y-2">
            <h1 className="font-display text-[clamp(2.2rem,3.6vw,2.8rem)] leading-[1.05] tracking-tight text-foreground">
              {heading}
            </h1>
            {subheading && (
              <p className="text-[15px] text-muted-foreground">{subheading}</p>
            )}
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
