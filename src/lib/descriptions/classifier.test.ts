import { describe, it, expect } from 'vitest'
import { normalizeTerm, classifyAnswer, extractTerms } from './classifier'

describe('normalizeTerm', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTerm('  Parol 500mg ')).toBe('parol 500mg')
  })
  it('collapses inner whitespace', () => {
    expect(normalizeTerm('parol  500mg')).toBe('parol 500mg')
  })
  it('lowercases with tr-TR (dotted İ → i)', () => {
    expect(normalizeTerm('İBUPROFEN')).toBe('ibuprofen')
  })
  it('lowercases normal ASCII with tr-TR (I → ı)', () => {
    // tr-TR: 'I' (dotless capital) → 'ı' (dotless lowercase)
    expect(normalizeTerm('ASPIRIN')).toBe('aspırın')
  })
})

describe('classifyAnswer', () => {
  const make = (prompt: string, question_type = 'text', answer_value: unknown = 'değer') => ({
    prompt,
    question_type: question_type as 'text' | 'yes_no' | 'multi_select' | 'numeric',
    answer_value: answer_value as import('@/lib/anamnesis/types').AnswerValue,
  })

  it('detects medication from "ilaç"', () => {
    expect(classifyAnswer(make('Kullandığı ilaçlar nelerdir?'))).toBe('medication')
  })
  it('detects medication from "kullandığı ilaçlar"', () => {
    expect(classifyAnswer(make('Düzenli kullandığı ilaçlar'))).toBe('medication')
  })
  it('detects disease from "hastalık"', () => {
    expect(classifyAnswer(make('Sistemik hastalık var mı?'))).toBe('disease')
  })
  it('detects disease from "sistemik"', () => {
    expect(classifyAnswer(make('Sistemik rahatsızlığınız var mı?'))).toBe('disease')
  })
  it('detects disease from "rahatsızlık"', () => {
    expect(classifyAnswer(make('Kronik bir rahatsızlığı var mı?'))).toBe('disease')
  })
  it('detects allergy from "alerji"', () => {
    expect(classifyAnswer(make('İlaç alerjisi var mı?'))).toBe('allergy')
  })
  it('detects allergy from "alerjisi"', () => {
    expect(classifyAnswer(make('Besin alerjisi'))).toBe('allergy')
  })
  it('returns null for unrelated prompt', () => {
    expect(classifyAnswer(make('Sigara kullanıyor musunuz?'))).toBeNull()
  })
  it('returns null when answer_value is null', () => {
    expect(classifyAnswer(make('Kullandığı ilaçlar', 'text', null))).toBeNull()
  })
  it('returns null when answer_value is empty string', () => {
    expect(classifyAnswer(make('Kullandığı ilaçlar', 'text', ''))).toBeNull()
  })
  it('returns null when answer_value is empty array', () => {
    expect(classifyAnswer(make('İlaç alerjisi', 'multi_select', []))).toBeNull()
  })
  it('returns null when yes_no answer is false', () => {
    expect(classifyAnswer(make('İlaç alerjisi var mı?', 'yes_no', false))).toBeNull()
  })
})

describe('extractTerms', () => {
  it('splits comma-separated string', () => {
    expect(extractTerms('Parol, aspirin')).toEqual(['Parol', 'aspirin'])
  })
  it('splits on "ve" keyword', () => {
    expect(extractTerms('Parol ve aspirin ve metformin')).toEqual(['Parol', 'aspirin', 'metformin'])
  })
  it('splits on semicolon', () => {
    expect(extractTerms('Parol;aspirin')).toEqual(['Parol', 'aspirin'])
  })
  it('splits on newline', () => {
    expect(extractTerms('Parol\naspirin')).toEqual(['Parol', 'aspirin'])
  })
  it('handles mixed separators', () => {
    const result = extractTerms('Parol, aspirin ve metformin')
    expect(result).toEqual(['Parol', 'aspirin', 'metformin'])
  })
  it('passthrough for string array (multi_select)', () => {
    expect(extractTerms(['Penisilin', 'Polen'])).toEqual(['Penisilin', 'Polen'])
  })
  it('trims array items and drops empties', () => {
    expect(extractTerms([' Penisilin ', '', 'Polen'])).toEqual(['Penisilin', 'Polen'])
  })
  it('returns [] for number', () => {
    expect(extractTerms(42)).toEqual([])
  })
  it('returns [] for boolean', () => {
    expect(extractTerms(true)).toEqual([])
  })
  it('returns [] for null', () => {
    expect(extractTerms(null)).toEqual([])
  })
})
