import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import { parsePerioTranscript, PerioParseError, PERIO_SYSTEM_PROMPT } from './perio'

const CANNED_RESULT = {
  confirmed: [
    {
      tooth_number: 18,
      confidence: 0.95,
      ambiguous: false,
      raw_mention: 'diş 18',
      measurements: { MB: { pocket_depth: 3 }, B: { pocket_depth: 2 }, DB: { pocket_depth: 3 } },
    },
  ],
  ambiguous: [],
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('parsePerioTranscript', () => {
  it('calls GPT-4o once with model gpt-4o and json_schema response_format', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parsePerioTranscript('diş 18, üç iki üç')
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('returns confirmed and ambiguous arrays', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parsePerioTranscript('diş 18, üç iki üç')
    expect(result.confirmed).toHaveLength(1)
    expect(result.confirmed[0].tooth_number).toBe(18)
    expect(result.ambiguous).toHaveLength(0)
  })

  it('throws PerioParseError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parsePerioTranscript('t')).rejects.toMatchObject({ name: 'PerioParseError', code: 'parse_error' })
  })

  it('throws PerioParseError parse_error on non-JSON', async () => {
    const { client } = fakeClient('not json')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parsePerioTranscript('t')).rejects.toMatchObject({ name: 'PerioParseError', code: 'parse_error' })
  })

  it('throws PerioParseError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(parsePerioTranscript('t')).rejects.toMatchObject({ name: 'PerioParseError', code: 'upstream_error' })
  })

  it('exports PerioParseError with a code field', () => {
    const err = new PerioParseError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('PERIO_SYSTEM_PROMPT', () => {
  it('contains FDI tooth reference', () => {
    expect(PERIO_SYSTEM_PROMPT).toContain('FDI')
  })
  it('mentions disambiguation (PERIO-03)', () => {
    expect(PERIO_SYSTEM_PROMPT).toContain('ambiguous')
  })
})
