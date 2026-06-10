// Pure post-processing for GPT-4o mapped answers (ANAM-01/02/04).
// LLM output is untrusted (T-04-08) — every value is coerced to its
// question_type here before anything is persisted or rendered.

import type { SnapshotQuestion } from '@/lib/templates/types'
import type { AiMappedAnswer, AnswerValue, MissingFieldAlert } from './types'

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

// Turkish + generic boolean tokens GPT may emit as strings.
const TRUE_TOKENS = new Set(['evet', 'true', 'var', '1'])
const FALSE_TOKENS = new Set(['hayır', 'hayir', 'false', 'yok', '0'])

function coerceYesNo(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return null
  }
  if (typeof value === 'string') {
    const token = value.trim().toLocaleLowerCase('tr-TR')
    if (TRUE_TOKENS.has(token)) return true
    if (FALSE_TOKENS.has(token)) return false
  }
  return null
}

function coerceNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed.replace(',', '.')) // Turkish decimal comma
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function coerceText(value: unknown): string | null {
  if (typeof value !== 'string') {
    if (value === null || value === undefined) return null
    return coerceText(String(value))
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function coerceMultiSelect(value: unknown, options: string[] | null): string[] | null {
  if (!Array.isArray(value)) return null
  const allowed = new Set(options ?? [])
  return value.filter((item): item is string => typeof item === 'string' && allowed.has(item))
}

function coerceValue(value: unknown, question: SnapshotQuestion): AnswerValue {
  switch (question.question_type) {
    case 'yes_no':
      return coerceYesNo(value)
    case 'numeric':
      return coerceNumeric(value)
    case 'text':
      return coerceText(value)
    case 'multi_select':
      return coerceMultiSelect(value, question.options)
  }
}

/**
 * Coerce raw GPT answers to their question_type and clamp confidence to [0,1].
 * Questions without a raw entry — or whose value cannot be coerced — yield
 * { answer_value: null, confidence: 0 }.
 */
export function normalizeAnswers(
  raw: AiMappedAnswer[],
  questions: SnapshotQuestion[],
): AiMappedAnswer[] {
  const byId = new Map(raw.map((answer) => [answer.question_id, answer]))

  return questions.map((question) => {
    const entry = byId.get(question.id)
    if (!entry || entry.answer_value === null || entry.answer_value === undefined) {
      return { question_id: question.id, answer_value: null, confidence: 0 }
    }

    const coerced = coerceValue(entry.answer_value, question)
    if (coerced === null) {
      return { question_id: question.id, answer_value: null, confidence: 0 }
    }

    return {
      question_id: question.id,
      answer_value: coerced,
      confidence: clamp01(entry.confidence),
    }
  })
}

function isEmptyAnswer(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * ANAM-04: alerts for every REQUIRED question whose answer is null/''/[].
 * Consumed by 04-04 to surface "AI could not answer" warnings in the form UI.
 */
export function buildMissingAlerts(
  answers: AiMappedAnswer[],
  questions: SnapshotQuestion[],
): MissingFieldAlert[] {
  const byId = new Map(answers.map((answer) => [answer.question_id, answer]))
  const alerts: MissingFieldAlert[] = []

  for (const question of questions) {
    if (!question.required) continue
    if (isEmptyAnswer(byId.get(question.id)?.answer_value)) {
      alerts.push({ question_id: question.id, prompt: question.prompt })
    }
  }

  return alerts
}
