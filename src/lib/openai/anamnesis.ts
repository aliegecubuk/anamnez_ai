// GPT-4o transcript → anamnesis-form mapping wrapper (ANAM-01, ANAM-02).
// Thin I/O shell: schema building (schema.ts) and coercion (mapper.ts) are
// pure and unit-tested; this file only builds the request and parses the reply.

import { getOpenAIClient } from '@/lib/openai/whisper'
import { buildAnswerSchema } from '@/lib/anamnesis/schema'
import { normalizeAnswers } from '@/lib/anamnesis/mapper'
import type { AiMappedAnswer, AiMappingResult } from '@/lib/anamnesis/types'
import type { SnapshotQuestion } from '@/lib/templates/types'

export type AnamnesisMappingErrorCode =
  | 'missing_api_key'
  | 'upstream_error'
  | 'parse_error'

export class AnamnesisMappingError extends Error {
  code: AnamnesisMappingErrorCode
  constructor(message: string, code: AnamnesisMappingErrorCode) {
    super(message)
    this.name = 'AnamnesisMappingError'
    this.code = code
  }
}

// Turkish system prompt: map transcript → form answers with per-field
// confidence; also fix proper-noun / Turkish-number STT drift (Phase 3 deferred).
const SYSTEM_PROMPT = `Sen bir diş hekimliği anamnez asistanısın. Sana Türkçe bir hasta görüşmesi transkripti verilecek.

Görevin:
1. Transkripti dikkatlice oku ve verilen form sorularının her birine transkriptteki bilgiye dayanarak cevap ver.
2. Her cevap için 0 ile 1 arasında bir güven puanı (confidence) ver: bilgi açıkça söylendiyse 0.9-1.0, dolaylı çıkarımsa 0.5-0.8, belirsizse 0.5 altı.
3. Transkriptte hiç değinilmeyen sorular için value alanını boş/anlamsız doldurma; en nötr değeri koy ve confidence değerini 0 yap.
4. Transkriptteki bariz yazım hatalarını düzelt: özel isimler (ilaç adları, hastalık adları, kurum adları) ve Türkçe sayı ifadeleri ("on iki" → "12" gibi yanlış çevrilmiş sayılar) düzeltilmiş haliyle corrected_transcript alanında tam metni döndür.
5. Uydurma bilgi ekleme. Sadece transkriptte geçen veya güçlü şekilde ima edilen bilgileri kullan.

Cevapları verilen JSON şemasına tam uyacak şekilde döndür.`

interface RawAnswerEntry {
  value: unknown
  confidence: unknown
}

/**
 * Map a Turkish anamnesis transcript to per-question answers via GPT-4o
 * Structured Outputs. Every answer is coerced by normalizeAnswers before
 * return — LLM output never reaches callers untyped (T-04-08).
 */
export async function mapTranscriptToAnswers(
  transcript: string,
  questions: SnapshotQuestion[],
): Promise<AiMappingResult> {
  const openai = getOpenAIClient()
  const schema = buildAnswerSchema(questions)

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown OpenAI error'
    throw new AnamnesisMappingError(`GPT-4o mapping failed: ${message}`, 'upstream_error')
  }

  if (!content) {
    throw new AnamnesisMappingError('GPT-4o returned empty content', 'parse_error')
  }

  let parsed: { answers?: Record<string, RawAnswerEntry>; corrected_transcript?: unknown }
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new AnamnesisMappingError('GPT-4o returned non-JSON content', 'parse_error')
  }

  // Keyed object → AiMappedAnswer[]; normalizeAnswers handles all coercion.
  const rawAnswers: AiMappedAnswer[] = Object.entries(parsed.answers ?? {}).map(
    ([question_id, entry]) => ({
      question_id,
      answer_value: entry?.value as AiMappedAnswer['answer_value'],
      confidence: typeof entry?.confidence === 'number' ? entry.confidence : 0,
    }),
  )

  return {
    answers: normalizeAnswers(rawAnswers, questions),
    corrected_transcript:
      typeof parsed.corrected_transcript === 'string'
        ? parsed.corrected_transcript
        : undefined,
  }
}
