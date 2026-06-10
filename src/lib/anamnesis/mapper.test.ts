import { describe, it, expect } from 'vitest'
import type { SnapshotQuestion } from '@/lib/templates/types'
import type { AiMappedAnswer } from './types'
import { normalizeAnswers, buildMissingAlerts } from './mapper'

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

function raw(
  question_id: string,
  answer_value: unknown,
  confidence = 0.9,
): AiMappedAnswer {
  return { question_id, answer_value: answer_value as AiMappedAnswer['answer_value'], confidence }
}

function find(answers: AiMappedAnswer[], id: string): AiMappedAnswer {
  const found = answers.find((a) => a.question_id === id)
  if (!found) throw new Error(`no answer for ${id}`)
  return found
}

describe('normalizeAnswers', () => {
  it('numeric: coerces numeric strings, nulls unparseable', () => {
    const questions = [q({ id: 'n1', question_type: 'numeric' })]
    const ok = normalizeAnswers([raw('n1', '12')], questions)
    expect(find(ok, 'n1').answer_value).toBe(12)

    const bad = normalizeAnswers([raw('n1', 'abc')], questions)
    expect(find(bad, 'n1').answer_value).toBeNull()
    expect(find(bad, 'n1').confidence).toBe(0)
  })

  it('yes_no: maps evet/true/1 → true, hayır/false/0 → false, garbage → null', () => {
    const questions = [q({ id: 'b1', question_type: 'yes_no' })]
    for (const truthy of ['evet', true, 1]) {
      expect(find(normalizeAnswers([raw('b1', truthy)], questions), 'b1').answer_value).toBe(true)
    }
    for (const falsy of ['hayır', false, 0]) {
      expect(find(normalizeAnswers([raw('b1', falsy)], questions), 'b1').answer_value).toBe(false)
    }
    const garbage = normalizeAnswers([raw('b1', 'belki belki')], questions)
    expect(find(garbage, 'b1').answer_value).toBeNull()
    expect(find(garbage, 'b1').confidence).toBe(0)
  })

  it('multi_select: filters values not present in options', () => {
    const questions = [
      q({ id: 'm1', question_type: 'multi_select', options: ['A', 'B'] }),
    ]
    const result = normalizeAnswers([raw('m1', ['A', 'X'])], questions)
    expect(find(result, 'm1').answer_value).toEqual(['A'])
  })

  it('text: trims, empty string → null', () => {
    const questions = [q({ id: 't1', question_type: 'text' })]
    const trimmed = normalizeAnswers([raw('t1', '  diş ağrısı  ')], questions)
    expect(find(trimmed, 't1').answer_value).toBe('diş ağrısı')

    const empty = normalizeAnswers([raw('t1', '   ')], questions)
    expect(find(empty, 't1').answer_value).toBeNull()
  })

  it('clamps confidence to [0, 1]', () => {
    const questions = [q({ id: 't1', question_type: 'text' })]
    const high = normalizeAnswers([raw('t1', 'x', 1.4)], questions)
    expect(find(high, 't1').confidence).toBe(1)

    const low = normalizeAnswers([raw('t1', 'x', -0.2)], questions)
    expect(find(low, 't1').confidence).toBe(0)
  })

  it('question with no raw answer → { answer_value: null, confidence: 0 }', () => {
    const questions = [q({ id: 'missing', question_type: 'text' })]
    const result = normalizeAnswers([], questions)
    expect(find(result, 'missing')).toEqual({
      question_id: 'missing',
      answer_value: null,
      confidence: 0,
    })
  })
})

describe('buildMissingAlerts', () => {
  const questions = [
    q({ id: 'r-null', required: true, prompt: 'Zorunlu boş' }),
    q({ id: 'r-answered', required: true, prompt: 'Zorunlu dolu' }),
    q({ id: 'opt-null', required: false, prompt: 'Opsiyonel boş' }),
    q({
      id: 'r-empty-multi',
      required: true,
      question_type: 'multi_select',
      options: ['A'],
      prompt: 'Zorunlu boş liste',
    }),
  ]

  const answers: AiMappedAnswer[] = [
    raw('r-null', null, 0),
    raw('r-answered', 'cevap'),
    raw('opt-null', null, 0),
    raw('r-empty-multi', [], 0.5),
  ]

  it('flags required questions with null or empty answers, skips answered and optional', () => {
    const alerts = buildMissingAlerts(answers, questions)
    const ids = alerts.map((a) => a.question_id)
    expect(ids).toContain('r-null')
    expect(ids).toContain('r-empty-multi')
    expect(ids).not.toContain('r-answered')
    expect(ids).not.toContain('opt-null')
  })

  it('includes the question prompt in each alert', () => {
    const alerts = buildMissingAlerts(answers, questions)
    const alert = alerts.find((a) => a.question_id === 'r-null')
    expect(alert?.prompt).toBe('Zorunlu boş')
  })

  it('flags required question with empty-string answer', () => {
    const alerts = buildMissingAlerts([raw('r-null', '', 0.3)], [questions[0]])
    expect(alerts.map((a) => a.question_id)).toContain('r-null')
  })
})
