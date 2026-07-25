// Deterministic "not asked" checklist — no LLM involved.
// Each mode has a list of clinically critical topics; a topic counts as covered
// when ANY entry question contains one of its keywords. Matching is done on a
// folded form (tr-TR lowercase, ı→i, circumflex stripped, non-letters removed)
// so casing and dotted-letter variants never cause false "missing" flags.

import type { HospitalMode } from '@/lib/hospital/types'

export interface CriticalTopic {
  key: string
  // Chip label ("Gebelik" → chip reads "Gebelik sorulmadı").
  label: string
  // Question heading used when the chip click inserts an empty Q&A row.
  question: string
  keywords: string[]
}

// Turkish-aware fold for keyword matching: toLocaleLowerCase('tr-TR') maps
// İ→i and I→ı; the extra folds (ı→i, â→a, î→i, û→u) merge the variants a
// clinician might type in either dotted or dotless form.
export function foldForMatch(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

const HIZLI_TOPICS: CriticalTopic[] = [
  { key: 'sikayet', label: 'Şikâyet', question: 'Şikâyet', keywords: ['şikâyet', 'şikayet'] },
  {
    key: 'sure',
    label: 'Şikâyet süresi',
    question: 'Şikâyet süresi',
    keywords: ['süre', 'ne zamandır', 'kaç gündür', 'kaç saattir', 'başlangıç'],
  },
  {
    key: 'eslik',
    label: 'Eşlik eden semptomlar',
    question: 'Eşlik eden semptomlar',
    keywords: ['eşlik', 'semptom', 'belirti'],
  },
  {
    key: 'kronik',
    label: 'Kronik hastalıklar',
    question: 'Kronik hastalıklar',
    keywords: ['kronik', 'hastalık', 'özgeçmiş'],
  },
  {
    key: 'ilac',
    label: 'Kullanılan ilaçlar',
    question: 'Kullandığı ilaçlar',
    keywords: ['ilaç', 'medikasyon'],
  },
  { key: 'alerji', label: 'Alerjiler', question: 'Alerjiler', keywords: ['alerji'] },
  {
    key: 'gebelik',
    label: 'Gebelik',
    question: 'Gebelik',
    keywords: ['gebelik', 'hamilelik', 'gebe'],
  },
  {
    key: 'antikoagulan',
    label: 'Antikoagülan',
    question: 'Antikoagülan kullanımı',
    keywords: ['antikoagülan', 'kan sulandırıcı', 'pıhtılaşma'],
  },
]

const DETAYLI_EXTRA_TOPICS: CriticalTopic[] = [
  {
    key: 'ameliyat',
    label: 'Ameliyatlar / yatışlar',
    question: 'Ameliyatlar / Yatışlar',
    keywords: ['ameliyat', 'operasyon', 'yatış', 'cerrahi'],
  },
  {
    key: 'soygecmis',
    label: 'Soygeçmiş',
    question: 'Soygeçmiş',
    keywords: ['soygeçmiş', 'aile öyküsü', 'ailesel'],
  },
  // "Alışkanlıklar" covers both habits in one entry.
  { key: 'sigara', label: 'Sigara', question: 'Sigara', keywords: ['sigara', 'alışkanlık'] },
  { key: 'alkol', label: 'Alkol', question: 'Alkol', keywords: ['alkol', 'alışkanlık'] },
]

export const CRITICAL_TOPICS: Record<HospitalMode, CriticalTopic[]> = {
  hizli: HIZLI_TOPICS,
  detayli: [...HIZLI_TOPICS, ...DETAYLI_EXTRA_TOPICS],
}

/**
 * Topics from the mode's critical list that no entry question mentions.
 * Matches on folded question text; keywords are folded with the same function
 * so both sides always agree.
 */
export function missingCriticalTopics(
  entries: { question: string }[],
  mode: HospitalMode,
): CriticalTopic[] {
  const questions = entries.map((e) => foldForMatch(e.question)).filter(Boolean)
  return CRITICAL_TOPICS[mode].filter((topic) => {
    const keywords = topic.keywords.map(foldForMatch)
    return !keywords.some((kw) => questions.some((q) => q.includes(kw)))
  })
}
