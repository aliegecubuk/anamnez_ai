// Section-based anamnesis types (Özgeçmiş / Soygeçmiş sınıflandırma).
// Six fixed sections mirror the Hacettepe anamnesis form layout.

export const SECTION_KEYS = [
  'gen_sikayet',
  'gen_vital',
  'oz_cocukluk',
  'oz_dis',
  'oz_genel',
  'soy_sahsi',
  'soy_ekstraoral',
  'soy_intraoral',
  'mua_hijyen',
  'mua_radyoloji',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export type SectionGroup = 'genel' | 'ozgecmis' | 'soygecmis' | 'muayene'

export const GROUP_ORDER: SectionGroup[] = ['genel', 'ozgecmis', 'soygecmis', 'muayene']

export const SECTION_GROUPS: Record<SectionGroup, SectionKey[]> = {
  genel:     ['gen_sikayet', 'gen_vital'],
  ozgecmis:  ['oz_cocukluk', 'oz_dis', 'oz_genel'],
  soygecmis: ['soy_sahsi', 'soy_ekstraoral', 'soy_intraoral'],
  muayene:   ['mua_hijyen', 'mua_radyoloji'],
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  gen_sikayet:    'a) Şikâyet ve hikâyesi',
  gen_vital:      'b) Vital bulgular',
  oz_cocukluk:    'a) Çocukluk hastalıkları',
  oz_dis:         'b) Diş hekimliği yönünden',
  oz_genel:       'c) Genel sağlık yönünden',
  soy_sahsi:      'a) Şahsi ve sosyal hikâye',
  soy_ekstraoral: 'b) Ekstraoral bulgular',
  soy_intraoral:  'c) İntraoral bulgular',
  mua_hijyen:     'a) Ağız hijyeni',
  mua_radyoloji:  'b) Radyolojik bulgular',
}

export const GROUP_LABELS: Record<SectionGroup, string> = {
  genel:     'ŞİKÂYET & GENEL',
  ozgecmis:  'ÖZGEÇMİŞ',
  soygecmis: 'SOY GEÇMİŞİ',
  muayene:   'MUAYENE & RADYOLOJİ',
}

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && (SECTION_KEYS as readonly string[]).includes(value)
}

// --- Entries ---------------------------------------------------------------

export interface AnamnesisEntryDTO {
  id: string
  section_key: SectionKey
  content: string
  confidence: number | null
  source: 'ai' | 'manual'
  edited_by_human: boolean
  display_order: number
}

// --- Medications -----------------------------------------------------------

export type BlocksTreatment = 'engel_yok' | 'dikkat' | 'kontrendike_olabilir'

export const BLOCKS_TREATMENT_LABELS: Record<BlocksTreatment, string> = {
  engel_yok:             'Engel yok',
  dikkat:                'Dikkat gerektirir',
  kontrendike_olabilir:  'Kontrendike olabilir',
}

export interface MedicationDTO {
  id: string
  name: string
  active_ingredient: string | null
  summary: string | null
  dental_significance: string | null
  surgical_precautions: string | null
  blocks_treatment: BlocksTreatment | null
  risk_level: 'düşük' | 'orta' | 'yüksek' | null
}

// --- AI Report -------------------------------------------------------------

export interface AiReportDTO {
  summary: string
  dental_considerations: string[]
  risk_flags: string[]
  recommendations: string[]
  generated_at: string
}

export const AI_REPORT_DISCLAIMER =
  'Bu rapor yapay zekâ desteğiyle oluşturulmuş bir ön değerlendirmedir. Klinik karar ve sorumluluk hekime aittir.'

// --- Parse results (GPT output shapes) --------------------------------------

export interface ParsedSectionItem {
  content: string
  confidence: number
}

export interface StructuredParseResult {
  sections: Record<SectionKey, ParsedSectionItem[]>
  medications: string[]
}

export interface MedicationEnrichment {
  name: string
  active_ingredient: string
  summary: string
  dental_significance: string
  surgical_precautions: string
  blocks_treatment: BlocksTreatment
  risk_level: 'düşük' | 'orta' | 'yüksek'
}

export interface AiReportResult {
  summary: string
  dental_considerations: string[]
  risk_flags: string[]
  recommendations: string[]
}

// Full payload returned by GET/POST /api/sessions/[id]/structured
export interface StructuredAnamnesisPayload {
  entries: AnamnesisEntryDTO[]
  medications: MedicationDTO[]
  report: AiReportDTO | null
}
