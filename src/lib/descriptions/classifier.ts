// Answer → dental term classifier (DESC-02 scope detection, DESC-01 term enumeration).
// Pure, no I/O.

import type { AnswerValue, QuestionType } from '@/lib/anamnesis/types'
import type { DescriptionCategory } from './types'

// Allergy checked first — "ilaç alerjisi" must resolve to 'allergy' not 'medication'.
const CATEGORY_KEYWORDS: [DescriptionCategory, string[]][] = [
  ['allergy',    ['alerji', 'alerjisi', 'allerji']],
  ['medication', ['ilaç', 'ilac', 'medikasyon']],
  ['disease',    ['hastalık', 'hastalik', 'sistemik', 'rahatsızlık', 'rahatsizlik', 'kronik']],
]

export function normalizeTerm(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR')
}

function isEmptyValue(value: AnswerValue): boolean {
  if (value === null || value === undefined) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (value === false) return true
  return false
}

export function classifyAnswer(answer: {
  prompt: string
  question_type: QuestionType
  answer_value: AnswerValue
}): DescriptionCategory | null {
  if (isEmptyValue(answer.answer_value)) return null

  const normalizedPrompt = normalizeTerm(answer.prompt)
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => normalizedPrompt.includes(kw))) {
      return category
    }
  }
  return null
}

export function extractTerms(value: AnswerValue): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'boolean' || typeof value === 'number') return []

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  }

  // string: split on comma, semicolon, newline, or " ve "
  return value
    .split(/[,;\n]|(?:\s+ve\s+)/i)
    .map((item) => item.trim())
    .filter(Boolean)
}
