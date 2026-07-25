// GPT-4o hospital anamnesis extractor.
// Pulls ONLY the question/answer pairs explicitly spoken in the conversation —
// no invented headings, no filled-in defaults. Two modes: hizli (acil, critical
// items only) and detayli (poliklinik, everything discussed).

import { getOpenAIClient } from '@/lib/openai/whisper'
import type { HospitalExtractResult, HospitalMode } from '@/lib/hospital/types'

export type HospitalParseErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class HospitalParseError extends Error {
  code: HospitalParseErrorCode
  constructor(message: string, code: HospitalParseErrorCode) {
    super(message)
    this.name = 'HospitalParseError'
    this.code = code
  }
}

const COMMON_RULES = `Sen bir hastane anamnez asistanısın. Türkçe hasta görüşme transkriptinden yapılandırılmış anamnez çıkarıyorsun.

Her entry bir soru-cevap çiftidir:
- "question": kısa klinik başlık (örn. "Şikâyet", "Şikâyet süresi", "Eşlik eden semptomlar", "Kronik hastalıklar", "Kullandığı ilaçlar", "Alerjiler").
- "answer": kısa, üçüncü şahıs klinik ifade (örn. "1 saat önce başlayan karın ağrısı", "Bulantı ve terleme mevcut", "Bilinen tansiyon hastası").

KESİN KURALLAR:
1. SADECE transkriptte açıkça konuşulan bilgileri çıkar. HİÇBİR ŞEY uydurma.
2. Konuşulmayan başlığı EKLEME — sorulmamış/söylenmemiş konu için entry oluşturma.
3. "Yok/hayır" cevapları da bilgidir: hasta açıkça söylediyse yaz (örn. "Bilinen alerjisi yok").
4. Hasta adı, soyadı, TC no, telefon gibi kimlik bilgilerini ASLA yazma; transkriptte maskelenmiş (***) ifadeleri yok say.
5. Aynı konuyu tek entry'de topla; entry'leri konuşma akışındaki sırayla ver.
6. Cevaplar Medula serbest metnine girecek: net, kısa, klinik dil.`

const MODE_INSTRUCTIONS: Record<HospitalMode, string> = {
  hizli: `MOD: HIZLI (ACİL). Yalnızca en kritik bilgileri çıkar: ana şikâyet, başlangıç/süre, eşlik eden semptomlar, bilinen kronik hastalıklar, kullanılan ilaçlar, alerjiler, (belirtilmişse) gebelik ve antikoagülan kullanımı. Bunların dışındaki ayrıntıları atla.`,
  detayli: `MOD: DETAYLI (POLİKLİNİK). Konuşmada geçen TÜM anamnez bilgilerini kapsamlı çıkar: şikâyet ve hikâyesi, sistem sorgusu, özgeçmiş (hastalıklar, ameliyatlar, yatışlar), kullanılan ilaçlar, alerjiler, soygeçmiş, alışkanlıklar (sigara, alkol), sosyal öykü — yine yalnızca açıkça konuşulanlar.`,
}

export const HOSPITAL_SCHEMA = {
  name: 'hospital_anamnesis_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['question', 'answer'],
          additionalProperties: false,
        },
      },
    },
    required: ['entries'],
    additionalProperties: false,
  },
}

export async function parseHospitalAnamnesis(
  transcript: string,
  mode: HospitalMode,
): Promise<HospitalExtractResult> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `${COMMON_RULES}\n\n${MODE_INSTRUCTIONS[mode]}` },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_schema', json_schema: HOSPITAL_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new HospitalParseError(`GPT-4o hospital anamnesis parse failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new HospitalParseError('GPT-4o returned empty content', 'parse_error')

  try {
    return JSON.parse(content) as HospitalExtractResult
  } catch {
    throw new HospitalParseError('GPT-4o returned non-JSON content', 'parse_error')
  }
}
