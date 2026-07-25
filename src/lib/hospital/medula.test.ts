import { describe, it, expect } from 'vitest'
import { normalizeClinicalSentence, buildMedulaText } from './medula'

describe('normalizeClinicalSentence', () => {
  it('capitalizes the first letter and appends a period', () => {
    expect(normalizeClinicalSentence('bulantı ve terleme mevcut')).toBe('Bulantı ve terleme mevcut.')
  })

  it('uses Turkish uppercasing: i → İ, not I', () => {
    expect(normalizeClinicalSentence('ishal üç gündür devam ediyor')).toBe('İshal üç gündür devam ediyor.')
  })

  it('uses Turkish uppercasing: ı → I', () => {
    expect(normalizeClinicalSentence('ısı yüksekliği mevcut')).toBe('Isı yüksekliği mevcut.')
  })

  it('keeps existing terminal punctuation', () => {
    expect(normalizeClinicalSentence('Ağrı var mı?')).toBe('Ağrı var mı?')
    expect(normalizeClinicalSentence('bilinen tansiyon hastası.')).toBe('Bilinen tansiyon hastası.')
    expect(normalizeClinicalSentence('acil!')).toBe('Acil!')
  })

  it('collapses internal whitespace and trims', () => {
    expect(normalizeClinicalSentence('  karın   ağrısı \n mevcut ')).toBe('Karın ağrısı mevcut.')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeClinicalSentence('')).toBe('')
    expect(normalizeClinicalSentence('   ')).toBe('')
  })

  it('does not touch inner casing (drug names, abbreviations)', () => {
    expect(normalizeClinicalSentence('coumadin 5 mg kullanıyor, INR takipli')).toBe(
      'Coumadin 5 mg kullanıyor, INR takipli.',
    )
  })

  it('leaves a leading digit unchanged', () => {
    expect(normalizeClinicalSentence('1 saat önce başlayan karın ağrısı')).toBe(
      '1 saat önce başlayan karın ağrısı.',
    )
  })
})

describe('buildMedulaText', () => {
  it('joins normalized answers into one flowing clinical text', () => {
    expect(
      buildMedulaText([
        '1 saat önce başlayan karın ağrısı',
        'bulantı ve terleme mevcut',
        'bilinen tansiyon hastası',
      ]),
    ).toBe('1 saat önce başlayan karın ağrısı. Bulantı ve terleme mevcut. Bilinen tansiyon hastası.')
  })

  it('skips empty answers', () => {
    expect(buildMedulaText(['ateş yok', '', '   ', 'öksürük mevcut'])).toBe(
      'Ateş yok. Öksürük mevcut.',
    )
  })

  it('returns empty string when nothing to say', () => {
    expect(buildMedulaText([])).toBe('')
    expect(buildMedulaText(['', ' '])).toBe('')
  })
})
