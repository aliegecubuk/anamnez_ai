import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { maskTc } from '@/lib/patients/types'
import type { PatientListItem } from '@/lib/patients/types'

// Test mode: service-role + app-layer user_id filter.
// RLS remains as defense-in-depth; switched off the Clerk-JWT bridge for now.

// GET /api/patients?q=
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  let query = supabaseAdmin
    .from('patients')
    .select(`
      id,
      full_name,
      tc_kimlik_no,
      sessions ( started_at )
    `)
    .eq('user_id', userId)
    .order('full_name', { ascending: true })

  if (q) {
    if (/^[0-9]+$/.test(q)) {
      query = query.ilike('tc_kimlik_no', `${q}%`)
    } else {
      query = query.ilike('full_name', `%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) {
    console.error('[patients GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const items: PatientListItem[] = (data ?? []).map((p) => {
    const sessionDates = (p.sessions as { started_at: string }[] | null) ?? []
    const last = sessionDates.map((s) => s.started_at).sort().at(-1) ?? null
    return {
      id: p.id,
      full_name: p.full_name,
      tc_kimlik_no_masked: maskTc(p.tc_kimlik_no),
      last_session_at: last,
    }
  })

  return NextResponse.json(items)
}

// POST /api/patients
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const full_name = (body.full_name ?? '').trim()
  const tc_kimlik_no = (body.tc_kimlik_no ?? '').trim()

  if (!full_name) {
    return NextResponse.json({ error: 'Ad soyad zorunludur.' }, { status: 422 })
  }
  if (!tc_kimlik_no) {
    return NextResponse.json({ error: 'TC kimlik numarası zorunludur.' }, { status: 422 })
  }
  if (!/^[0-9]{11}$/.test(tc_kimlik_no)) {
    return NextResponse.json(
      { error: /[^0-9]/.test(tc_kimlik_no)
          ? 'TC kimlik numarası yalnızca rakam içermelidir.'
          : 'TC kimlik numarası tam 11 haneli olmalıdır.' },
      { status: 422 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('patients')
    .insert({ user_id: userId, full_name, tc_kimlik_no })
    .select('id, full_name, tc_kimlik_no, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var.' },
        { status: 409 }
      )
    }
    console.error('[patients POST]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const item: PatientListItem = {
    id: data.id,
    full_name: data.full_name,
    tc_kimlik_no_masked: maskTc(data.tc_kimlik_no),
    last_session_at: null,
  }

  return NextResponse.json(item, { status: 201 })
}
