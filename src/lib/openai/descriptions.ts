// GPT-4o dental description generator (DESC-02, DESC-03, DESC-04).
// Scope-guarded to dental/surgical/anesthetic relevance only.

import { getOpenAIClient } from '@/lib/openai/whisper'
import { DESCRIPTION_SCHEMA } from '@/lib/descriptions/schema'
import type { DescriptionCategory } from '@/lib/descriptions/types'

export type DentalDescriptionErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class DentalDescriptionError extends Error {
  code: DentalDescriptionErrorCode
  constructor(message: string, code: DentalDescriptionErrorCode) {
    super(message)
    this.name = 'DentalDescriptionError'
    this.code = code
  }
}

export const DESCRIPTION_SYSTEM_PROMPT = `Sen bir diş hekimliği klinik destek asistanısın.

SADECE diş hekimliği, ağız-çene cerrahisi ve anestezi açısından önem taşıyan bilgi ver. Genel tıbbi bilgi, sistemik tedavi önerisi veya hastaya genel sağlık tavsiyesi VERME.

Verilen ilaç, hastalık veya alerji için tam olarak üç alan doldur:
- dental_impact: Bu madde/durumun diş tedavisi, ağız cerrahisi veya lokal/genel anestezi üzerindeki etkisi (tek cümle, Türkçe).
- risk_level: Diş hekimliği işlemleri açısından risk düzeyi — "düşük", "orta" veya "yüksek" ile kısa gerekçe (tek cümle, Türkçe).
- precaution: Diş hekiminin alması önerilen somut önlem (tek cümle, Türkçe).

DESC-04 — Etken madde geri dönüşü: Verilen terim bilinmeyen, nadir veya marka adıysa etken maddesini (aktif madde) belirle ve açıklamayı etken madde üzerinden yap. Hangi etken maddeyi kullandığını dental_impact cümlesinde "([etken madde])" şeklinde belirt.`

const CATEGORY_LABELS: Record<DescriptionCategory, string> = {
  medication: 'İlaç',
  disease:    'Sistemik hastalık',
  allergy:    'Gıda/madde alerjisi',
}

export async function generateDentalDescription(
  term: string,
  category: DescriptionCategory,
): Promise<{
  dental_impact: string
  risk_level: string
  precaution: string
  active_ingredient: string | null
}> {
  const openai = getOpenAIClient()
  const label = CATEGORY_LABELS[category]
  const userMessage = `${label}: ${term}`

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: DESCRIPTION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: DESCRIPTION_SCHEMA,
      },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown OpenAI error'
    throw new DentalDescriptionError(`GPT-4o description failed: ${message}`, 'upstream_error')
  }

  if (!content) {
    throw new DentalDescriptionError('GPT-4o returned empty content', 'parse_error')
  }

  let parsed: { dental_impact?: unknown; risk_level?: unknown; precaution?: unknown }
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new DentalDescriptionError('GPT-4o returned non-JSON content', 'parse_error')
  }

  return {
    dental_impact: typeof parsed.dental_impact === 'string' ? parsed.dental_impact : '',
    risk_level:    typeof parsed.risk_level    === 'string' ? parsed.risk_level    : '',
    precaution:    typeof parsed.precaution    === 'string' ? parsed.precaution    : '',
    active_ingredient: null,
  }
}
