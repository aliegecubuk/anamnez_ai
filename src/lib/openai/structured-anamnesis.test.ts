import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import {
  parseStructuredAnamnesis,
  StructuredParseError,
  STRUCTURED_SYSTEM_PROMPT,
} from './structured-anamnesis'

const CANNED_RESULT = {
  sections: {
    gen_sikayet:    [{ content: 'Sol alt çenede iki haftadır zonklayıcı ağrı', confidence: 0.9 }],
    gen_vital:      [{ content: 'Tansiyon 130/85, nabız 78', confidence: 0.9 }],
    oz_cocukluk:    [{ content: 'Çocuklukta kızamık geçirmiş', confidence: 0.9 }],
    oz_dis:         [],
    oz_genel:       [{ content: 'Hipertansiyon için ilaç kullanıyor', confidence: 0.85 }],
    soy_sahsi:      [{ content: 'Günde 1 paket sigara içiyor', confidence: 0.95 }],
    soy_ekstraoral: [],
    soy_intraoral:  [],
    mua_hijyen:     [{ content: 'Günde bir kez fırçalıyor, diş ipi kullanmıyor', confidence: 0.9 }],
    mua_radyoloji:  [],
  },
  medications: ['Coraspin'],
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('parseStructuredAnamnesis', () => {
  it('calls GPT-4o once with model gpt-4o and strict json_schema', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseStructuredAnamnesis('hasta kızamık geçirmiş, sigara içiyor')
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('returns all 10 sections and the medications list', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseStructuredAnamnesis('t')
    expect(result.sections.gen_sikayet[0].content).toContain('ağrı')
    expect(result.sections.oz_cocukluk).toHaveLength(1)
    expect(result.sections.soy_sahsi[0].content).toContain('sigara')
    expect(result.sections.soy_intraoral).toHaveLength(0)
    expect(result.sections.mua_hijyen[0].content).toContain('fırçalıyor')
    expect(result.medications).toEqual(['Coraspin'])
  })

  it('throws StructuredParseError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parseStructuredAnamnesis('t')).rejects.toMatchObject({ name: 'StructuredParseError', code: 'parse_error' })
  })

  it('throws StructuredParseError parse_error on non-JSON', async () => {
    const { client } = fakeClient('not json')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parseStructuredAnamnesis('t')).rejects.toMatchObject({ name: 'StructuredParseError', code: 'parse_error' })
  })

  it('throws StructuredParseError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(parseStructuredAnamnesis('t')).rejects.toMatchObject({ name: 'StructuredParseError', code: 'upstream_error' })
  })

  it('exports StructuredParseError with a code field', () => {
    const err = new StructuredParseError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('STRUCTURED_SYSTEM_PROMPT', () => {
  it('names all 10 section keys', () => {
    for (const key of [
      'gen_sikayet', 'gen_vital',
      'oz_cocukluk', 'oz_dis', 'oz_genel',
      'soy_sahsi', 'soy_ekstraoral', 'soy_intraoral',
      'mua_hijyen', 'mua_radyoloji',
    ]) {
      expect(STRUCTURED_SYSTEM_PROMPT).toContain(key)
    }
  })
  it('instructs medication extraction', () => {
    expect(STRUCTURED_SYSTEM_PROMPT).toContain('medications')
  })
  it('forbids fabrication', () => {
    expect(STRUCTURED_SYSTEM_PROMPT).toContain('uydurma')
  })
})
