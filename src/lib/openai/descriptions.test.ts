import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub the lazy OpenAI singleton — no live API calls in tests.
vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import {
  generateDentalDescription,
  DentalDescriptionError,
  DESCRIPTION_SYSTEM_PROMPT,
} from './descriptions'

const CANNED_RESPONSE = {
  dental_impact: 'Parol (parasetamol) genel anestezi eşiğini etkilemez.',
  risk_level: 'Düşük — standart dozda kullanım diş hekimliği açısından risk oluşturmaz.',
  precaution: 'Rutin ilaç soruşturması yapılması önerilir.',
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => {
  vi.mocked(getOpenAIClient).mockReset()
})

describe('generateDentalDescription', () => {
  it('calls chat.completions.create once with model gpt-4o and strict json_schema', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESPONSE))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    await generateDentalDescription('Parol', 'medication')

    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
    expect(args.response_format.json_schema.name).toBe('dental_description')
  })

  it('user message contains the term with its category label', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESPONSE))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    await generateDentalDescription('Parol', 'medication')

    const args = create.mock.calls[0][0]
    const userMsg = args.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMsg.content).toContain('Parol')
  })

  it('returns dental_impact, risk_level, precaution and active_ingredient:null', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESPONSE))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    const result = await generateDentalDescription('Parol', 'medication')

    expect(result.dental_impact).toBe(CANNED_RESPONSE.dental_impact)
    expect(result.risk_level).toBe(CANNED_RESPONSE.risk_level)
    expect(result.precaution).toBe(CANNED_RESPONSE.precaution)
    expect(result.active_ingredient).toBeNull()
  })

  it('returned object has NO disclaimer field', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESPONSE))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    const result = await generateDentalDescription('Parol', 'medication')

    expect('disclaimer' in result).toBe(false)
  })

  it('throws DentalDescriptionError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    await expect(generateDentalDescription('Parol', 'medication')).rejects.toMatchObject({
      name: 'DentalDescriptionError',
      code: 'parse_error',
    })
  })

  it('throws DentalDescriptionError parse_error on non-JSON content', async () => {
    const { client } = fakeClient('not valid json')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)

    await expect(generateDentalDescription('Parol', 'medication')).rejects.toMatchObject({
      name: 'DentalDescriptionError',
      code: 'parse_error',
    })
  })

  it('throws DentalDescriptionError upstream_error when API call fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: { completions: { create } },
    } as never)

    await expect(generateDentalDescription('Parol', 'medication')).rejects.toMatchObject({
      name: 'DentalDescriptionError',
      code: 'upstream_error',
    })
  })

  it('exports DentalDescriptionError with a code field', () => {
    const err = new DentalDescriptionError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('DESCRIPTION_SYSTEM_PROMPT', () => {
  it('contains dental-only scope guard (Turkish)', () => {
    expect(DESCRIPTION_SYSTEM_PROMPT).toContain('diş hekimliği')
  })
  it('contains active ingredient instruction', () => {
    expect(DESCRIPTION_SYSTEM_PROMPT).toContain('etken madde')
  })
})
