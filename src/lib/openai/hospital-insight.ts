// GPT-4o clinical insight for the hospital module: one flowing clinical
// summary paragraph + differential diagnoses + red flags, synthesized from the
// EXTRACTED entries (never the raw transcript and never the identity — the
// masking guarantee stays intact because insight only sees Q/A pairs).

import { getOpenAIClient } from '@/lib/openai/whisper'
import {
  HOSPITAL_MODE_LABELS,
  type HospitalInsightInputEntry,
  type HospitalInsightResult,
  type HospitalMode,
} from '@/lib/hospital/types'

export type HospitalInsightErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class HospitalInsightError extends Error {
  code: HospitalInsightErrorCode
  constructor(message: string, code: HospitalInsightErrorCode) {
    super(message)
    this.name = 'HospitalInsightError'
    this.code = code
  }
}

export const INSIGHT_SYSTEM_PROMPT = `Sen deneyimli bir hastane klinik özet asistanısın (acil ve poliklinik). Sana bir hastanın yapılandırılmış anamnez ve fizik muayene bulguları soru-cevap çiftleri halinde verilecek. Bunlardan hekime yönelik Türkçe klinik çıkarım üret.

Alanlar:
- "summary": Tek akıcı paragraf halinde klinik özet. Üçüncü şahıs, Medula serbest metnine uygun klinik dil. Ana şikâyet, süre, önemli pozitif/negatif bulgular, kritik öykü bilgileri ve varsa vital bulguları kapsasın.
- "differentials": Olası ayırıcı tanılar; klinik olasılık sırasına göre, her madde kısa ve temkinli dille ("... değerlendirilebilir", "... akla gelmelidir", "... dışlanmalıdır"). Veri yetersizse az madde ver.
- "red_flags": Acil müdahale veya ileri değerlendirme gerektirebilecek bulgular ya da kritik eksikler (örn. göğüs ağrısında kardiyak değerlendirme eksikliği); yoksa boş liste.

Kurallar:
1. Sadece verilen soru-cevap çiftlerinde AÇIKÇA yazan bilgilere dayan; bilgi uydurma, kesin tanı koyma.
2. Demografik bilgi (yaş, cinsiyet) verilmediyse ASLA sayısal yaş veya cinsiyet yazma ("65 yaşında erkek hasta" gibi ifadeler yasak). Yaş klinik olarak önemliyse "yaşı belirtilmemiş" de; uydurma yaş ekleme.
3. Olasılık bildiren temkinli dil kullan; kesin hüküm verme.
4. Kimlik bilgisi yoktur ve istenmez; yalnızca klinik içerik üret.
5. Hızlı (acil) modda özet ve listeleri kısa tut.

JSON şemasına tam uyacak şekilde cevap ver.`

export const INSIGHT_SCHEMA = {
  name: 'hospital_clinical_insight',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      differentials: { type: 'array', items: { type: 'string' } },
      red_flags: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'differentials', 'red_flags'],
    additionalProperties: false,
  },
}

// Q/A pairs as plain text sections. Identity is structurally absent — the
// input type carries nothing but question/answer strings.
export function buildInsightInput(
  entries: HospitalInsightInputEntry[],
  examEntries: HospitalInsightInputEntry[],
  mode: HospitalMode,
): string {
  const lines: string[] = [`Mod: ${HOSPITAL_MODE_LABELS[mode]}`]
  if (entries.length > 0) {
    lines.push('## Anamnez')
    for (const e of entries) lines.push(`- ${e.question}: ${e.answer}`)
  }
  if (examEntries.length > 0) {
    lines.push('## Fizik Muayene')
    for (const e of examEntries) lines.push(`- ${e.question}: ${e.answer}`)
  }
  return lines.join('\n')
}

export async function generateHospitalInsight(
  entries: HospitalInsightInputEntry[],
  examEntries: HospitalInsightInputEntry[],
  mode: HospitalMode,
): Promise<HospitalInsightResult> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
        { role: 'user', content: buildInsightInput(entries, examEntries, mode) },
      ],
      response_format: { type: 'json_schema', json_schema: INSIGHT_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new HospitalInsightError(`GPT-4o hospital insight failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new HospitalInsightError('GPT-4o returned empty content', 'parse_error')

  let parsed: HospitalInsightResult
  try {
    parsed = JSON.parse(content) as HospitalInsightResult
  } catch {
    throw new HospitalInsightError('GPT-4o returned non-JSON content', 'parse_error')
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    differentials: Array.isArray(parsed.differentials) ? parsed.differentials : [],
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
  }
}
