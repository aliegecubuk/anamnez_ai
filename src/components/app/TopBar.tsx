'use client'

import Link from 'next/link'
import { useClerk, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

export default function TopBar() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const email = user?.primaryEmailAddress?.emailAddress ?? '—'
  const initials = (user?.firstName?.[0] ?? email[0] ?? '?').toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      router.push('/sign-in')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/modules"
          className="font-display text-[22px] leading-none tracking-tight inline-flex items-center gap-2.5 text-foreground"
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          AnamnezAl
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
            >
              {initials}
            </span>
            <span className="text-muted-foreground">{email}</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            aria-label="Çıkış yap"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{signingOut ? '...' : 'Çıkış'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
