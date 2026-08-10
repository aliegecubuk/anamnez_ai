import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/hospital/records/[id] — user-scoped manual delete.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Geçersiz kayıt kimliği.' }, { status: 400 })
  }

  const { error, count } = await supabaseAdmin
    .from('hospital_records')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('[hospital records DELETE]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Kayıt silinemedi.' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
