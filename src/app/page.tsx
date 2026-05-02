import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Authenticated superadmin → superadmin panel
  if ((sessionClaims?.metadata as Record<string, unknown>)?.role === 'superadmin') {
    redirect('/superadmin')
  }

  // Authenticated regular user on root domain — redirect to sign-in
  // (they should be on their tenant subdomain)
  redirect('/sign-in')
}
