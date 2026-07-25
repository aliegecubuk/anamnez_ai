import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import {
  parseHospitalAnamnesis,
  HospitalParseError,
  HOSPITAL_SCHEMA,
} from './hospital-anamnesis'

const CANNED_RESULT = {
  entries: [
    { question: 'Şikâyet', answer: 'Karın ağrısı' },
    { question: 'Şikâyet süresi', answer: '1 saat önce başladı' },
    { question: 'Alerjiler', answer: 'Bilinen alerjisi yok' },
  ],
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('parseHospitalAnamnesis', () => {
  it('calls GPT-4o once with strict json_schema', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis('hasta karın ağrısı ile geldi', 'hizli')
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('sends the transcript as the user message', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis('TRANSKRIPT_METNI', 'detayli')
    const messages = create.mock.calls[0][0].messages
    expect(messages[1]).toEqual({ role: 'user', content: 'TRANSKRIPT_METNI' })
  })

  it('returns the parsed question/answer entries', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseHospitalAnamnesis('t', 'hizli')
    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].question).toBe('Şikâyet')
    expect(result.entries[2].answer).toContain('alerjisi yok')
  })

  it('uses the acil (hizli) mode instructions in the system prompt', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis('t', 'hizli')
    const system = create.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('ACİL')
    expect(system).toContain('antikoagülan')
  })

  it('uses the poliklinik (detayli) mode instructions in the system prompt', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis('t', 'detayli')
    const system = create.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('POLİKLİNİK')
    expect(system).toContain('soygeçmiş')
  })

  it('forbids fabrication and identity leakage in every mode', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis('t', 'hizli')
    await parseHospitalAnamnesis('t', 'detayli')
    for (const call of create.mock.calls) {
      const system = call[0].messages[0].content as string
      expect(system).toContain('uydurma')
      expect(system).toContain('ASLA')
    }
  })

  it('throws HospitalParseError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parseHospitalAnamnesis('t', 'hizli')).rejects.toMatchObject({ name: 'HospitalParseError', code: 'parse_error' })
  })

  it('throws HospitalParseError parse_error on non-JSON', async () => {
    const { client } = fakeClient('not json')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(parseHospitalAnamnesis('t', 'detayli')).rejects.toMatchObject({ name: 'HospitalParseError', code: 'parse_error' })
  })

  it('throws HospitalParseError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(parseHospitalAnamnesis('t', 'hizli')).rejects.toMatchObject({ name: 'HospitalParseError', code: 'upstream_error' })
  })

  it('exports HospitalParseError with a code field', () => {
    const err = new HospitalParseError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('HOSPITAL_SCHEMA', () => {
  it('requires entries with question/answer pairs only', () => {
    expect(HOSPITAL_SCHEMA.strict).toBe(true)
    const item = HOSPITAL_SCHEMA.schema.properties.entries.items
    expect(item.required).toEqual(['question', 'answer'])
    expect(item.additionalProperties).toBe(false)
  })
})
