import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/clerk/roles'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    await requireSuperadmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const body = await req.json()
  const { email, firstName, lastName, organizationId, role } = body
  if (!email || !organizationId || !role) {
    return NextResponse.json({ error: 'email, organizationId, role zorunlu' }, { status: 400 })
  }
  try {
    const clerk = await clerkClient()
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId,
      emailAddress: email,
      role,
      inviterUserId: (await clerk.users.getUserList({ limit: 1 })).data[0]?.id ?? '',
      publicMetadata: { firstName, lastName },
    })
    return NextResponse.json({ invitationId: invitation.id }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Clerk API hatası'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
