// Transcript → structured hospital anamnesis (GPT-4o Structured Outputs).
// Stateless: takes the (client-side masked) transcript in the body, returns
// question/answer entries, persists nothing.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { HospitalParseError, parseHospitalAnamnesis } from '@/lib/openai/hospital-anamnesis'
import type { HospitalExtractBody, HospitalMode } from '@/lib/hospital/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_TRANSCRIPT_CHARS = 60_000
const MODES: HospitalMode[] = ['hizli', 'detayli']

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<HospitalExtractBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 })
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  const mode = MODES.find((m) => m === body.mode)

  if (!transcript) {
    return NextResponse.json({ error: 'Transkript boş — önce kayıt alın.' }, { status: 400 })
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: 'Transkript çok uzun.' }, { status: 413 })
  }
  if (!mode) {
    return NextResponse.json({ error: 'Geçersiz mod.' }, { status: 400 })
  }

  try {
    const result = await parseHospitalAnamnesis(transcript, mode)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof HospitalParseError) {
      const status = err.code === 'missing_api_key' ? 500 : 502
      return NextResponse.json({ error: 'Anamnez çıkarılamadı. Tekrar deneyin.' }, { status })
    }
    return NextResponse.json({ error: 'Beklenmeyen hata.' }, { status: 500 })
  }
}
