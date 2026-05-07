import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/clerk/roles'
import { clerkClient } from '@clerk/nextjs/server'
import { parseRequestBody } from '@/lib/http/parse-body'

// PATCH /api/superadmin/users/[userId]/role
// Body: { role: 'superadmin' | 'user' }
// Test mode: only sets/clears the publicMetadata.role superadmin flag.
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
  const body = await parseRequestBody(req)
  const { role } = body
  if (!role) return NextResponse.json({ error: 'role zorunlu' }, { status: 400 })
  if (role !== 'superadmin' && role !== 'user') {
    return NextResponse.json({ error: 'role: superadmin | user' }, { status: 400 })
  }

  const clerk = await clerkClient()

  try {
    await clerk.users.getUser(userId)
  } catch {
    return NextResponse.json(
      { error: `Kullanıcı Clerk'te bulunamadı: ${userId}.` },
      { status: 404 }
    )
  }

  try {
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: role === 'superadmin' ? 'superadmin' : null },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Clerk API hatası'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
