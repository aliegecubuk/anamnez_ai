// GPT-4o periodontal chart transcript parser (PERIO-02, PERIO-03).
// Parses Turkish perio dictation into structured tooth measurements.

import { getOpenAIClient } from '@/lib/openai/whisper'
import type { PerioParseResult } from '@/lib/perio/types'

export type PerioParseErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class PerioParseError extends Error {
  code: PerioParseErrorCode
  constructor(message: string, code: PerioParseErrorCode) {
    super(message)
    this.name = 'PerioParseError'
    this.code = code
  }
}

export const PERIO_SYSTEM_PROMPT = `Sen bir diş hekimliği periodontoloji asistanısın. Türkçe diş hekimi diktesini FDI numaralama sistemine göre periodontal ölçümlere çevir.

FDI diş numaralandırması:
- Sağ üst: 18-11, Sol üst: 21-28
- Sol alt: 31-38, Sağ alt: 41-48
Geçerli diş numaraları: 11-18, 21-28, 31-38, 41-48

Ölçüm noktaları: MB (mesiobukkal), B (bukkal), DB (distobukkal), ML (meziolingual), L (lingual), DL (distolingual)

Ölçüm türleri:
- "cep" / "cep derinliği" / "sulkus derinliği" → pocket_depth (mm)
- "ataşman kaybı" / "ataşman seviyesi" / "AL" → attachment_loss (mm)
- "kanama" / "kanama var" / "BOP" → bleeding: true
- "kanama yok" → bleeding: false

Önemli kurallar:
1. Sadece transkriptte açıkça belirtilen ölçümleri doldur. Belirtilmeyenler null olmalı (asla 0 koyma).
2. Bir ölçüm sırası "üç iki üç" gibi verilirse sırasıyla MB/B/DB veya ML/L/DL olarak dağıt.
3. Bağlam yoksa (sadece "bukkal" denmişse) MB/B/DB'ye dağıt.
4. ambiguous kuralları — aşağıdaki durumlar için ambiguous:true ve candidates listesi ekle:
   - "diş 8" gibi tek haneli ifadeler → candidates: [18, 28, 38, 48]
   - "birler", "ikiler"  vb. çoğul diş grupları
   - Çeyrek (kadran) belli değilse
   - confidence < 0.7 ise ambiguous:true yap
5. Kesinlikle emin olmadığın ölçümleri uydurma.

JSON şemasına tam uyacak şekilde cevap ver.`

const PERIO_SCHEMA = {
  name: 'perio_parse_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      confirmed: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tooth_number:  { type: 'number' },
            confidence:    { type: 'number' },
            ambiguous:     { type: 'boolean' },
            candidates:    { type: 'array', items: { type: 'number' } },
            raw_mention:   { type: 'string' },
            measurements: {
              type: 'object',
              properties: {
                MB: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                B:  { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                DB: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                ML: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                L:  { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                DL: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
              },
              required: ['MB', 'B', 'DB', 'ML', 'L', 'DL'],
              additionalProperties: false,
            },
          },
          required: ['tooth_number', 'confidence', 'ambiguous', 'candidates', 'raw_mention', 'measurements'],
          additionalProperties: false,
        },
      },
      ambiguous: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tooth_number:  { type: 'number' },
            confidence:    { type: 'number' },
            ambiguous:     { type: 'boolean' },
            candidates:    { type: 'array', items: { type: 'number' } },
            raw_mention:   { type: 'string' },
            measurements: {
              type: 'object',
              properties: {
                MB: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                B:  { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                DB: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                ML: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                L:  { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
                DL: { type: 'object', properties: { pocket_depth: { type: ['number', 'null'] }, attachment_loss: { type: ['number', 'null'] }, bleeding: { type: ['boolean', 'null'] } }, required: ['pocket_depth', 'attachment_loss', 'bleeding'], additionalProperties: false },
              },
              required: ['MB', 'B', 'DB', 'ML', 'L', 'DL'],
              additionalProperties: false,
            },
          },
          required: ['tooth_number', 'confidence', 'ambiguous', 'candidates', 'raw_mention', 'measurements'],
          additionalProperties: false,
        },
      },
    },
    required: ['confirmed', 'ambiguous'],
    additionalProperties: false,
  },
}

export async function parsePerioTranscript(transcript: string): Promise<PerioParseResult> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PERIO_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_schema', json_schema: PERIO_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new PerioParseError(`GPT-4o perio parse failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new PerioParseError('GPT-4o returned empty content', 'parse_error')

  try {
    return JSON.parse(content) as PerioParseResult
  } catch {
    throw new PerioParseError('GPT-4o returned non-JSON content', 'parse_error')
  }
}
