import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/openai/whisper', () => ({
  getOpenAIClient: vi.fn(),
}))

import { getOpenAIClient } from '@/lib/openai/whisper'
import { generateAiReport, buildReportInput, AiReportError, REPORT_SYSTEM_PROMPT } from './report'
import type { AnamnesisEntryDTO, MedicationDTO } from '@/lib/anamnesis/structured-types'

const ENTRIES: AnamnesisEntryDTO[] = [
  {
    id: '1', section_key: 'oz_genel', content: 'Hipertansiyon mevcut',
    confidence: 0.9, source: 'ai', edited_by_human: false, display_order: 0,
  },
  {
    id: '2', section_key: 'soy_sahsi', content: 'Günde 1 paket sigara içiyor',
    confidence: 0.95, source: 'ai', edited_by_human: false, display_order: 0,
  },
]

const MEDICATIONS: MedicationDTO[] = [
  {
    id: 'm1', name: 'Coraspin', active_ingredient: 'Asetilsalisilik asit',
    summary: 'Antiagregan.', dental_significance: 'Kanama süresi uzayabilir.',
    surgical_precautions: 'Lokal hemostaz önlemleri alınmalı.',
    blocks_treatment: 'dikkat', risk_level: 'orta',
  },
]

const CANNED_RESULT = {
  summary: 'Hipertansif, sigara kullanan hasta; antiagregan tedavi altında.',
  dental_considerations: ['Kanama kontrolü planlanmalıdır.'],
  risk_flags: ['İşlem sonrası kanama riski artmıştır.'],
  recommendations: ['Uzun işlemler öncesi tansiyon takibi önerilir.'],
}

function fakeClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
  return { client: { chat: { completions: { create } } }, create }
}

beforeEach(() => { vi.mocked(getOpenAIClient).mockReset() })

describe('buildReportInput', () => {
  it('groups entries under section labels and lists medications', () => {
    const input = buildReportInput(ENTRIES, MEDICATIONS)
    expect(input).toContain('c) Genel sağlık yönünden')
    expect(input).toContain('Hipertansiyon mevcut')
    expect(input).toContain('Kullanılan ilaçlar')
    expect(input).toContain('Coraspin')
    expect(input).toContain('etken madde: Asetilsalisilik asit')
  })

  it('omits empty sections', () => {
    const input = buildReportInput(ENTRIES, [])
    expect(input).not.toContain('İntraoral')
    expect(input).not.toContain('Kullanılan ilaçlar')
  })

  it('falls back to a placeholder when nothing is present', () => {
    expect(buildReportInput([], [])).toBe('Anamnez bilgisi girilmemiş.')
  })
})

describe('generateAiReport', () => {
  it('calls GPT-4o once with strict json_schema', async () => {
    const { client, create } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await generateAiReport(ENTRIES, MEDICATIONS)
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('returns the report fields', async () => {
    const { client } = fakeClient(JSON.stringify(CANNED_RESULT))
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    const result = await generateAiReport(ENTRIES, MEDICATIONS)
    expect(result.summary).toContain('Hipertansif')
    expect(result.risk_flags).toHaveLength(1)
  })

  it('throws AiReportError parse_error on empty content', async () => {
    const { client } = fakeClient(null)
    vi.mocked(getOpenAIClient).mockReturnValue(client as never)
    await expect(generateAiReport(ENTRIES, [])).rejects.toMatchObject({ name: 'AiReportError', code: 'parse_error' })
  })

  it('throws AiReportError upstream_error when API fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('boom'))
    vi.mocked(getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never)
    await expect(generateAiReport(ENTRIES, [])).rejects.toMatchObject({ name: 'AiReportError', code: 'upstream_error' })
  })

  it('exports AiReportError with a code field', () => {
    const err = new AiReportError('boom', 'parse_error')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('parse_error')
  })
})

describe('REPORT_SYSTEM_PROMPT', () => {
  it('forbids diagnosis and fabrication', () => {
    expect(REPORT_SYSTEM_PROMPT).toContain('tanı koyma')
    expect(REPORT_SYSTEM_PROMPT).toContain('uydurma')
  })
  it('keeps the dental scope', () => {
    expect(REPORT_SYSTEM_PROMPT).toContain('diş hekimliği')
  })
})
