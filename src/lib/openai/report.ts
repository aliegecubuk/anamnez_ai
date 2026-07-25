// GPT-4o AI assessment report for the anamnesis PDF.
// Synthesizes classified section entries + enriched medications into a
// clinician-facing pre-assessment (hekim onayı gerektirir — disclaimer UI/PDF'te).

import { getOpenAIClient } from '@/lib/openai/whisper'
import {
  SECTION_LABELS,
  type AiReportResult,
  type AnamnesisEntryDTO,
  type MedicationDTO,
} from '@/lib/anamnesis/structured-types'

export type AiReportErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class AiReportError extends Error {
  code: AiReportErrorCode
  constructor(message: string, code: AiReportErrorCode) {
    super(message)
    this.name = 'AiReportError'
    this.code = code
  }
}

export const REPORT_SYSTEM_PROMPT = `Sen deneyimli bir diş hekimliği klinik değerlendirme asistanısın. Sana bir hastanın sınıflandırılmış anamnez bilgileri (Özgeçmiş/Soygeçmiş bölümleri) ve kullandığı ilaçların dental bilgi kartları verilecek. Bunlardan hekime yönelik Türkçe bir ön değerlendirme raporu üret.

Alanlar:
- summary: Hastanın genel durumunun 2-4 cümlelik klinik özeti (diş hekimliği perspektifinden).
- dental_considerations: Dental tedavi planlamasında dikkate alınması gereken noktalar (her madde tek cümle).
- risk_flags: Kanama, enfeksiyon, anestezi, ilaç etkileşimi, MRONJ vb. somut risk uyarıları (her madde tek cümle; risk yoksa boş liste).
- recommendations: Hekime somut öneriler — konsültasyon, premedikasyon, işlem sıralaması, ek tetkik (her madde tek cümle).

Kurallar:
1. Sadece verilen bilgilere dayan; bilgi uydurma, tanı koyma.
2. Kesin hüküm verme; "önerilir", "değerlendirilmelidir" gibi ifadeler kullan.
3. Genel tıbbi tedavi önerisi verme; diş hekimliği perspektifinde kal.
4. Veri azsa bunu summary içinde belirt ve alınabilecek ek anamnez bilgisini öner.

JSON şemasına tam uyacak şekilde cevap ver.`

const REPORT_SCHEMA = {
  name: 'ai_anamnesis_report',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary:               { type: 'string' },
      dental_considerations: { type: 'array', items: { type: 'string' } },
      risk_flags:            { type: 'array', items: { type: 'string' } },
      recommendations:       { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'dental_considerations', 'risk_flags', 'recommendations'],
    additionalProperties: false,
  },
}

export function buildReportInput(
  entries: AnamnesisEntryDTO[],
  medications: MedicationDTO[],
): string {
  const lines: string[] = []

  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    const items = entries.filter((e) => e.section_key === key)
    if (items.length === 0) continue
    lines.push(`## ${label}`)
    for (const item of items) lines.push(`- ${item.content}`)
  }

  if (medications.length > 0) {
    lines.push('## Kullanılan ilaçlar')
    for (const m of medications) {
      const parts = [
        `İlaç: ${m.name}`,
        m.active_ingredient ? `etken madde: ${m.active_ingredient}` : null,
        m.dental_significance ? `dental önemi: ${m.dental_significance}` : null,
        m.surgical_precautions ? `cerrahi önlem: ${m.surgical_precautions}` : null,
        m.risk_level ? `risk: ${m.risk_level}` : null,
      ].filter(Boolean)
      lines.push(`- ${parts.join(' | ')}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Anamnez bilgisi girilmemiş.'
}

export async function generateAiReport(
  entries: AnamnesisEntryDTO[],
  medications: MedicationDTO[],
): Promise<AiReportResult> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: REPORT_SYSTEM_PROMPT },
        { role: 'user', content: buildReportInput(entries, medications) },
      ],
      response_format: { type: 'json_schema', json_schema: REPORT_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new AiReportError(`GPT-4o report generation failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new AiReportError('GPT-4o returned empty content', 'parse_error')

  try {
    return JSON.parse(content) as AiReportResult
  } catch {
    throw new AiReportError('GPT-4o returned non-JSON content', 'parse_error')
  }
}
