// GPT-4o pathology chart transcript parser (PATH-02, PATH-05).

import { getOpenAIClient } from '@/lib/openai/whisper'
import type { PathologyParseResult } from '@/lib/perio/types'

export type PathologyParseErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class PathologyParseError extends Error {
  code: PathologyParseErrorCode
  constructor(message: string, code: PathologyParseErrorCode) {
    super(message)
    this.name = 'PathologyParseError'
    this.code = code
  }
}

export const PATHOLOGY_SYSTEM_PROMPT = `Sen bir diş hekimliği patoloji asistanısın. Türkçe diş hekimi diktesini FDI numaralama sistemine göre diş patoloji durumlarına çevir.

FDI diş numaralandırması:
- Sağ üst: 18-11, Sol üst: 21-28
- Sol alt: 31-38, Sağ alt: 41-48
Geçerli diş numaraları: 11-18, 21-28, 31-38, 41-48

Desteklenen durum türleri (condition_type değerleri):
- çürük: diş çürüğü, karyez, caries
- diş_eti_çekilmesi: gingival recession, diş eti çekilmesi
- dolgu: filling, restorasyon, amalgam, kompozit
- kanal: root canal, kanal tedavisi, endodontik tedavi
- köprü: bridge, sabit protez, köprü restorasyonu
- eksik_diş: missing tooth, çekim yapılmış, yok
- diğer: diğer patoloji durumları

Kurallar:
1. Sadece transkriptte belirtilen dişleri ve durumları doldur.
2. Yazıyla söylenen sayıları rakama çevir: "yirmi üç" = 23, "otuz beş" = 35, "on altı" = 16.
   Geçerli FDI aralığında açıkça söylenmiş bir numara (rakamla VEYA yazıyla) KESİN diş
   numarasıdır — ASLA ambiguous yapma, doğrudan confirmed'a yaz.
3. ambiguous kuralları (PERIO-03 ile aynı mantık):
   - "diş 8" gibi tek haneli → candidates: [18, 28, 38, 48]
   - Çeyrek belirsizse → ambiguous:true
   - confidence < 0.7 → ambiguous:true
   - ambiguous:true olan her kayıtta candidates MUTLAKA dolu olmalı: en olası 2-4 dişi
     tahmin edip yaz. Boş candidates listesi ASLA döndürme.
4. Bir dişte birden fazla durum olabilir — her durum için ayrı kayıt ekle.
5. Kesinlikle emin olmadığın durumları uydurma.

JSON şemasına tam uyacak şekilde cevap ver.`

const PATHOLOGY_SCHEMA = {
  name: 'pathology_parse_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      confirmed: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tooth_number:   { type: 'number' },
            condition_type: { type: 'string' },
            confidence:     { type: 'number' },
            ambiguous:      { type: 'boolean' },
            candidates:     { type: 'array', items: { type: 'number' } },
            raw_mention:    { type: 'string' },
          },
          required: ['tooth_number', 'condition_type', 'confidence', 'ambiguous', 'candidates', 'raw_mention'],
          additionalProperties: false,
        },
      },
      ambiguous: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tooth_number:   { type: 'number' },
            condition_type: { type: 'string' },
            confidence:     { type: 'number' },
            ambiguous:      { type: 'boolean' },
            candidates:     { type: 'array', items: { type: 'number' } },
            raw_mention:    { type: 'string' },
          },
          required: ['tooth_number', 'condition_type', 'confidence', 'ambiguous', 'candidates', 'raw_mention'],
          additionalProperties: false,
        },
      },
    },
    required: ['confirmed', 'ambiguous'],
    additionalProperties: false,
  },
}

export async function parsePathologyTranscript(transcript: string): Promise<PathologyParseResult> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: PATHOLOGY_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_schema', json_schema: PATHOLOGY_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new PathologyParseError(`GPT-4o pathology parse failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new PathologyParseError('GPT-4o returned empty content', 'parse_error')

  try {
    return JSON.parse(content) as PathologyParseResult
  } catch {
    throw new PathologyParseError('GPT-4o returned non-JSON content', 'parse_error')
  }
}
