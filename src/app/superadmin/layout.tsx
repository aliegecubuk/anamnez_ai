import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionClaims } = await auth()

  // Server-side superadmin check — required in addition to middleware (CVE-2025-29927)
  // sessionClaims.metadata requires Clerk Dashboard session token customization:
  // Clerk → Configure → Sessions → Customize: { "metadata": "{{user.public_metadata}}" }
  const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined
  if (metadata?.role !== 'superadmin') {
    redirect('/sign-in')
  }

  return <>{children}</>
}
