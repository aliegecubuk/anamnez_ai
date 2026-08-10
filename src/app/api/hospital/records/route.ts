import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  DEFAULT_RETENTION_DAYS,
  computeExpiresAt,
  createRecordSchema,
} from '@/lib/hospital/records'

// Labeled hospital anamnesis snapshots. Service-role client + app-layer
// user_id filter, same pattern as /api/patients (RLS is defense-in-depth).

export const runtime = 'nodejs'

// GET /api/hospital/records — lazy-purges expired rows first, then lists.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Lazy purge: expires_at IS NULL rows never match a `< now()` comparison,
  // so "no auto-delete" records are untouched.
  const { error: purgeError } = await supabaseAdmin
    .from('hospital_records')
    .delete()
    .eq('user_id', userId)
    .lt('expires_at', new Date().toISOString())
  if (purgeError) {
    console.error('[hospital records purge]', { code: purgeError.code, message: purgeError.message })
  }

  const { data, error } = await supabaseAdmin
    .from('hospital_records')
    .select('id, label, mode, entries, exam_entries, medula_text, ai_summary, retention_days, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[hospital records GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Kayıtlar alınamadı.' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST /api/hospital/records — retention is read from the user's current
// setting and snapshotted into the row (expires_at computed at save time).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 })
  }

  const parsed = createRecordSchema.safeParse(raw)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Geçersiz kayıt verisi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('hospital_settings')
    .select('retention_days')
    .eq('user_id', userId)
    .maybeSingle()
  if (settingsError) {
    console.error('[hospital records POST settings]', { code: settingsError.code, message: settingsError.message })
    return NextResponse.json({ error: 'Kayıt saklanamadı.' }, { status: 500 })
  }

  const retentionDays = settings?.retention_days ?? DEFAULT_RETENTION_DAYS
  const expiresAt = computeExpiresAt(retentionDays)

  const { data, error } = await supabaseAdmin
    .from('hospital_records')
    .insert({
      user_id: userId,
      label: parsed.data.label,
      mode: parsed.data.mode,
      entries: parsed.data.entries,
      exam_entries: parsed.data.exam_entries,
      medula_text: parsed.data.medula_text,
      ai_summary: parsed.data.ai_summary ?? null,
      retention_days: retentionDays,
      expires_at: expiresAt,
    })
    .select('id, label, mode, entries, exam_entries, medula_text, ai_summary, retention_days, expires_at, created_at')
    .single()

  if (error) {
    console.error('[hospital records POST]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Kayıt saklanamadı.' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
