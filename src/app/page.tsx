import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  // treatPendingAsSignedOut:false so pending sessions still resolve userId,
  // letting us route them to the task completion page instead of the sign-in page.
  const { userId, sessionClaims, sessionStatus } = await auth({ treatPendingAsSignedOut: false })

  if (!userId) redirect('/sign-in')
  if (sessionStatus === 'pending') redirect('/sign-in/tasks')

  const role = (sessionClaims?.metadata as Record<string, unknown>)?.role
  if (role === 'superadmin') redirect('/superadmin')

  redirect('/dashboard')
}
