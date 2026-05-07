import { auth } from '@clerk/nextjs/server'

// Test mode: only superadmin role exists. Everyone else is a standard user.
// Multi-tenant org roles deferred until post-validation pivot.
export type AppRole = 'superadmin' | 'user'

export async function getRole(): Promise<AppRole> {
  const { sessionClaims } = await auth()
  if ((sessionClaims?.metadata as Record<string, unknown>)?.role === 'superadmin') {
    return 'superadmin'
  }
  return 'user'
}

export async function requireSuperadmin() {
  const role = await getRole()
  if (role !== 'superadmin') {
    throw new Error('Unauthorized: superadmin required')
  }
}
