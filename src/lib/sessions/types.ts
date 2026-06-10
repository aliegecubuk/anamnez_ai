// DB row shapes — match migration columns exactly.
// Used by API route handlers and server components.

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped' | 'completed'

export type AudioFormat =
  | 'audio/webm;codecs=opus'
  | 'audio/webm'
  | 'audio/mp4'
  | 'audio/mp4;codecs=mp4a.40.2'
  | 'audio/mpeg'
  | 'audio/wav'

export type FormType = 'genel' | 'anamnez' | 'perio' | 'patoloji'
export type SessionStatus = 'draft' | 'completed'

// Mirrors public.sessions exactly (post-Phase-3 migration shape).
export interface SessionRow {
  id: string
  user_id: string
  patient_id: string
  form_type: FormType
  status: SessionStatus
  started_at: string
  completed_at: string | null
  audio_format: AudioFormat | null
  recorder_state: RecorderState
  dropped_chunks: number             // W-2: client-side concurrency-cap overflow counter
}

// Mirrors public.transcript_segments exactly.
export interface TranscriptSegmentRow {
  id: string
  user_id: string
  session_id: string
  sequence: number
  content: string
  started_at: string
  ended_at: string
  created_at: string
}

// Wire shape returned by SSE stream + initial fetch.
export interface TranscriptSegmentDTO {
  sequence: number
  content: string
  started_at: string
  ended_at: string
}

// POST /api/sessions body
export interface CreateSessionBody {
  patient_id: string
  form_type?: FormType        // defaults to 'genel'; forced to 'anamnez' server-side when a template is bound
  audio_format: AudioFormat
  template_version_id?: string // TPLT-05: immutable published version the session is bound to
}

// Resolved template context for a session (questions snapshot).
export interface SessionTemplateInfo {
  template_version_id: string
  version: number
  questions: import('@/lib/templates/types').SnapshotQuestion[]
}

// PATCH /api/sessions/[id]/state body
export interface UpdateRecorderStateBody {
  recorder_state: RecorderState
  dropped_chunks_increment?: number  // W-2: optional client-side overflow telemetry; 0..1000
}

// POST /api/sessions/[id]/chunks (multipart/form-data fields)
export interface ChunkUploadFields {
  sequence: string         // string in form-data; coerced to int server-side
  started_at: string       // ISO timestamp
  ended_at: string         // ISO timestamp
  // file: Blob              — sent as the 'audio' field, not in JSON
}
