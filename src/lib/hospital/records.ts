// Hospital record persistence — shared between API routes and the history UI.
// Identity and raw transcript are never part of this layer: a record is the
// edited structured output (Q&A + exam entries, Medula text, AI summary)
// stored under a clinician-chosen label with a time-boxed expiry.

import { z } from 'zod'
import type { HospitalMode } from './types'

// Selectable auto-delete periods (days). Absence of a value (null) means
// "no auto-delete" — the record is kept until the clinician deletes it.
export const RETENTION_OPTIONS = [30, 90, 120, 240, 365] as const
export type RetentionDays = (typeof RETENTION_OPTIONS)[number]

// Applied when the user has never saved a retention preference.
export const DEFAULT_RETENTION_DAYS: RetentionDays = 365

export function isRetentionDays(value: number): value is RetentionDays {
  return (RETENTION_OPTIONS as readonly number[]).includes(value)
}

// null days → null expiry (kept until manual delete).
export function computeExpiresAt(days: number | null, from: Date = new Date()): string | null {
  if (days === null) return null
  const expires = new Date(from.getTime())
  expires.setUTCDate(expires.getUTCDate() + days)
  return expires.toISOString()
}

// Whole days remaining until expiry; null expiry → null ("Süresiz").
export function daysLeft(expiresAt: string | null, from: Date = new Date()): number | null {
  if (!expiresAt) return null
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - from.getTime()) / 86_400_000))
}

// ── Validation ──────────────────────────────────────────────────────────────

const entrySchema = z.object({
  question: z.string().max(500),
  answer: z.string().max(10_000),
})

// POST /api/hospital/records body. Client-side entry ids are stripped before
// this point — only {question, answer} pairs are accepted.
export const createRecordSchema = z.object({
  label: z.string().trim().min(1, 'Etiket zorunludur.').max(80, 'Etiket en fazla 80 karakter olabilir.'),
  mode: z.enum(['hizli', 'detayli']),
  entries: z.array(entrySchema).max(500),
  exam_entries: z.array(entrySchema).max(500).default([]),
  medula_text: z.string().max(100_000),
  ai_summary: z.string().max(20_000).nullish(),
})

export const retentionDaysSchema = z
  .number()
  .int()
  .nullable()
  .refine((v) => v === null || isRetentionDays(v), { message: 'Geçersiz saklama süresi.' })

// GET/PUT /api/hospital/settings body.
export const settingsBodySchema = z.object({
  retention_days: retentionDaysSchema,
})

// ── DTO ─────────────────────────────────────────────────────────────────────

export interface HospitalRecordEntry {
  question: string
  answer: string
}

export interface HospitalRecordDTO {
  id: string
  label: string
  mode: HospitalMode
  entries: HospitalRecordEntry[]
  exam_entries: HospitalRecordEntry[]
  medula_text: string
  ai_summary: string | null
  retention_days: number | null
  expires_at: string | null
  created_at: string
}
