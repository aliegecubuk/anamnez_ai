// Scoring logic for the evaluation harness — pure functions, no I/O, no side
// effects. Kept separate from evals/run.ts so the metric logic can be exercised
// directly (red-path checks) without running the CLI.

import type { HospitalMode } from '../src/lib/hospital/types'

export interface GoldenEntry {
  question: string
  answer: string
  note?: string
}

export interface ForbiddenEntry {
  question: string
  reason?: string
}

export interface GoldenCase {
  id: string
  title: string
  mode: HospitalMode
  transcript: string
  expected_entries: GoldenEntry[]
  forbidden_entries: ForbiddenEntry[]
  min_precision?: number
  min_recall?: number
}

export interface ExtractedEntry {
  question: string
  answer: string
}

export interface ExtractResult {
  entries: ExtractedEntry[]
}

export interface CaseReport {
  id: string
  title: string
  mode: HospitalMode
  expectedCount: number
  extractedCount: number
  matched: number
  missing: GoldenEntry[]
  forbiddenHits: Array<{ question: string; answer: string; forbidden: string; reason?: string }>
  ungrounded: ExtractedEntry[]
  precision: number
  recall: number
  hallucinations: number
  pass: boolean
}

// Pass bar per case (overridable per case via min_precision/min_recall).
// See README for why the bar is 0.8 while the product claim is >= 0.98.
export const DEFAULT_MIN_PRECISION = 0.8
export const DEFAULT_MIN_RECALL = 0.8
export const ANSWER_OVERLAP_THRESHOLD = 0.5
export const QUESTION_JACCARD_THRESHOLD = 0.5

const STOPWORDS = new Set([
  've', 'ile', 'bir', 'de', 'da', 'ki', 'mi', 'mı', 'mu', 'mü', 'için', 'bu', 'şu',
  'o', 'çok', 'daha', 'en', 'gibi', 'kadar', 'olan', 'olarak', 'ya', 'hem', 'ama',
  'ise', 'var',
])

export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[^a-zçğıöşü0-9%\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentTokens(text: string): Set<string> {
  const norm = normalize(text)
  if (!norm) return new Set()
  return new Set(norm.split(' ').filter((t) => t && !STOPWORDS.has(t)))
}

// Question headings match on: exact equality, substring containment,
// token containment, or Jaccard >= threshold (all after normalization).
export function questionSimilar(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
  let contained = true
  for (const t of small) {
    if (!big.has(t)) {
      contained = false
      break
    }
  }
  if (contained) return true
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  return union > 0 && inter / union >= QUESTION_JACCARD_THRESHOLD
}

// Fraction of expected-answer content tokens present in the actual answer.
export function answerOverlap(expected: string, actual: string): number {
  const expectedTokens = contentTokens(expected)
  if (expectedTokens.size === 0) return 1
  const actualTokens = contentTokens(actual)
  let hit = 0
  for (const t of expectedTokens) if (actualTokens.has(t)) hit++
  return hit / expectedTokens.size
}

export function evaluateCase(gc: GoldenCase, result: ExtractResult): CaseReport {
  const extracted = result.entries ?? []
  const used = new Array<boolean>(extracted.length).fill(false)
  const missing: GoldenEntry[] = []
  let matched = 0

  // Greedy best-match: each expected entry claims at most one extracted entry.
  for (const exp of gc.expected_entries) {
    let bestIdx = -1
    let bestScore = 0
    for (let i = 0; i < extracted.length; i++) {
      if (used[i]) continue
      if (!questionSimilar(exp.question, extracted[i].question)) continue
      const score = answerOverlap(exp.answer, extracted[i].answer)
      if (score >= ANSWER_OVERLAP_THRESHOLD && score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      used[bestIdx] = true
      matched++
    } else {
      missing.push(exp)
    }
  }

  const forbiddenHits: CaseReport['forbiddenHits'] = []
  const ungrounded: ExtractedEntry[] = []
  for (let i = 0; i < extracted.length; i++) {
    if (used[i]) continue
    const forbidden = gc.forbidden_entries.find((f) => questionSimilar(f.question, extracted[i].question))
    if (forbidden) {
      forbiddenHits.push({
        question: extracted[i].question,
        answer: extracted[i].answer,
        forbidden: forbidden.question,
        reason: forbidden.reason,
      })
    } else {
      ungrounded.push(extracted[i])
    }
  }

  const precision = extracted.length === 0 ? 1 : matched / extracted.length
  const recall = gc.expected_entries.length === 0 ? 1 : matched / gc.expected_entries.length
  const hallucinations = forbiddenHits.length + ungrounded.length
  const minPrecision = gc.min_precision ?? DEFAULT_MIN_PRECISION
  const minRecall = gc.min_recall ?? DEFAULT_MIN_RECALL
  const pass = precision >= minPrecision && recall >= minRecall && hallucinations === 0

  return {
    id: gc.id,
    title: gc.title,
    mode: gc.mode,
    expectedCount: gc.expected_entries.length,
    extractedCount: extracted.length,
    matched,
    missing,
    forbiddenHits,
    ungrounded,
    precision,
    recall,
    hallucinations,
    pass,
  }
}
