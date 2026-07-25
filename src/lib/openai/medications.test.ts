import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import { enrichMedication, MedicationEnrichError, MEDICATION_SYSTEM_PROMPT } from './medications'

const CANNED_RESULT = {
  name: 'Coraspin',
  active_ingredient: 'Asetilsalisilik asit',
  summary: 'Antiagregan; kardiyovasküler koruma amacıyla kullanılır.',
  dental_significance: 'Trombosit fonksiyonunu baskıladığı için işlem sonrası kanama süresi uzayabilir.',
  surgical_precautions: 'Basit çekimlerde kesilmesi gerekmez; lokal hemostaz önlemleri alınmalıdır.',
  blocks_treatment: 'dikkat',
  risk_level: 'orta',
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('enrichMedication', () => {
  it('calls GPT-4o once with model gpt-4o and strict json_schema', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await enrichMedication('Coraspin')
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
    expect(args.messages[1].content).toContain('Coraspin')
  })

  it('returns the full enrichment card', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await enrichMedication('Coraspin')
    expect(result.active_ingredient).toBe('Asetilsalisilik asit')
    expect(result.blocks_treatment).toBe('dikkat')
    expect(result.risk_level).toBe('orta')
    expect(result.surgical_precautions.length).toBeGreaterThan(0)
  })

  it('throws MedicationEnrichError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(enrichMedication('X')).rejects.toMatchObject({ name: 'MedicationEnrichError', code: 'parse_error' })
  })

  it('throws MedicationEnrichError parse_error on non-JSON', async () => {
    const { client } = fakeClient('not json')
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(enrichMedication('X')).rejects.toMatchObject({ name: 'MedicationEnrichError', code: 'parse_error' })
  })

  it('throws MedicationEnrichError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limited'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(enrichMedication('X')).rejects.toMatchObject({ name: 'MedicationEnrichError', code: 'upstream_error' })
  })

  it('exports MedicationEnrichError with a code field', () => {
    const err = new MedicationEnrichError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('MEDICATION_SYSTEM_PROMPT', () => {
  it('asks for etken madde', () => {
    expect(MEDICATION_SYSTEM_PROMPT).toContain('active_ingredient')
    expect(MEDICATION_SYSTEM_PROMPT.toLowerCase()).toContain('etken madde')
  })
  it('defines the blocks_treatment scale', () => {
    expect(MEDICATION_SYSTEM_PROMPT).toContain('engel_yok')
    expect(MEDICATION_SYSTEM_PROMPT).toContain('dikkat')
    expect(MEDICATION_SYSTEM_PROMPT).toContain('kontrendike_olabilir')
  })
  it('stays in the dental scope', () => {
    expect(MEDICATION_SYSTEM_PROMPT).toContain('diş hekimliği')
  })
})
