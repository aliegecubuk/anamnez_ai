// Hospital module — identity and raw transcript stay client-only (masked out
// of transcripts, identity only embedded in the PDF). The structured output
// (Q&A + exam entries, Medula text, AI summary) can optionally be saved
// server-side as a labeled snapshot with a time-boxed expiry — see records.ts.

export type HospitalMode = 'hizli' | 'detayli'

export const HOSPITAL_MODE_LABELS: Record<HospitalMode, string> = {
  hizli: 'Hızlı (Acil)',
  detayli: 'Detaylı (Poliklinik)',
}

// Entered manually by the clinician; kept in React state only.
export interface HospitalIdentity {
  firstName: string
  lastName: string
  tcNo: string
  phone: string
}

export const EMPTY_IDENTITY: HospitalIdentity = {
  firstName: '',
  lastName: '',
  tcNo: '',
  phone: '',
}

// One extracted question/answer pair — editable on screen.
export interface HospitalEntry {
  id: string
  question: string
  answer: string
}

// Wire shape of POST /api/hospital/extract
export interface HospitalExtractBody {
  transcript: string
  mode: HospitalMode
}

// One extracted pair as returned by GPT-4o. source_quote must be a verbatim
// quote from the transcript; it is verified deterministically after parsing.
export interface HospitalExtractEntry {
  question: string
  answer: string
  source_quote: string
}

export interface HospitalExtractResult {
  entries: HospitalExtractEntry[]
  // Vital signs (TA, nabız, ateş, SpO2, solunum sayısı) and physical exam
  // findings — same shape as entries, rendered as a separate group.
  exam_entries: HospitalExtractEntry[]
  // Entries dropped because their source_quote was not found in the transcript
  // (likely hallucinations). Single list covering both entries and
  // exam_entries; returned so the UI can surface them if needed.
  dropped?: HospitalExtractEntry[]
}

// ── Clinical insight (summary + differentials + red flags) ──────────────────

// One question/answer pair as insight input — identity never appears here:
// insight is fed from the extracted/edited entries, never from HospitalIdentity.
export interface HospitalInsightInputEntry {
  question: string
  answer: string
}

// Wire shape of POST /api/hospital/insight
export interface HospitalInsightBody {
  entries: HospitalInsightInputEntry[]
  exam_entries: HospitalInsightInputEntry[]
  mode: HospitalMode
}

export interface HospitalInsightResult {
  summary: string
  differentials: string[]
  red_flags: string[]
}

// Fixed disclaimer under the insight card and in the PDF summary section.
export const AI_INSIGHT_DISCLAIMER =
  'Bu içerik yapay zekâ tarafından üretilmiştir; klinik karar desteği değildir. Tanı ve tedavi sorumluluğu hekime aittir.'

// Quick complaint chips next to the recording panel: the patient points at the
// problem instead of saying it; one tap adds/appends a "Şikâyet" Q&A row.
export const COMPLAINT_CHIPS: Record<HospitalMode, string[]> = {
  hizli: [
    'Göğüs ağrısı',
    'Nefes darlığı',
    'Karın ağrısı',
    'Ateş',
    'Bilinç değişikliği',
    'Kanama',
    'Bulantı/kusma',
  ],
  detayli: [
    'Baş ağrısı',
    'Karın ağrısı',
    'Bel ağrısı',
    'Diş ağrısı',
    'Öksürük',
    'Ateş',
    'Bulantı/kusma',
    'Yorgunluk',
  ],
}
