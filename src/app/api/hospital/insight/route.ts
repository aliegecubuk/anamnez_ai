// Q/A entries → clinical insight (summary + differentials + red flags).
// Stateless like the extract route. The body carries ONLY question/answer
// pairs — the client sends the extracted/edited entries, never the identity,
// so the masking guarantee cannot be broken here.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { generateHospitalInsight, HospitalInsightError } from '@/lib/openai/hospital-insight'
import type {
  HospitalInsightBody,
  HospitalInsightInputEntry,
  HospitalMode,
} from '@/lib/hospital/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ENTRIES = 100
const MAX_FIELD_CHARS = 2_000
const MODES: HospitalMode[] = ['hizli', 'detayli']

// Returns null on any shape violation; silently drops fully-empty rows.
function sanitizeEntries(input: unknown): HospitalInsightInputEntry[] | null {
  if (!Array.isArray(input) || input.length > MAX_ENTRIES) return null
  const out: HospitalInsightInputEntry[] = []
  for (const item of input) {
    if (
      !item ||
      typeof (item as HospitalInsightInputEntry).question !== 'string' ||
      typeof (item as HospitalInsightInputEntry).answer !== 'string'
    ) {
      return null
    }
    const { question, answer } = item as HospitalInsightInputEntry
    if (question.length > MAX_FIELD_CHARS || answer.length > MAX_FIELD_CHARS) return null
    const trimmed = { question: question.trim(), answer: answer.trim() }
    if (trimmed.question || trimmed.answer) out.push(trimmed)
  }
  return out
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<HospitalInsightBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 })
  }

  const entries = sanitizeEntries(body.entries)
  const examEntries = sanitizeEntries(body.exam_entries)
  const mode = MODES.find((m) => m === body.mode)

  if (entries === null || examEntries === null) {
    return NextResponse.json({ error: 'Geçersiz kayıt listesi.' }, { status: 400 })
  }
  if (entries.length === 0 && examEntries.length === 0) {
    return NextResponse.json({ error: 'Özet için kayıt yok — önce anamnezi işleyin.' }, { status: 400 })
  }
  if (!mode) {
    return NextResponse.json({ error: 'Geçersiz mod.' }, { status: 400 })
  }

  try {
    const result = await generateHospitalInsight(entries, examEntries, mode)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof HospitalInsightError) {
      const status = err.code === 'missing_api_key' ? 500 : 502
      return NextResponse.json({ error: 'Klinik özet üretilemedi. Tekrar deneyin.' }, { status })
    }
    return NextResponse.json({ error: 'Beklenmeyen hata.' }, { status: 500 })
  }
}
