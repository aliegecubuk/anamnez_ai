// GPT-4o medication enrichment.
// Etken madde + genel özet + diş hekimliği önemi + cerrahi/işlem engeli.

import { getOpenAIClient } from '@/lib/openai/whisper'
import type { MedicationEnrichment } from '@/lib/anamnesis/structured-types'

export type MedicationEnrichErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class MedicationEnrichError extends Error {
  code: MedicationEnrichErrorCode
  constructor(message: string, code: MedicationEnrichErrorCode) {
    super(message)
    this.name = 'MedicationEnrichError'
    this.code = code
  }
}

export const MEDICATION_SYSTEM_PROMPT = `Sen bir diş hekimliği klinik farmakoloji asistanısın. Verilen ilaç (marka adı veya etken madde) için diş hekimine yönelik bilgi kartı üret. Tüm alanlar Türkçe olmalı.

Alanlar:
- name: İlacın verilen adı (düzeltilmiş yazımla).
- active_ingredient: Etken madde(ler). Marka adı verildiyse etken maddeyi belirt; zaten etken maddeyse aynısını yaz.
- summary: İlacın genel özeti — ne için kullanılır, hangi ilaç grubundandır (1-2 cümle).
- dental_significance: Diş hekimliği açısından önemi — dental tedavi, lokal anestezi, kanama, yara iyileşmesi, ilaç etkileşimi açısından ne anlama gelir (1-2 cümle).
- surgical_precautions: Diş çekimi, implant, cerrahi işlem öncesi/sırası alınması gereken somut önlemler (1-2 cümle; önlem gerekmiyorsa bunu açıkça yaz).
- blocks_treatment: İşlem/ameliyat engel durumu — "engel_yok" (rutin işlemlere engel değil), "dikkat" (önlem/konsültasyon ile yapılabilir), "kontrendike_olabilir" (bazı işlemler ertelenmeli veya hekim konsültasyonu şart; örn. IV bifosfonat → MRONJ riski, yüksek doz antikoagülan).
- risk_level: Diş hekimliği işlemleri açısından genel risk — "düşük", "orta" veya "yüksek".

Kurallar:
1. Bilinmeyen/uydurma bir ilaç adıysa alanları en yakın bilinen ilaca göre DEĞİL, "bilinmiyor" diyerek doldur ve blocks_treatment: "dikkat", risk_level: "orta" ver.
2. Genel tıbbi tedavi önerisi verme; sadece diş hekimliği perspektifi.
3. Doz değişikliği önerme; gerekiyorsa "reçete eden hekimle konsültasyon" de.

JSON şemasına tam uyacak şekilde cevap ver.`

const MEDICATION_SCHEMA = {
  name: 'medication_enrichment',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      name:                 { type: 'string' },
      active_ingredient:    { type: 'string' },
      summary:              { type: 'string' },
      dental_significance:  { type: 'string' },
      surgical_precautions: { type: 'string' },
      blocks_treatment:     { type: 'string', enum: ['engel_yok', 'dikkat', 'kontrendike_olabilir'] },
      risk_level:           { type: 'string', enum: ['düşük', 'orta', 'yüksek'] },
    },
    required: [
      'name', 'active_ingredient', 'summary', 'dental_significance',
      'surgical_precautions', 'blocks_treatment', 'risk_level',
    ],
    additionalProperties: false,
  },
}

export async function enrichMedication(name: string): Promise<MedicationEnrichment> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: MEDICATION_SYSTEM_PROMPT },
        { role: 'user', content: `İlaç: ${name}` },
      ],
      response_format: { type: 'json_schema', json_schema: MEDICATION_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new MedicationEnrichError(`GPT-4o medication enrichment failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new MedicationEnrichError('GPT-4o returned empty content', 'parse_error')

  try {
    return JSON.parse(content) as MedicationEnrichment
  } catch {
    throw new MedicationEnrichError('GPT-4o returned non-JSON content', 'parse_error')
  }
}
