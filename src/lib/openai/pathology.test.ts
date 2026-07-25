import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import { parsePathologyTranscript, PathologyParseError, PATHOLOGY_SYSTEM_PROMPT } from './pathology'

const CANNED_RESULT = {
  confirmed: [
    { tooth_number: 22, condition_type: 'çürük', confidence: 0.95, ambiguous: false, candidates: [], raw_mention: 'diş 22 çürük' },
    { tooth_number: 25, condition_type: 'diş_eti_çekilmesi', confidence: 0.9, ambiguous: false, candidates: [], raw_mention: 'diş 25 diş eti çekilmesi' },
  ],
  ambiguous: [],
}

it('exports PathologyParseError with a code field', () => {
  const err = new PathologyParseError('boom', 'parse_error')
  expect(err).toBeInstanceOf(Error)
  expect(err.code).toBe('parse_error')
})

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('parsePathologyTranscript', () => {
  it('calls GPT-4o once with model gpt-4o and json_schema', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parsePathologyTranscript('diş 22 çürük, diş 25 diş eti çekilmesi')
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
  })

  it('returns confirmed conditions', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parsePathologyTranscript('diş 22 çürük')
    expect(result.confirmed).toHaveLength(2)
    expect(result.confirmed[0].tooth_number).toBe(22)
    expect(result.confirmed[0].condition_type).toBe('çürük')
  })

  it('throws PathologyParseError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parsePathologyTranscript('t')).rejects.toMatchObject({ name: 'PathologyParseError', code: 'parse_error' })
  })

  it('throws PathologyParseError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(parsePathologyTranscript('t')).rejects.toMatchObject({ name: 'PathologyParseError', code: 'upstream_error' })
  })
})

describe('PATHOLOGY_SYSTEM_PROMPT', () => {
  it('lists all condition types', () => {
    expect(PATHOLOGY_SYSTEM_PROMPT).toContain('çürük')
    expect(PATHOLOGY_SYSTEM_PROMPT).toContain('köprü')
  })
  it('mentions FDI numbering', () => {
    expect(PATHOLOGY_SYSTEM_PROMPT).toContain('FDI')
  })
})
