// Raw DB row shapes (match migration columns exactly)
export interface PatientRow {
  id: string
  user_id: string                // Clerk userId
  clinic_id: string | null       // forward-compat; nullable
  full_name: string
  tc_kimlik_no: string            // raw 11-digit value — never expose to clients
  created_at: string
}

export interface SessionRow {
  id: string
  user_id: string
  patient_id: string
  form_type: 'genel' | 'anamnez' | 'perio' | 'patoloji'
  status: 'draft' | 'completed'
  started_at: string
  completed_at: string | null
}

// API response shapes (TC always masked)
export interface PatientListItem {
  id: string
  full_name: string
  tc_kimlik_no_masked: string    // '•••••••••XX'
  last_session_at: string | null
}

export interface PatientResponse {
  id: string
  full_name: string
  tc_kimlik_no_masked: string
  created_at: string
  sessions: SessionSummary[]
}

export interface SessionSummary {
  id: string
  form_type: SessionRow['form_type']
  status: SessionRow['status']
  started_at: string
  completed_at: string | null
}

// Utility: mask TC kimlik no to last 2 digits
// maskTc('12345678901') → '•••••••••01'
export function maskTc(tc: string): string {
  if (!tc || tc.length < 2) return '•••••••••••'
  const visible = tc.slice(-2)
  return '•••••••••' + visible
}
