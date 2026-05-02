import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

  // Verify the active org matches the slug in the URL — prevents cross-tenant navigation
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('clerk_org_id')
    .eq('slug', slug)
    .single()

  if (!tenant || tenant.clerk_org_id !== orgId) {
    redirect('/sign-in?error=wrong_org')
  }

  return <>{children}</>
}
