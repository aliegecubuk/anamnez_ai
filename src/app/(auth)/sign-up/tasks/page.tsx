'use client'

import { SignIn, useSession } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Mirror of /sign-in/tasks — Clerk routes some pending-task flows under /sign-up/tasks.
export default function SignUpTasksPage() {
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
