import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/sessions/[id]/complete — finalize the session (ANAM-06).
// Requires BOTH KVKK + informed consent flags. The DB CHECK
// sessions_consent_required_when_completed (04-01) is the backstop.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const body = (await req.json().catch(() => ({}))) as {
    kvkk_consent?: boolean
    informed_consent?: boolean
  }
  const kvkk_consent = body.kvkk_consent === true
  const informed_consent = body.informed_consent === true

  // ANAM-06 (T-04-11): server-side gate — never trust the disabled button alone.
  if (!kvkk_consent || !informed_consent) {
    return NextResponse.json(
      { error: 'KVKK ve onam onayı gereklidir.' },
      { status: 422 },
    )
  }

  // Ownership check before any write (T-04-12).
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()

  if (!session) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({
      kvkk_consent: true,
      informed_consent: true,
      status: 'completed',
      completed_at: new Date().toISOString(),
      recorder_state: 'completed',
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('id, status, completed_at, kvkk_consent, informed_consent')
    .single()

  if (error || !data) {
    // 23514 = check constraint violation (consent backstop rejected the update).
    if (error?.code === '23514') {
      return NextResponse.json(
        { error: 'Onam koşulları sağlanmadan seans tamamlanamaz.' },
        { status: 409 },
      )
    }
    console.error('[session complete]', { code: error?.code, message: error?.message })
    return NextResponse.json({ error: 'Seans tamamlanamadı.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: data.id,
      status: data.status,
      completed_at: data.completed_at,
      kvkk_consent: data.kvkk_consent,
      informed_consent: data.informed_consent,
    },
    { status: 200 },
  )
}
