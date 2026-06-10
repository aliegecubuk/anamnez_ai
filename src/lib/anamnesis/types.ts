// DB row shapes — match migration 20260611000001 columns exactly.
// Used by the anamnesis answer API routes, GPT-4o mapping pipeline, and form UI.

import type { QuestionType, SnapshotQuestion } from '@/lib/templates/types'

// Shape depends on question_type: bool / string / string[] / number.
// null = unanswered.
export type AnswerValue = boolean | string | string[] | number | null

// Mirrors public.anamnesis_answers exactly.
export interface AnamnesisAnswerRow {
  id: string
  user_id: string
  session_id: string
  question_id: string // snapshot question id inside template_versions.questions (not a live FK)
  prompt: string // denormalized snapshot for display without re-joining
  question_type: QuestionType
  answer_value: AnswerValue
  confidence: number | null // 0..1; null when human-entered without AI
  edited_by_human: boolean
  created_at: string
}

// Wire shape returned by answer fetch/update routes.
export interface AnamnesisAnswerDTO {
  question_id: string
  prompt: string
  question_type: QuestionType
  answer_value: AnswerValue
  confidence: number | null
  edited_by_human: boolean
}

// Raw GPT-4o Structured Outputs result per question.
export interface AiMappedAnswer {
  question_id: string
  answer_value: AnswerValue
  confidence: number
}

export interface AiMappingResult {
  answers: AiMappedAnswer[]
  corrected_transcript?: string
}

// ANAM-04: questions the AI could not answer from the transcript.
export interface MissingFieldAlert {
  question_id: string
  prompt: string
}

// Re-export for downstream consumers that only import from anamnesis types.
export type { QuestionType, SnapshotQuestion }
