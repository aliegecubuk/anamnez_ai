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

// Transcript fixture: every valid source_quote below must appear in it verbatim
// (casing/punctuation may differ — grounding normalizes both sides).
const TRANSCRIPT =
  'Hasta dün geceden beri karın ağrısı olduğunu söyledi. Bilinen alerjisi yok. Parol kullanıyor.'

const CANNED_RESULT = {
  entries: [
    { question: 'Şikâyet', answer: 'Karın ağrısı', source_quote: 'karın ağrısı olduğunu' },
    // Uppercase on purpose: İ→i / I→ı folding must still match the transcript.
    { question: 'Şikâyet süresi', answer: 'Dün geceden beri', source_quote: 'DÜN GECEDEN BERİ' },
    { question: 'Alerjiler', answer: 'Bilinen alerjisi yok', source_quote: 'Bilinen alerjisi yok.' },
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
    const result = await parseHospitalAnamnesis(TRANSCRIPT, 'hizli')
    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].question).toBe('Şikâyet')
    expect(result.entries[2].answer).toContain('alerjisi yok')
    expect(result.dropped).toEqual([])
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

  it('sends temperature 0 for deterministic extraction', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis(TRANSCRIPT, 'hizli')
    expect(create.mock.calls[0][0].temperature).toBe(0)
  })

  it('drops entries whose source_quote is absent from the transcript and reports them in dropped', async () => {
    const withHallucination = {
      entries: [
        { question: 'Şikâyet', answer: 'Karın ağrısı', source_quote: 'karın ağrısı olduğunu' },
        { question: 'Kronik hastalıklar', answer: 'Diyabet hastası', source_quote: 'şeker hastalığı var' },
      ],
    }
    const { client } = fakeClient(JSON.stringify(withHallucination))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseHospitalAnamnesis(TRANSCRIPT, 'detayli')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].question).toBe('Şikâyet')
    expect(result.dropped).toHaveLength(1)
    expect(result.dropped?.[0]).toMatchObject({
      question: 'Kronik hastalıklar',
      answer: 'Diyabet hastası',
      source_quote: 'şeker hastalığı var',
    })
  })

  it('keeps entries whose source_quote matches despite casing and punctuation differences', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseHospitalAnamnesis(TRANSCRIPT, 'hizli')
    expect(result.entries.map((e) => e.question)).toEqual([
      'Şikâyet',
      'Şikâyet süresi',
      'Alerjiler',
    ])
    expect(result.dropped).toEqual([])
  })

  it('returns empty entries with everything in dropped when nothing grounds — no throw', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseHospitalAnamnesis('hasta sadece selam verdi', 'hizli')
    expect(result.entries).toEqual([])
    expect(result.dropped).toHaveLength(3)
  })

  it('grounds exam_entries independently and keeps them separate from anamnez entries', async () => {
    const withExam = {
      entries: [
        { question: 'Şikâyet', answer: 'Karın ağrısı', source_quote: 'karın ağrısı olduğunu' },
      ],
      exam_entries: [
        { question: 'Ateş', answer: '38.5 °C', source_quote: 'Parol kullanıyor' },
        // Hallucinated finding: quote absent from the transcript → dropped.
        { question: 'TA', answer: '180/110 mmHg', source_quote: 'tansiyonu çok yüksek çıktı' },
      ],
    }
    const { client } = fakeClient(JSON.stringify(withExam))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseHospitalAnamnesis(TRANSCRIPT, 'hizli')
    expect(result.entries).toHaveLength(1)
    expect(result.exam_entries).toHaveLength(1)
    expect(result.exam_entries[0]).toMatchObject({ question: 'Ateş', answer: '38.5 °C' })
    // Both lists share one dropped list (anamnez + exam drops together).
    expect(result.dropped).toHaveLength(1)
    expect(result.dropped?.[0].question).toBe('TA')
  })

  it('defaults exam_entries to an empty list when the payload lacks the array', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await parseHospitalAnamnesis(TRANSCRIPT, 'hizli')
    expect(result.exam_entries).toEqual([])
  })
})

describe('HOSPITAL_SCHEMA', () => {
  it('requires entries with question/answer/source_quote only', () => {
    expect(HOSPITAL_SCHEMA.strict).toBe(true)
    const item = HOSPITAL_SCHEMA.schema.properties.entries.items
    expect(item.required).toEqual(['question', 'answer', 'source_quote'])
    expect(item.properties).toHaveProperty('source_quote')
    expect(item.additionalProperties).toBe(false)
  })

  it('requires exam_entries with the same item shape', () => {
    expect(HOSPITAL_SCHEMA.schema.required).toEqual(['entries', 'exam_entries'])
    const item = HOSPITAL_SCHEMA.schema.properties.exam_entries.items
    expect(item.required).toEqual(['question', 'answer', 'source_quote'])
    expect(item.additionalProperties).toBe(false)
  })

  it('prompt routes vitals and exam findings to exam_entries', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await parseHospitalAnamnesis('t', 'hizli')
    const system = create.mock.calls[0][0].messages[0].content as string
    expect(system).toContain('exam_entries')
    expect(system).toContain('SpO2')
    expect(system).toContain('fizik muayene')
  })
})
