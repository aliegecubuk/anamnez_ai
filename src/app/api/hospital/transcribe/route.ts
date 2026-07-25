// Stateless STT for the hospital module: audio chunk in → Turkish text out.
// Nothing is persisted — no session row, no transcript_segments. The client
// keeps segments in React state and wipes them on reset.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { transcribeAudio, WhisperError } from '@/lib/openai/whisper'
import type { AudioFormat } from '@/lib/sessions/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_CHUNK_BYTES = 24 * 1024 * 1024

const ALLOWED_FORMATS: AudioFormat[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mpeg',
  'audio/wav',
]

const HOSPITAL_STT_PROMPT =
  'Hastane poliklinik/acil hasta görüşmesi diktesi: anamnez. ' +
  'Sayıları rakamla yaz (örn. 3 gün, 38.5, 120/80). İlaç adlarını duyulduğu gibi yaz.'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formatParam = req.nextUrl.searchParams.get('format') ?? ''
  const format = ALLOWED_FORMATS.find((f) => f === formatParam)
  if (!format) {
    return NextResponse.json({ error: 'Geçersiz ses formatı.' }, { status: 400 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Geçersiz form verisi.' }, { status: 400 })
  }

  const audio = form.get('audio')
  const sequence = Number.parseInt(String(form.get('sequence') ?? ''), 10)
  const startedAt = String(form.get('started_at') ?? '')
  const endedAt = String(form.get('ended_at') ?? '')

  if (!(audio instanceof Blob) || !Number.isFinite(sequence)) {
    return NextResponse.json({ error: 'Eksik ses parçası.' }, { status: 400 })
  }
  if (audio.size > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: 'Ses parçası 24MB sınırını aşıyor.' }, { status: 413 })
  }

  // Same DTO shape as the session chunk route so useChunkedRecorder.onSegment works as-is.
  if (audio.size === 0) {
    return NextResponse.json(
      { sequence, content: '', started_at: startedAt, ended_at: endedAt },
      { status: 201 },
    )
  }

  try {
    const content = await transcribeAudio(audio, format, { prompt: HOSPITAL_STT_PROMPT })
    return NextResponse.json(
      { sequence, content, started_at: startedAt, ended_at: endedAt },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof WhisperError) {
      const status = err.code === 'missing_api_key' ? 500 : 502
      return NextResponse.json({ error: 'Ses çözümlenemedi. Tekrar deneyin.' }, { status })
    }
    return NextResponse.json({ error: 'Beklenmeyen hata.' }, { status: 500 })
  }
}
