// GPT-4o section-based anamnesis classifier.
// Places Turkish anamnesis dictation into the 6 fixed Hacettepe-form sections
// (Özgeçmiş a/b/c + Soygeçmiş a/b/c) and extracts mentioned medications.

import { getOpenAIClient } from '@/lib/openai/whisper'
import type { StructuredParseResult } from '@/lib/anamnesis/structured-types'

export type StructuredParseErrorCode = 'missing_api_key' | 'upstream_error' | 'parse_error'

export class StructuredParseError extends Error {
  code: StructuredParseErrorCode
  constructor(message: string, code: StructuredParseErrorCode) {
    super(message)
    this.name = 'StructuredParseError'
    this.code = code
  }
}

export const STRUCTURED_SYSTEM_PROMPT = `Sen bir diş hekimliği anamnez asistanısın. Türkçe hasta görüşme transkriptindeki bilgileri aşağıdaki 10 sabit bölüme sınıflandır. Her bilgi kısa, tek satırlık klinik bir ifade olmalı (örn: "Çocuklukta kızamık geçirmiş", "Günde 1 paket sigara içiyor").

ŞİKÂYET & GENEL bölümleri:
1. gen_sikayet — a) Şikâyet ve hikâyesi: hastanın geliş sebebi, ana şikâyet, ağrının yeri/karakteri/süresi, şikâyetin ne zaman başladığı ve seyri, daha önce yapılan tedavi girişimleri, hastanın kendi ifadeleri.
2. gen_vital — b) Vital bulgular: tansiyon, nabız, solunum/teneffüs sayısı, ateş, boy, kilo.

ÖZGEÇMİŞ bölümleri:
3. oz_cocukluk — a) Çocukluk hastalıkları: kızamık, kızamıkçık, kabakulak, suçiçeği, kızıl, boğmaca, romatizmal ateş, çocuklukta geçirilen ameliyat/hastalıklar, aşı öyküsü.
4. oz_dis — b) Diş hekimliği yönünden: son diş hekimi ziyareti, yapılan işlemler (dolgu, kron, protez, kanal tedavisi, çekim), lokal anestezi deneyimi ve anestezi alerjisi, çekim/işlem sonrası kanama problemi, diş hekimi korkusu, önceki dental komplikasyonlar.
5. oz_genel — c) Genel sağlık yönünden: kalp hastalıkları ve kan sulandırıcı kullanımı, diyabet (DM), hipertansiyon (HT), astım/solunum sistemi hastalıkları, epilepsi, kanser öyküsü ve kemoterapi/radyoterapi (KT/RT), bulaşıcı hastalıklar (hepatit, HIV, tüberküloz), kanama diyatezi (anemi, hemofili, faktör eksikliği), hamilelik, menopoz/osteoporoz, kullanılan ilaçlar, ilaç/gıda alerjileri, geçirilmiş ameliyatlar, ameliyat sonrası kanama.

SOY GEÇMİŞİ bölümleri:
6. soy_sahsi — a) Şahsi ve sosyal hikâye: sigara, alkol, madde kullanımı, parafonksiyonel alışkanlıklar (tırnak yeme, dudak ısırma, dil itme, bruksizm/diş sıkma), meslek, medeni durum, akraba evliliği, ailesel/kalıtsal hastalıklar.
7. soy_ekstraoral — b) Ekstraoral bulgular: lenf nodu muayenesi, TME (çene eklemi) bulguları, sinüs hassasiyeti, kas muayenesi, yüz asimetrisi, cilt/göz/burun/kulak bulguları, boyun, eller ve tırnaklar.
8. soy_intraoral — c) İntraoral bulgular: dudak, dil, damak, diş eti, uvula, yanak mukozası, tükürük bezleri, dişlerin durumu (inspeksiyon, perküsyon, mobilite, periodontal sond bulguları), fistül ağzı, kırık/çatlak diş, protez uyumu.

MUAYENE & RADYOLOJİ bölümleri:
9. mua_hijyen — a) Ağız hijyeni: diş fırçalama sıklığı ve yöntemi, diş ipi/arayüz fırçası kullanımı, gargara, plak/biyofilm miktarı, diş taşı, ağız kuruluğu.
10. mua_radyoloji — b) Radyolojik bulgular: panoramik/periapikal film bulguları, alveolar kemik kaybı (horizontal/vertikal), lamina dura, periapikal lezyon, gömülü diş, kök kırığı, trabekülasyon değişiklikleri, hatalı restorasyon görüntüsü.

Ayrıca hastanın kullandığı TÜM ilaçları "medications" listesine ekle (marka veya etken madde adı, transkriptte geçtiği şekliyle; doz bilgisi varsa isimden ayır, sadece ilaç adını yaz).

Kurallar:
1. Sadece transkriptte açıkça geçen bilgileri yaz. Bilgi uydurma.
2. Her bilgiyi EN uygun tek bölüme koy; aynı bilgiyi iki bölüme yazma. (İstisna: kullanılan ilaçlar hem oz_genel'e satır olarak hem medications listesine yazılır.)
3. Her satır için 0-1 arası confidence ver; belirsiz duyduğun bilgide düşük ver.
4. Transkriptte hiç bilgi yoksa ilgili bölümü boş bırak.
5. Hasta adı, TC no gibi kimlik bilgilerini satırlara YAZMA.

JSON şemasına tam uyacak şekilde cevap ver.`

const SECTION_ITEMS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      content:    { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['content', 'confidence'],
    additionalProperties: false,
  },
}

const STRUCTURED_SCHEMA = {
  name: 'structured_anamnesis_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'object',
        properties: {
          gen_sikayet:    SECTION_ITEMS_SCHEMA,
          gen_vital:      SECTION_ITEMS_SCHEMA,
          oz_cocukluk:    SECTION_ITEMS_SCHEMA,
          oz_dis:         SECTION_ITEMS_SCHEMA,
          oz_genel:       SECTION_ITEMS_SCHEMA,
          soy_sahsi:      SECTION_ITEMS_SCHEMA,
          soy_ekstraoral: SECTION_ITEMS_SCHEMA,
          soy_intraoral:  SECTION_ITEMS_SCHEMA,
          mua_hijyen:     SECTION_ITEMS_SCHEMA,
          mua_radyoloji:  SECTION_ITEMS_SCHEMA,
        },
        required: [
          'gen_sikayet', 'gen_vital',
          'oz_cocukluk', 'oz_dis', 'oz_genel',
          'soy_sahsi', 'soy_ekstraoral', 'soy_intraoral',
          'mua_hijyen', 'mua_radyoloji',
        ],
        additionalProperties: false,
      },
      medications: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['sections', 'medications'],
    additionalProperties: false,
  },
}

export async function parseStructuredAnamnesis(transcript: string): Promise<StructuredParseResult> {
  const openai = getOpenAIClient()

  let content: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: STRUCTURED_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_schema', json_schema: STRUCTURED_SCHEMA },
    })
    content = completion.choices[0]?.message?.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new StructuredParseError(`GPT-4o structured anamnesis parse failed: ${msg}`, 'upstream_error')
  }

  if (!content) throw new StructuredParseError('GPT-4o returned empty content', 'parse_error')

  try {
    return JSON.parse(content) as StructuredParseResult
  } catch {
    throw new StructuredParseError('GPT-4o returned non-JSON content', 'parse_error')
  }
}
