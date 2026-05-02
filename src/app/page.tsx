import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function RootPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Superadmin → superadmin panel
  if ((sessionClaims?.metadata as Record<string, unknown>)?.role === 'superadmin') {
    redirect('/superadmin')
  }

  // Look up user's first org membership and redirect to their tenant dashboard
  try {
    const client = await clerkClient()
    const { data: memberships } = await client.users.getOrganizationMembershipList({ userId: userId! })

    if (memberships.length > 0) {
      const orgId = memberships[0].organization.id
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('slug')
        .eq('clerk_org_id', orgId)
        .single()

      if (tenant) {
        redirect(`/orgs/${tenant.slug}/dashboard`)
      }
    }
  } catch {
    // fall through to sign-in
  }

  redirect('/sign-in')
}
