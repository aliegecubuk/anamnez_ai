import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Daily Vercel cron (see vercel.json): deletes hospital_records whose
// expires_at has passed, across all users. Rows with expires_at NULL ("no
// auto-delete") never match the `< now()` comparison and are kept.

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[hospital-purge] CRON_SECRET is not set')
    return NextResponse.json({ error: 'CRON_SECRET tanımlı değil.' }, { status: 500 })
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error, count } = await supabaseAdmin
    .from('hospital_records')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.error('[hospital-purge]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Temizlik çalıştırılamadı.' }, { status: 500 })
  }

  return NextResponse.json({ deleted: count ?? 0 })
}
