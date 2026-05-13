import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CreateSessionBody, AudioFormat, FormType, SessionRow } from '@/lib/sessions/types'

const VALID_FORMATS: AudioFormat[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mpeg',
  'audio/wav',
]

const VALID_FORM_TYPES: FormType[] = ['genel', 'anamnez', 'perio', 'patoloji']

// POST /api/sessions
// Body: { patient_id, form_type?, audio_format }
// Returns 201 { id, started_at, recorder_state }
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Partial<CreateSessionBody>
  const patient_id = (body.patient_id ?? '').trim()
  const form_type = (body.form_type ?? 'genel') as FormType
  const audio_format = body.audio_format as AudioFormat | undefined

  if (!patient_id) {
    return NextResponse.json({ error: 'patient_id zorunludur.' }, { status: 422 })
  }
  if (!VALID_FORM_TYPES.includes(form_type)) {
    return NextResponse.json({ error: 'Geçersiz form_type.' }, { status: 422 })
  }
  if (!audio_format || !VALID_FORMATS.includes(audio_format)) {
    return NextResponse.json({ error: 'Desteklenmeyen ses formatı.' }, { status: 422 })
  }

  // Confirm the patient belongs to the caller — RLS-equivalent check at app layer.
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('id', patient_id)
    .eq('user_id', userId)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Hasta bulunamadı.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({
      user_id: userId,
      patient_id,
      form_type,
      audio_format,
      recorder_state: 'recording', // session starts in recording state — no separate "start" PATCH needed
    })
    .select('id, started_at, recorder_state, audio_format, form_type, patient_id, status, completed_at, user_id')
    .single<SessionRow>()

  if (error || !data) {
    console.error('[sessions POST]', { code: error?.code, message: error?.message })
    return NextResponse.json({ error: 'Seans oluşturulamadı.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: data.id,
      patient_id: data.patient_id,
      form_type: data.form_type,
      status: data.status,
      started_at: data.started_at,
      audio_format: data.audio_format,
      recorder_state: data.recorder_state,
    },
    { status: 201 },
  )
}
