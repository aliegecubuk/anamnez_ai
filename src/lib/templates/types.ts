// DB row shapes — match migration 20260611000001 columns exactly.
// Used by template CRUD API routes, admin UI, and the AI mapping pipeline.

export type QuestionType = 'yes_no' | 'text' | 'multi_select' | 'numeric'

export type Department =
  | 'genel'
  | 'periodontoloji'
  | 'pedodonti'
  | 'endodonti'
  | 'cerrahi'
  | 'ortodonti'

// Mirrors public.template_questions exactly (editable working set).
export interface TemplateQuestionRow {
  id: string
  user_id: string
  template_id: string
  prompt: string
  question_type: QuestionType
  options: string[] | null // required only for multi_select
  position: number
  required: boolean
  created_at: string
}

// Mirrors public.form_templates exactly (mutable header).
export interface FormTemplateRow {
  id: string
  user_id: string
  name: string
  department: Department
  is_archived: boolean
  current_version: number // 0 = no published version yet
  created_at: string
  updated_at: string
}

// Shape of each object inside template_versions.questions jsonb (frozen snapshot).
export interface SnapshotQuestion {
  id: string
  prompt: string
  question_type: QuestionType
  options: string[] | null
  position: number
  required: boolean
}

// Mirrors public.template_versions exactly (immutable published snapshot — TPLT-04).
export interface TemplateVersionRow {
  id: string
  user_id: string
  template_id: string
  version: number
  name: string
  department: Department
  questions: SnapshotQuestion[]
  created_at: string
}

// GET /api/templates list item
export interface TemplateListItem {
  id: string
  name: string
  department: Department
  current_version: number
  question_count: number
  updated_at: string
  // TPLT-05: id of the currently-published template_versions row (null = no published version).
  latest_version_id: string | null
}

// POST /api/templates body
export interface CreateTemplateBody {
  name: string
  department: Department
}

// POST/PATCH question body
export interface UpsertQuestionBody {
  prompt: string
  question_type: QuestionType
  options?: string[] | null
  required?: boolean
}

export const VALID_QUESTION_TYPES: QuestionType[] = [
  'yes_no',
  'text',
  'multi_select',
  'numeric',
]

export const VALID_DEPARTMENTS: Department[] = [
  'genel',
  'periodontoloji',
  'pedodonti',
  'endodonti',
  'cerrahi',
  'ortodonti',
]
