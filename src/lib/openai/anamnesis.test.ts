import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SnapshotQuestion } from '@/lib/templates/types'

// Stub the lazy OpenAI singleton — no live API calls in tests.
vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import { mapTranscriptToAnswers, AnamnesisMappingError } from './anamnesis'

const QUESTIONS: SnapshotQuestion[] = [
  {
    id: 'q-smoke',
    prompt: 'Sigara kullanıyor musunuz?',
    question_type: 'yes_no',
    options: null,
    position: 1,
    required: true,
  },
  {
    id: 'q-age',
    prompt: 'Kaç yaşındasınız?',
    question_type: 'numeric',
    options: null,
    position: 2,
    required: false,
  },
]

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => {
  vi.mocked(getOpenAIClient).mockReset()
})

describe('mapTranscriptToAnswers', () => {
  it('calls chat.completions.create with strict json_schema response_format', async () => {
    const { client, create } = fakeClient(
      JSON.stringify({
        answers: {
          'q-smoke': { value: true, confidence: 0.95 },
          'q-age': { value: '42', confidence: 0.8 },
        },
        corrected_transcript: 'Düzeltilmiş transkript',
      }),
    )
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    await mapTranscriptToAnswers('ham transkript', QUESTIONS)

    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
    expect(
      args.response_format.json_schema.schema.properties.answers.properties['q-smoke'],
    ).toBeDefined()
    // user message carries the transcript
    const userMsg = args.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMsg.content).toContain('ham transkript')
  })

  it('normalizes answers and surfaces corrected_transcript', async () => {
    const { client } = fakeClient(
      JSON.stringify({
        answers: {
          'q-smoke': { value: 'evet', confidence: 1.4 },
          'q-age': { value: '42', confidence: 0.8 },
        },
        corrected_transcript: 'Düzeltilmiş transkript',
      }),
    )
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    const result = await mapTranscriptToAnswers('ham transkript', QUESTIONS)

    expect(result.corrected_transcript).toBe('Düzeltilmiş transkript')
    const smoke = result.answers.find((a) => a.question_id === 'q-smoke')
    expect(smoke?.answer_value).toBe(true) // 'evet' coerced to boolean
    expect(smoke?.confidence).toBe(1) // clamped from 1.4
    const age = result.answers.find((a) => a.question_id === 'q-age')
    expect(age?.answer_value).toBe(42) // '42' coerced to number
  })

  it('throws AnamnesisMappingError parse_error on non-JSON content', async () => {
    const { client } = fakeClient('not json at all')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    await expect(mapTranscriptToAnswers('t', QUESTIONS)).rejects.toMatchObject({
      name: 'AnamnesisMappingError',
      code: 'parse_error',
    })
  })

  it('throws AnamnesisMappingError upstream_error when the API call fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: { completions: { create } },
    } as never)

    await expect(mapTranscriptToAnswers('t', QUESTIONS)).rejects.toMatchObject({
      name: 'AnamnesisMappingError',
      code: 'upstream_error',
    })
  })

  it('exports AnamnesisMappingError with a code field', () => {
    const err = new AnamnesisMappingError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})
