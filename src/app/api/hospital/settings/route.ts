import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_RETENTION_DAYS, settingsBodySchema } from '@/lib/hospital/records'

// Per-user hospital settings — currently just the retention preference that
// POST /api/hospital/records snapshots into each new record.

export const runtime = 'nodejs'

// GET /api/hospital/settings — returns the default when no row exists yet.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('hospital_settings')
    .select('retention_days')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[hospital settings GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Ayarlar alınamadı.' }, { status: 500 })
  }

  return NextResponse.json({ retention_days: data?.retention_days ?? DEFAULT_RETENTION_DAYS })
}

// PUT /api/hospital/settings — upsert the retention preference.
export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 })
  }

  const parsed = settingsBodySchema.safeParse(raw)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Geçersiz saklama süresi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('hospital_settings')
    .upsert(
      {
        user_id: userId,
        retention_days: parsed.data.retention_days,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('[hospital settings PUT]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Ayar kaydedilemedi.' }, { status: 500 })
  }

  return NextResponse.json({ retention_days: parsed.data.retention_days })
}
