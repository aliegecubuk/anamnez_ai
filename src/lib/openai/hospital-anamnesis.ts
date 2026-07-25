// GPT-4o hospital anamnesis extractor.
// Pulls ONLY the question/answer pairs explicitly spoken in the conversation —
// no invented headings, no filled-in defaults. Two output groups: entries
// (anamnez) and exam_entries (vital signs + physical exam findings).
// Two modes: hizli (acil, critical items only) and detayli (poliklinik,
// everything discussed).
// Anti-hallucination: every entry must carry a verbatim source_quote, verified
// deterministically against the transcript after parsing (see groundEntries).

import { getOpenAIClient } from '@/lib/openai/whisper'
import type { HospitalExtractEntry, HospitalExtractResult, HospitalMode } from '@/lib/hospital/types'

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
- "source_quote": cevabı kanıtlayan, transkriptten BİREBİR kopyalanmış alıntı — kelimesi kelimesine, özetlemeden, yeniden yazmadan.

İki ayrı liste döndür:
- "entries": anamnez soru-cevapları (şikâyet, öykü, özgeçmiş, ilaçlar, alerjiler, soygeçmiş, alışkanlıklar vb.).
- "exam_entries": vital bulgular (TA, nabız, ateş, SpO2, solunum sayısı) ve fizik muayene bulguları (örn. "TA" → "120/80 mmHg", "Batın muayenesi" → "Defans ve rebaund yok"). Aynı alanlarla (question/answer/source_quote). Vital veya muayene bulgusu konuşulmadıysa boş liste döndür.

KESİN KURALLAR:
1. SADECE transkriptte açıkça konuşulan bilgileri çıkar. HİÇBİR ŞEY uydurma.
2. Konuşulmayan başlığı EKLEME — sorulmamış/söylenmemiş konu için entry oluşturma.
3. "Yok/hayır" cevapları da bilgidir: hasta açıkça söylediyse yaz (örn. "Bilinen alerjisi yok").
4. Hasta adı, soyadı, TC no, telefon gibi kimlik bilgilerini ASLA yazma; transkriptte maskelenmiş (***) ifadeleri yok say.
5. Aynı konuyu tek entry'de topla; entry'leri konuşma akışındaki sırayla ver.
6. Cevaplar Medula serbest metnine girecek: net, kısa, klinik dil.
7. "source_quote" transkriptte BİREBİR geçen ardışık sözler olmalıdır. Birebir eşleşmeyen alıntılar sistem tarafından otomatik silinir ve entry kaybolur — alıntıyı asla uydurma. Bu kural her iki liste için de geçerlidir.`

const MODE_INSTRUCTIONS: Record<HospitalMode, string> = {
  hizli: `MOD: HIZLI (ACİL). Yalnızca en kritik bilgileri çıkar: ana şikâyet, başlangıç/süre, eşlik eden semptomlar, bilinen kronik hastalıklar, kullanılan ilaçlar, alerjiler, (belirtilmişse) gebelik ve antikoagülan kullanımı. Bunların dışındaki ayrıntıları atla.`,
  detayli: `MOD: DETAYLI (POLİKLİNİK). Konuşmada geçen TÜM anamnez bilgilerini kapsamlı çıkar: şikâyet ve hikâyesi, sistem sorgusu, özgeçmiş (hastalıklar, ameliyatlar, yatışlar), kullanılan ilaçlar, alerjiler, soygeçmiş, alışkanlıklar (sigara, alkol), sosyal öykü — yine yalnızca açıkça konuşulanlar.`,
}

// Same item shape for both lists (anamnez entries + physical exam entries).
const ENTRY_ITEM = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    answer: { type: 'string' },
    source_quote: { type: 'string' },
  },
  required: ['question', 'answer', 'source_quote'],
  additionalProperties: false,
} as const

export const HOSPITAL_SCHEMA = {
  name: 'hospital_anamnesis_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      entries: { type: 'array', items: ENTRY_ITEM },
      exam_entries: { type: 'array', items: ENTRY_ITEM },
    },
    required: ['entries', 'exam_entries'],
    additionalProperties: false,
  },
}

// Turkish-aware normalization for the grounding check. toLocaleLowerCase('tr-TR')
// folds İ→i and I→ı correctly (plain toLowerCase misses the Turkish pairs) —
// same case-folding approach as masking.ts. All non-letter/digit characters are
// stripped so casing, extra whitespace and punctuation never cause false drops.
function normalizeForGrounding(text: string): string {
  return text.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '')
}

// Deterministic anti-hallucination gate: an entry survives only if its
// verbatim source_quote is literally found in the transcript. Unverifiable
// entries (including empty quotes) are dropped, never thrown. Both lists
// (anamnez + exam) go through the same gate; drops land in one shared list.
function groundEntries(
  entries: HospitalExtractEntry[],
  examEntries: HospitalExtractEntry[],
  transcript: string,
): HospitalExtractResult {
  const haystack = normalizeForGrounding(transcript)
  const kept: HospitalExtractEntry[] = []
  const keptExam: HospitalExtractEntry[] = []
  const dropped: HospitalExtractEntry[] = []
  for (const entry of entries) {
    const needle = normalizeForGrounding(entry?.source_quote ?? '')
    if (needle && haystack.includes(needle)) {
      kept.push(entry)
    } else {
      dropped.push(entry)
    }
  }
  for (const entry of examEntries) {
    const needle = normalizeForGrounding(entry?.source_quote ?? '')
    if (needle && haystack.includes(needle)) {
      keptExam.push(entry)
    } else {
      dropped.push(entry)
    }
  }
  return { entries: kept, exam_entries: keptExam, dropped }
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
      temperature: 0,
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

  let parsed: { entries?: HospitalExtractEntry[]; exam_entries?: HospitalExtractEntry[] }
  try {
    parsed = JSON.parse(content) as typeof parsed
  } catch {
    throw new HospitalParseError('GPT-4o returned non-JSON content', 'parse_error')
  }

  const entries = Array.isArray(parsed.entries) ? parsed.entries : []
  const examEntries = Array.isArray(parsed.exam_entries) ? parsed.exam_entries : []
  return groundEntries(entries, examEntries, transcript)
}
