'use client'

import { SignIn, useSession } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Clerk redirects sessions with pending tasks (e.g. forced MFA setup) here.
// Render Clerk's hosted SignIn component so it can show the task UI and clear it.
// Once tasks resolve, Clerk routes the user via fallbackRedirectUrl='/'.
export default function SignInTasksPage() {
  const { session, isLoaded } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return
    if (!session) {
      router.replace('/sign-in')
      return
    }
    if (session.status === 'active') {
      router.replace('/')
    }
  }, [isLoaded, session, router])

  if (!isLoaded || !session || session.status === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-sm text-muted-foreground">Yönlendiriliyor...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-[440px] space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-[32px] leading-tight tracking-tight text-foreground">
            Bir adım daha.
          </h1>
          <p className="text-sm text-muted-foreground">
            Hesabını doğrula, dashboard&apos;a geçelim.
          </p>
        </div>
        <SignIn routing="virtual" fallbackRedirectUrl="/" forceRedirectUrl="/" />
      </div>
    </div>
  )
}
