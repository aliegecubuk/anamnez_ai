import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  // Server-side auth check — do NOT rely solely on middleware (CVE-2025-29927)
  const { userId, orgId } = await auth()
  const { slug } = await params

  if (!userId) {
    redirect('/sign-in')
  }

  // orgId absent = user has no active org (org activation failed in middleware)
  if (!orgId) {
    redirect('/sign-in?error=no_org')
  }

  return <>{children}</>
}
