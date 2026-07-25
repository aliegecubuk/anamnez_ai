import { describe, it, expect } from 'vitest'
import { normalizeClinicalSentence, isBareNegativeAnswer, buildMedulaText } from './medula'

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

describe('isBareNegativeAnswer', () => {
  it('detects bare Turkish negative answers', () => {
    for (const answer of [
      'yok',
      'Yok',
      'yok.',
      'yoktur',
      'hayır',
      'Hayır!',
      'mevcut değil',
      'değil',
      'bulunmuyor',
      'bulunmamaktadır',
      'olmadığı',
      'olumsuz',
      'saptanmadı',
      'izlenmedi',
      'görülmedi',
      'kullanmıyor',
      'almıyor',
    ]) {
      expect(isBareNegativeAnswer(answer)).toBe(true)
    }
  })

  it('uses Turkish lowercasing: "YOK" and "İzlenmedi" are negatives', () => {
    expect(isBareNegativeAnswer('YOK')).toBe(true)
    expect(isBareNegativeAnswer('İzlenmedi')).toBe(true)
  })

  it('does not flag context-rich answers that contain a negative', () => {
    expect(isBareNegativeAnswer('ateş yok')).toBe(false)
    expect(isBareNegativeAnswer('bilinen alerjisi yok')).toBe(false)
    expect(isBareNegativeAnswer('yok ama ara ara bulantısı oluyor')).toBe(false)
  })

  it('does not flag positive answers', () => {
    expect(isBareNegativeAnswer('mevcut')).toBe(false)
    expect(isBareNegativeAnswer('bulantı ve terleme mevcut')).toBe(false)
  })
})

describe('buildMedulaText', () => {
  it('joins normalized answers into one flowing clinical text', () => {
    expect(
      buildMedulaText([
        { question: 'Şikâyet', answer: '1 saat önce başlayan karın ağrısı' },
        { question: 'Eşlik eden semptomlar', answer: 'bulantı ve terleme mevcut' },
        { question: 'Kronik hastalıklar', answer: 'bilinen tansiyon hastası' },
      ]),
    ).toBe('1 saat önce başlayan karın ağrısı. Bulantı ve terleme mevcut. Bilinen tansiyon hastası.')
  })

  it('prefixes bare negative answers with their question heading', () => {
    expect(
      buildMedulaText([
        { question: 'Bağırsak sesleri', answer: 'yok' },
        { question: 'Alerjiler', answer: 'yok' },
      ]),
    ).toBe('Bağırsak sesleri: Yok. Alerjiler: Yok.')
  })

  it('handles every bare negative pattern with a heading', () => {
    expect(buildMedulaText([{ question: 'İlaç alerjisi', answer: 'hayır' }])).toBe(
      'İlaç alerjisi: Hayır.',
    )
    expect(buildMedulaText([{ question: 'Ateş', answer: 'yoktur' }])).toBe('Ateş: Yoktur.')
    expect(buildMedulaText([{ question: 'Ödem', answer: 'bulunmuyor' }])).toBe('Ödem: Bulunmuyor.')
    expect(buildMedulaText([{ question: 'Sarılık', answer: 'mevcut değil' }])).toBe(
      'Sarılık: Mevcut değil.',
    )
    expect(buildMedulaText([{ question: 'Melena', answer: 'saptanmadı' }])).toBe(
      'Melena: Saptanmadı.',
    )
  })

  it('strips trailing question marks from headings', () => {
    expect(buildMedulaText([{ question: 'İlaç kullanıyor mu?', answer: 'yok' }])).toBe(
      'İlaç kullanıyor mu: Yok.',
    )
  })

  it('keeps context-rich negative answers flowing without a heading', () => {
    expect(
      buildMedulaText([
        { question: 'Ateş', answer: 'ateş yok' },
        { question: 'Alerjiler', answer: 'bilinen alerjisi yok' },
      ]),
    ).toBe('Ateş yok. Bilinen alerjisi yok.')
  })

  it('falls back to the bare sentence when the question is empty', () => {
    expect(buildMedulaText([{ question: '', answer: 'yok' }])).toBe('Yok.')
  })

  it('mixes headings and flowing text correctly', () => {
    expect(
      buildMedulaText([
        { question: 'Şikâyet', answer: '1 saat önce başlayan karın ağrısı' },
        { question: 'Alerjiler', answer: 'yok' },
        { question: 'Kullandığı ilaçlar', answer: 'coumadin 5 mg kullanıyor' },
      ]),
    ).toBe('1 saat önce başlayan karın ağrısı. Alerjiler: Yok. Coumadin 5 mg kullanıyor.')
  })

  it('skips empty answers', () => {
    expect(
      buildMedulaText([
        { question: 'Ateş', answer: 'ateş yok' },
        { question: 'Bulantı', answer: '' },
        { question: 'Kusma', answer: '   ' },
        { question: 'Öksürük', answer: 'öksürük mevcut' },
      ]),
    ).toBe('Ateş yok. Öksürük mevcut.')
  })

  it('returns empty string when nothing to say', () => {
    expect(buildMedulaText([])).toBe('')
    expect(buildMedulaText([{ question: 'Ateş', answer: '' }, { question: 'Kusma', answer: ' ' }])).toBe('')
  })
})
