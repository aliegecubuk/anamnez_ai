import { describe, it, expect } from 'vitest'

import { CRITICAL_TOPICS, foldForMatch, missingCriticalTopics } from './checklist'

function qs(...questions: string[]) {
  return questions.map((question) => ({ question }))
}

describe('missingCriticalTopics — hizli', () => {
  it('flags every hizli topic when there are no entries', () => {
    const missing = missingCriticalTopics([], 'hizli')
    expect(missing.map((t) => t.key)).toEqual([
      'sikayet',
      'sure',
      'eslik',
      'kronik',
      'ilac',
      'alerji',
      'gebelik',
      'antikoagulan',
    ])
  })

  it('returns nothing when all hizli topics are covered', () => {
    const entries = qs(
      'Şikâyet',
      'Şikâyet süresi',
      'Eşlik eden semptomlar',
      'Kronik hastalıklar',
      'Kullandığı ilaçlar',
      'Alerjiler',
      'Gebelik',
      'Antikoagülan kullanımı',
    )
    expect(missingCriticalTopics(entries, 'hizli')).toEqual([])
  })

  it('flags only the topics that were actually not asked', () => {
    const entries = qs('Şikâyet', 'Alerjiler')
    const missing = missingCriticalTopics(entries, 'hizli')
    expect(missing.map((t) => t.key)).toEqual([
      'sure',
      'eslik',
      'kronik',
      'ilac',
      'gebelik',
      'antikoagulan',
    ])
  })

  it('does not require detayli-only topics in hizli mode', () => {
    const entries = qs(
      'Şikâyet',
      'Şikâyet süresi',
      'Eşlik eden semptomlar',
      'Kronik hastalıklar',
      'Kullandığı ilaçlar',
      'Alerjiler',
      'Gebelik',
      'Antikoagülan kullanımı',
    )
    // Soygeçmiş/sigara/alkol/ameliyat absent — still nothing missing in hizli.
    expect(missingCriticalTopics(entries, 'hizli')).toEqual([])
  })
})

describe('missingCriticalTopics — detayli', () => {
  it('adds ameliyat, soygeçmiş, sigara and alkol on top of the hizli list', () => {
    const missing = missingCriticalTopics([], 'detayli')
    expect(missing.map((t) => t.key)).toEqual([
      'sikayet',
      'sure',
      'eslik',
      'kronik',
      'ilac',
      'alerji',
      'gebelik',
      'antikoagulan',
      'ameliyat',
      'soygecmis',
      'sigara',
      'alkol',
    ])
  })

  it('treats a combined "Alışkanlıklar" entry as covering both sigara and alkol', () => {
    const missing = missingCriticalTopics(qs('Alışkanlıklar'), 'detayli')
    expect(missing.map((t) => t.key)).not.toContain('sigara')
    expect(missing.map((t) => t.key)).not.toContain('alkol')
  })

  it('matches "Aile öyküsü" as soygeçmiş', () => {
    const missing = missingCriticalTopics(qs('Aile öyküsü'), 'detayli')
    expect(missing.map((t) => t.key)).not.toContain('soygecmis')
  })
})

describe('folding / Turkish casing', () => {
  it('matches regardless of casing, dotted letters and punctuation', () => {
    const missing = missingCriticalTopics(qs('İLAÇLAR', 'GEBELİK?', 'Şikayet Süresi'), 'hizli')
    const keys = missing.map((t) => t.key)
    expect(keys).not.toContain('ilac')
    expect(keys).not.toContain('gebelik')
    expect(keys).not.toContain('sure')
    // "Şikayet Süresi" covers both şikâyet and süre.
    expect(keys).not.toContain('sikayet')
  })

  it('foldForMatch strips non-letters and folds ı/â variants', () => {
    expect(foldForMatch('Şikâyet Süresi')).toBe('şikayetsüresi')
    expect(foldForMatch('TA (tansiyon): 120/80')).toBe('tatansiyon12080')
  })

  it('ignores entries with empty question strings', () => {
    const missing = missingCriticalTopics(qs(''), 'hizli')
    expect(missing).toHaveLength(CRITICAL_TOPICS.hizli.length)
  })
})
