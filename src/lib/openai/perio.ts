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

Ölçüm noktaları: MB (mesiobukkal), B (bukkal), DB (distobukkal), ML (mesiolingual), L (lingual), DL (distolingual)

Yüzey eşlemesi (ÇOK ÖNEMLİ):
- "Palatal" üst çenenin arka yüzüdür → ML/L/DL noktalarına yaz. ("Palatin" de aynı.)
- "Lingual" alt çenenin arka yüzüdür → ML/L/DL noktalarına yaz.
- "Bukkal", "fasial", "vestibül" ön yüzdür → MB/B/DB noktalarına yaz.
- Hekim genelde önce ön (bukkal) üçlüyü, sonra arka (palatal/lingual) üçlüyü okur.

Ölçüm türleri:
- "cep" / "cep derinliği" / "sulkus derinliği" → pocket_depth (mm)
- "ataşman kaybı" / "ataşman seviyesi" / "AL" → attachment_loss (mm)
- "kanama" / "kanama var" / "BOP" → bleeding: true
- "kanama yok" → bleeding: false

Kanamanın noktaya atanması:
- "mesialde kanama" → ön yüzde MB, arka yüzde ML.
- "distalde kanama" → ön yüzde DB, arka yüzde DL.
- Nokta belirtilmeden "kanama var" denirse, o diş için ölçüm bildirilen tüm noktalara bleeding: true işaretle; hiç ölçüm yoksa sadece B noktasına işaretle.

Sayı çevirisi (ÇOK ÖNEMLİ):
- Yazıyla söylenen sayıları rakama çevir: "otuz dört" = 34, "on altı" = 16, "yirmi iki" = 22, "kırk bir" = 41.
- Geçerli FDI aralığındaki iki basamaklı bir sayı açıkça söylenmişse (rakamla VEYA yazıyla), bu KESİN diş numarasıdır: ambiguous:false, confidence ≥ 0.9. Tekrar sorma.
- Örnekler: "otuz dört, dört milimetre" → diş 34, cep 4mm, ambiguous:false. "yirmi ikide üç milimetre" → diş 22, 3mm, ambiguous:false. "36 ve siyah 4 milimetre" → diş 36, 4mm.
- Diş numarasından sonra gelen küçük sayılar (0-12 aralığı, "milimetre" eşliğinde) ölçüm değeridir, diş numarası değildir.

Önemli kurallar:
1. Sadece transkriptte açıkça belirtilen ölçümleri doldur. Belirtilmeyenler null olmalı (asla 0 koyma).
2. Bir ölçüm sırası "üç iki üç" gibi tek üçlü verilirse sırasıyla MB/B/DB veya ML/L/DL olarak dağıt (yüzey bağlamına göre).
3. Ardışık İKİ üçlü verilirse (örn. "beş altı beş, dört üç dört" veya "bukkal üç dört üç; palatal üç üç iki") İLK üçlü ön yüze (MB/B/DB), İKİNCİ üçlü arka yüze (ML/L/DL) dağıtılır. "Palatal/lingual" denerek verilen üçlü her zaman arka yüzedir.
4. Bağlam yoksa (sadece "bukkal" denmişse) MB/B/DB'ye dağıt.
5. ambiguous SADECE şu durumlarda kullanılır (candidates listesiyle birlikte):
   - "diş 8" gibi tek haneli ifadeler → candidates: [18, 28, 38, 48]
   - "birler", "ikiler" vb. çoğul diş grupları
   - Kadran gerçekten belirsizse
   Açıkça söylenmiş geçerli bir FDI numarasını ASLA ambiguous yapma.
6. Kesinlikle emin olmadığın ölçümleri uydurma.

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
      temperature: 0,
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
