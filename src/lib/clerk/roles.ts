import { auth } from '@clerk/nextjs/server'

export type AppRole = 'superadmin' | 'org:admin' | 'org:dentist' | 'org:assistant'

export async function getRole(): Promise<AppRole | null> {
  const { sessionClaims, orgRole } = await auth()

  if ((sessionClaims?.metadata as Record<string, unknown>)?.role === 'superadmin') {
    return 'superadmin'
  }

  if (orgRole) {
    return orgRole as AppRole
  }

  return null
}

export async function requireSuperadmin() {
  const role = await getRole()
  if (role !== 'superadmin') {
    throw new Error('Unauthorized: superadmin required')
  }
}

export async function requireOrgRole(allowedRoles: AppRole[]) {
  const role = await getRole()
  if (!role || !allowedRoles.includes(role)) {
    throw new Error('Unauthorized: insufficient role')
  }
}
