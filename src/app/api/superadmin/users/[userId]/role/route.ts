import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/clerk/roles'
import { clerkClient } from '@clerk/nextjs/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireSuperadmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { userId } = await params
  const body = await req.json()
  const { role, organizationId } = body
  if (!role) return NextResponse.json({ error: 'role zorunlu' }, { status: 400 })

  try {
    const clerk = await clerkClient()
    if (role === 'superadmin') {
      // Superadmin: publicMetadata flag (not an org role)
      await clerk.users.updateUserMetadata(userId, { publicMetadata: { role: 'superadmin' } })
    } else if (organizationId) {
      // Org roles: update organization membership
      await clerk.organizations.updateOrganizationMembership({
        organizationId,
        userId,
        role,
      })
    } else {
      return NextResponse.json({ error: 'organizationId gerekli (org rolü için)' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Clerk API hatası'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
