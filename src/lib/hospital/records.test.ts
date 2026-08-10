import { describe, it, expect } from 'vitest'

import {
  RETENTION_OPTIONS,
  DEFAULT_RETENTION_DAYS,
  computeExpiresAt,
  daysLeft,
  createRecordSchema,
  retentionDaysSchema,
  settingsBodySchema,
} from './records'

describe('computeExpiresAt', () => {
  const from = new Date('2026-08-10T12:00:00.000Z')

  it('adds the given number of days', () => {
    expect(computeExpiresAt(30, from)).toBe('2026-09-09T12:00:00.000Z')
    expect(computeExpiresAt(365, from)).toBe('2027-08-10T12:00:00.000Z')
  })

  it('returns null for "no auto-delete"', () => {
    expect(computeExpiresAt(null, from)).toBeNull()
  })

  it('handles month boundaries', () => {
    expect(computeExpiresAt(90, from)).toBe('2026-11-08T12:00:00.000Z')
  })
})

describe('daysLeft', () => {
  const now = new Date('2026-08-10T12:00:00.000Z')

  it('returns null for records without expiry', () => {
    expect(daysLeft(null, now)).toBeNull()
  })

  it('rounds up partial days', () => {
    expect(daysLeft('2026-08-11T00:00:00.000Z', now)).toBe(1)
    expect(daysLeft('2026-09-09T12:00:00.000Z', now)).toBe(30)
  })

  it('never goes below zero for already-expired rows', () => {
    expect(daysLeft('2026-08-01T00:00:00.000Z', now)).toBe(0)
  })
})

describe('retentionDaysSchema', () => {
  it('accepts every offered option and null', () => {
    for (const days of RETENTION_OPTIONS) {
      expect(retentionDaysSchema.safeParse(days).success).toBe(true)
    }
    expect(retentionDaysSchema.safeParse(null).success).toBe(true)
  })

  it('rejects values outside the offered options', () => {
    for (const bad of [0, 7, 45, 100, 366, -30, 30.5]) {
      expect(retentionDaysSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('settingsBodySchema', () => {
  it('accepts a valid retention and null', () => {
    expect(settingsBodySchema.safeParse({ retention_days: 90 }).success).toBe(true)
    expect(settingsBodySchema.safeParse({ retention_days: null }).success).toBe(true)
  })

  it('rejects a missing or invalid retention', () => {
    expect(settingsBodySchema.safeParse({}).success).toBe(false)
    expect(settingsBodySchema.safeParse({ retention_days: 45 }).success).toBe(false)
    expect(settingsBodySchema.safeParse({ retention_days: '90' }).success).toBe(false)
  })
})

describe('createRecordSchema', () => {
  const valid = {
    label: '14:30 göğüs ağrısı',
    mode: 'hizli',
    entries: [{ question: 'Şikâyet', answer: 'Göğüs ağrısı' }],
    medula_text: 'Şikâyet: Göğüs ağrısı',
  }

  it('accepts a minimal valid body and defaults exam_entries', () => {
    const parsed = createRecordSchema.parse(valid)
    expect(parsed.exam_entries).toEqual([])
    expect(parsed.ai_summary).toBeUndefined()
  })

  it('trims the label and keeps optional fields', () => {
    const parsed = createRecordSchema.parse({
      ...valid,
      label: '  etiket  ',
      exam_entries: [{ question: 'TA', answer: '120/80' }],
      ai_summary: 'Özet.',
    })
    expect(parsed.label).toBe('etiket')
    expect(parsed.exam_entries).toHaveLength(1)
    expect(parsed.ai_summary).toBe('Özet.')
  })

  it('rejects empty and overlong labels', () => {
    expect(createRecordSchema.safeParse({ ...valid, label: '   ' }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, label: 'x'.repeat(81) }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, label: 'x'.repeat(80) }).success).toBe(true)
  })

  it('rejects an unknown mode', () => {
    expect(createRecordSchema.safeParse({ ...valid, mode: 'turbo' }).success).toBe(false)
  })

  it('rejects entries with extra client-side fields stripped incorrectly', () => {
    // zod strips unknown keys by default — an id field must not survive.
    const parsed = createRecordSchema.parse({
      ...valid,
      entries: [{ id: 'client-id', question: 'Şikâyet', answer: 'Ağrı' }],
    })
    expect(parsed.entries[0]).toEqual({ question: 'Şikâyet', answer: 'Ağrı' })
  })
})

describe('RETENTION_OPTIONS / defaults', () => {
  it('offers the planned options', () => {
    expect(RETENTION_OPTIONS).toEqual([30, 90, 120, 240, 365])
  })

  it('default retention is one of the offered options', () => {
    expect(RETENTION_OPTIONS).toContain(DEFAULT_RETENTION_DAYS)
  })
})
