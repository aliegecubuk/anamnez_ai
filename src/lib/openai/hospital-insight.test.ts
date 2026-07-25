import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import {
  buildInsightInput,
  generateHospitalInsight,
  HospitalInsightError,
  INSIGHT_SCHEMA,
  INSIGHT_SYSTEM_PROMPT,
} from './hospital-insight'

const ENTRIES = [
  { question: 'Şikâyet', answer: 'Göğüs ağrısı' },
  { question: 'Alerjiler', answer: 'Bilinen alerjisi yok' },
]
const EXAM_ENTRIES = [
  { question: 'TA', answer: '120/80 mmHg' },
  { question: 'Nabız', answer: '88/dk' },
]

const CANNED_RESULT = {
  summary: 'Göğüs ağrısı ile başvuran hastanın vital bulguları stabildir.',
  differentials: ['Akut koroner sendrom değerlendirilebilir', 'Kas-iskelet ağrısı akla gelmelidir'],
  red_flags: ['Kardiyak enzim ve EKG değerlendirmesi eksik'],
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('generateHospitalInsight', () => {
  it('calls GPT-4o once with strict json_schema and temperature 0', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await generateHospitalInsight(ENTRIES, EXAM_ENTRIES, 'hizli')
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.temperature).toBe(0)
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('returns summary, differentials and red_flags', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await generateHospitalInsight(ENTRIES, EXAM_ENTRIES, 'detayli')
    expect(result.summary).toContain('Göğüs ağrısı')
    expect(result.differentials).toHaveLength(2)
    expect(result.red_flags).toHaveLength(1)
  })

  it('tolerates missing arrays in the parsed payload', async () => {
    const { client } = fakeClient(JSON.stringify({ summary: 'Özet.' }))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await generateHospitalInsight(ENTRIES, [], 'hizli')
    expect(result.summary).toBe('Özet.')
    expect(result.differentials).toEqual([])
    expect(result.red_flags).toEqual([])
  })

  it('throws HospitalInsightError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(generateHospitalInsight(ENTRIES, [], 'hizli')).rejects.toMatchObject({
      name: 'HospitalInsightError',
      code: 'parse_error',
    })
  })

  it('throws HospitalInsightError parse_error on non-JSON', async () => {
    const { client } = fakeClient('not json')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(generateHospitalInsight(ENTRIES, [], 'detayli')).rejects.toMatchObject({
      name: 'HospitalInsightError',
      code: 'parse_error',
    })
  })

  it('throws HospitalInsightError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(generateHospitalInsight(ENTRIES, [], 'hizli')).rejects.toMatchObject({
      name: 'HospitalInsightError',
      code: 'upstream_error',
    })
  })

  it('exports HospitalInsightError with a code field', () => {
    const err = new HospitalInsightError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('buildInsightInput', () => {
  it('lists anamnez and exam entries as question/answer lines with the mode label', () => {
    const input = buildInsightInput(ENTRIES, EXAM_ENTRIES, 'hizli')
    expect(input).toContain('Mod: Hızlı (Acil)')
    expect(input).toContain('## Anamnez')
    expect(input).toContain('- Şikâyet: Göğüs ağrısı')
    expect(input).toContain('## Fizik Muayene')
    expect(input).toContain('- TA: 120/80 mmHg')
  })

  it('omits the exam section when there are no exam entries', () => {
    const input = buildInsightInput(ENTRIES, [], 'detayli')
    expect(input).toContain('Mod: Detaylı (Poliklinik)')
    expect(input).not.toContain('Fizik Muayene')
  })

  it('never carries identity — only question/answer strings are accepted', () => {
    // The input type has no identity field; this guards the masking guarantee.
    const input = buildInsightInput(ENTRIES, EXAM_ENTRIES, 'hizli')
    expect(input).not.toContain('TC')
    expect(input).not.toContain('Telefon')
  })
})

describe('INSIGHT prompt & schema', () => {
  it('schema requires summary, differentials and red_flags', () => {
    expect(INSIGHT_SCHEMA.strict).toBe(true)
    expect(INSIGHT_SCHEMA.schema.required).toEqual(['summary', 'differentials', 'red_flags'])
    expect(INSIGHT_SCHEMA.schema.additionalProperties).toBe(false)
  })

  it('system prompt demands cautious language and no fabrication', () => {
    expect(INSIGHT_SYSTEM_PROMPT).toContain('uydurma')
    expect(INSIGHT_SYSTEM_PROMPT).toContain('temkinli')
    expect(INSIGHT_SYSTEM_PROMPT).toContain('çüncü şahıs')
  })
})
