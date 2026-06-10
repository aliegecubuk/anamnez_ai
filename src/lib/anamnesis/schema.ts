// Dynamic GPT-4o Structured Outputs schema builder (ANAM-01).
// Builds a strict JSON schema from a template version's frozen question snapshot
// so the model can only return per-question { value, confidence } pairs.

import type { SnapshotQuestion } from '@/lib/templates/types'

type JsonSchema = Record<string, unknown>

export interface AnswerJsonSchema {
  name: string
  strict: true
  schema: JsonSchema
}

// Map a question to the JSON-schema fragment constraining its `value`.
// LLM output is untrusted (T-04-08) — multi_select values are enum-locked to options.
function valueSchemaFor(question: SnapshotQuestion): JsonSchema {
  switch (question.question_type) {
    case 'yes_no':
      return { type: 'boolean' }
    case 'text':
      return { type: 'string' }
    case 'numeric':
      return { type: 'number' }
    case 'multi_select':
      if (!question.options || question.options.length === 0) {
        throw new Error('multi_select question requires options')
      }
      return {
        type: 'array',
        items: { type: 'string', enum: question.options },
      }
  }
}

/**
 * Build a strict structured-output schema for a set of snapshot questions.
 * - `answers` is keyed by question.id; each entry = { value, confidence 0..1 }.
 * - `corrected_transcript` lets GPT-4o fix proper-noun / Turkish-number drift.
 * - additionalProperties:false + full required lists → OpenAI strict mode valid.
 */
export function buildAnswerSchema(questions: SnapshotQuestion[]): AnswerJsonSchema {
  const answerProperties: Record<string, JsonSchema> = {}

  for (const question of questions) {
    answerProperties[question.id] = {
      type: 'object',
      properties: {
        value: valueSchemaFor(question),
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['value', 'confidence'],
      additionalProperties: false,
    }
  }

  return {
    name: 'anamnesis_answers',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'object',
          properties: answerProperties,
          required: questions.map((question) => question.id),
          additionalProperties: false,
        },
        corrected_transcript: { type: 'string' },
      },
      required: ['answers', 'corrected_transcript'],
      additionalProperties: false,
    },
  }
}
