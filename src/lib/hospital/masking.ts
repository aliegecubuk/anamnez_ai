// Client-side identity masking: if the patient's name / TC / phone shows up in
// the spoken transcript, it is replaced with MASK before display, before the
// extract call, and in the PDF body. Raw identity only ever lives in React state.

import type { HospitalIdentity } from './types'

export const MASK = '***'

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Turkish-aware case-insensitive pattern for one word. JS 'i' flag maps i↔I
// (ASCII), which is wrong for Turkish (i↔İ, ı↔I) — build explicit char classes
// covering both Turkish and ASCII case pairs so STT casing never leaks a name.
function turkishWordPattern(word: string): string {
  let pattern = ''
  for (const ch of word) {
    const variants = new Set([
      ch,
      ch.toLocaleLowerCase('tr-TR'),
      ch.toLocaleUpperCase('tr-TR'),
      ch.toLowerCase(),
      ch.toUpperCase(),
    ])
    const chars = [...variants].map(escapeRegex).join('')
    pattern += variants.size > 1 ? `[${chars}]` : escapeRegex(ch)
  }
  return pattern
}

// Standalone word boundaries that work with Unicode letters (\b does not).
const NOT_BEFORE = '(?<![\\p{L}\\p{N}])'
const NOT_AFTER = '(?![\\p{L}\\p{N}])'

function maskNames(text: string, identity: HospitalIdentity): string {
  const tokens = `${identity.firstName} ${identity.lastName}`
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)

  let out = text
  for (const token of tokens) {
    const re = new RegExp(`${NOT_BEFORE}${turkishWordPattern(token)}${NOT_AFTER}`, 'gu')
    out = out.replace(re, MASK)
  }
  return out
}

function maskNumbers(text: string, identity: HospitalIdentity): string {
  let out = text

  // Entered phone, matched digits-only with flexible separators.
  const phoneDigits = identity.phone.replace(/\D/g, '')
  if (phoneDigits.length >= 7) {
    const flexible = phoneDigits.split('').map(escapeRegex).join('[\\s.\\-()]*')
    out = out.replace(new RegExp(`(?<!\\d)${flexible}(?!\\d)`, 'gu'), MASK)
  }

  // Any standalone 11-digit number reads as a TC no — mask defensively.
  out = out.replace(/(?<!\d)\d{11}(?!\d)/gu, MASK)

  // Turkish mobile formats: 05xx / 5xx with optional separators.
  out = out.replace(
    /(?<!\d)0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/gu,
    MASK,
  )

  return out
}

/** Mask all identity traces in a transcript. Empty identity fields are ignored. */
export function maskIdentity(text: string, identity: HospitalIdentity): string {
  if (!text) return text
  return maskNumbers(maskNames(text, identity), identity)
}
