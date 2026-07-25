// Hospital module — fully ephemeral: no DB rows, all state lives in the client.
// Identity never leaves the device (masked out of transcripts, only embedded in the PDF).

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

export interface HospitalExtractResult {
  entries: Array<{ question: string; answer: string }>
}
