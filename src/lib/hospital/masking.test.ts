import { describe, it, expect } from 'vitest'
import { maskIdentity, MASK } from './masking'

const IDENTITY = {
  firstName: 'Işıl',
  lastName: 'Çubukçu',
  tcNo: '12345678901',
  phone: '0532 123 45 67',
}

describe('maskIdentity', () => {
  it('masks first and last name regardless of Turkish casing', () => {
    const out = maskIdentity('hasta ışıl çubukçu bugün geldi', IDENTITY)
    expect(out).toBe(`hasta ${MASK} ${MASK} bugün geldi`)
  })

  it('masks uppercase Turkish variants (İ/I dotted-dotless)', () => {
    const out = maskIdentity('IŞIL ÇUBUKÇU başvurdu', IDENTITY)
    expect(out).toBe(`${MASK} ${MASK} başvurdu`)
  })

  it('masks the name when followed by an apostrophe suffix', () => {
    const out = maskIdentity("Işıl'ın karnı ağrıyor", IDENTITY)
    expect(out).toBe(`${MASK}'ın karnı ağrıyor`)
  })

  it('does not mask words that merely contain the name', () => {
    const out = maskIdentity('hastanın ışıldayan bir yarası var', IDENTITY)
    expect(out).toBe('hastanın ışıldayan bir yarası var')
  })

  it('masks the entered TC number and any standalone 11-digit number', () => {
    expect(maskIdentity('TC 12345678901 kayıtlı', IDENTITY)).toBe(`TC ${MASK} kayıtlı`)
    expect(maskIdentity('kimlik no 98765432109', IDENTITY)).toBe(`kimlik no ${MASK}`)
  })

  it('does not mask numbers inside longer digit runs', () => {
    const out = maskIdentity('protokol 123456789012345', IDENTITY)
    expect(out).toBe('protokol 123456789012345')
  })

  it('masks phone numbers in common formats', () => {
    expect(maskIdentity('tel 0532 123 45 67 aradı', IDENTITY)).toBe(`tel ${MASK} aradı`)
    expect(maskIdentity('tel 05321234567 aradı', IDENTITY)).toBe(`tel ${MASK} aradı`)
    expect(maskIdentity('tel 5321234567 aradı', IDENTITY)).toBe(`tel ${MASK} aradı`)
  })

  it('ignores empty identity fields without over-masking', () => {
    const out = maskIdentity('hasta bugün geldi, ateşi 38', {
      firstName: '',
      lastName: '',
      tcNo: '',
      phone: '',
    })
    expect(out).toBe('hasta bugün geldi, ateşi 38')
  })

  it('skips single-character name fragments (no noise masking)', () => {
    const out = maskIdentity('a vitamini eksikliği', {
      firstName: 'A',
      lastName: '',
      tcNo: '',
      phone: '',
    })
    expect(out).toBe('a vitamini eksikliği')
  })

  it('masks multi-word first names token by token', () => {
    const out = maskIdentity('ali osman geldi', {
      firstName: 'Ali Osman',
      lastName: '',
      tcNo: '',
      phone: '',
    })
    expect(out).toBe(`${MASK} ${MASK} geldi`)
  })
})
