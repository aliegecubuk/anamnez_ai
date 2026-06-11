// Fixed 3-field GPT-4o Structured Outputs schema for dental descriptions (DESC-03).
// disclaimer is appended server-side (DESC-06) — never model-generated.

import type { AnswerJsonSchema } from '@/lib/anamnesis/schema'

export const DESCRIPTION_SCHEMA: AnswerJsonSchema = {
  name: 'dental_description',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      dental_impact: { type: 'string' },  // line 1: dental/surgical/anesthetic impact
      risk_level:    { type: 'string' },  // line 2: risk düzeyi
      precaution:    { type: 'string' },  // line 3: önerilen önlem
    },
    required: ['dental_impact', 'risk_level', 'precaution'],
    additionalProperties: false,
  },
}
