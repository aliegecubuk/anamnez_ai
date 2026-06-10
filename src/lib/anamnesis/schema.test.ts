import { describe, it, expect } from 'vitest'
import type { SnapshotQuestion } from '@/lib/templates/types'
import { buildAnswerSchema } from './schema'

function q(partial: Partial<SnapshotQuestion> & { id: string }): SnapshotQuestion {
  return {
    prompt: 'Soru',
    question_type: 'text',
    options: null,
    position: 1,
    required: false,
    ...partial,
  }
}

const QUESTIONS: SnapshotQuestion[] = [
  q({ id: 'q-bool', question_type: 'yes_no', prompt: 'Sigara kullanıyor musunuz?' }),
  q({ id: 'q-text', question_type: 'text', prompt: 'Şikayetinizi anlatın' }),
  q({ id: 'q-num', question_type: 'numeric', prompt: 'Kaç yaşındasınız?' }),
  q({
    id: 'q-multi',
    question_type: 'multi_select',
    prompt: 'Hangi ilaçları kullanıyorsunuz?',
    options: ['Aspirin', 'Coumadin', 'İnsülin'],
  }),
]

type AnyRecord = Record<string, any>

function answersProps(schema: AnyRecord): AnyRecord {
  return (schema.schema as AnyRecord).properties.answers.properties
}

describe('buildAnswerSchema', () => {
  it('returns a named strict schema wrapper', () => {
    const result = buildAnswerSchema(QUESTIONS)
    expect(result.name).toBeTypeOf('string')
    expect(result.strict).toBe(true)
    expect(result.schema).toBeTypeOf('object')
  })

  it('maps each question_type to the right JSON type for value', () => {
    const props = answersProps(buildAnswerSchema(QUESTIONS))
    expect(props['q-bool'].properties.value.type).toBe('boolean')
    expect(props['q-text'].properties.value.type).toBe('string')
    expect(props['q-num'].properties.value.type).toBe('number')
    expect(props['q-multi'].properties.value.type).toBe('array')
    expect(props['q-multi'].properties.value.items.enum).toEqual([
      'Aspirin',
      'Coumadin',
      'İnsülin',
    ])
  })

  it('every answer property includes a confidence number with minimum 0 maximum 1', () => {
    const props = answersProps(buildAnswerSchema(QUESTIONS))
    for (const id of ['q-bool', 'q-text', 'q-num', 'q-multi']) {
      const confidence = props[id].properties.confidence
      expect(confidence.type).toBe('number')
      expect(confidence.minimum).toBe(0)
      expect(confidence.maximum).toBe(1)
      expect(props[id].required).toEqual(['value', 'confidence'])
      expect(props[id].additionalProperties).toBe(false)
    }
  })

  it('is strict: additionalProperties false and every question id required', () => {
    const result = buildAnswerSchema(QUESTIONS)
    const schema = result.schema as AnyRecord
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toContain('answers')
    expect(schema.required).toContain('corrected_transcript')
    const answers = schema.properties.answers
    expect(answers.additionalProperties).toBe(false)
    expect(answers.required).toEqual(
      expect.arrayContaining(['q-bool', 'q-text', 'q-num', 'q-multi']),
    )
  })

  it('includes a top-level corrected_transcript string property', () => {
    const schema = buildAnswerSchema(QUESTIONS).schema as AnyRecord
    expect(schema.properties.corrected_transcript.type).toBe('string')
  })

  it('throws for multi_select question with null or empty options', () => {
    expect(() =>
      buildAnswerSchema([q({ id: 'bad', question_type: 'multi_select', options: null })]),
    ).toThrow('multi_select question requires options')
    expect(() =>
      buildAnswerSchema([q({ id: 'bad', question_type: 'multi_select', options: [] })]),
    ).toThrow('multi_select question requires options')
  })
})
