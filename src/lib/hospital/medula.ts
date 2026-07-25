// Medula free-text formatting: sentence-by-sentence flowing clinical text with
// no question headings, ready to paste into the Medula anamnesis field.
// Turkish casing rules apply (i → İ, ı → I via tr-TR locale).

const TERMINAL_PUNCTUATION = /[.!?…]$/

/**
 * Normalize one answer into a clinical sentence:
 * - collapse whitespace
 * - uppercase the first letter with Turkish locale rules
 * - ensure it ends with terminal punctuation (default '.')
 * Inner casing is preserved (drug names, abbreviations like INR).
 */
export function normalizeClinicalSentence(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const capitalized = text[0].toLocaleUpperCase('tr-TR') + text.slice(1)
  return TERMINAL_PUNCTUATION.test(capitalized) ? capitalized : `${capitalized}.`
}

/** Answers only — no headings — joined into one paragraph for Medula copy-paste. */
export function buildMedulaText(answers: string[]): string {
  return answers
    .map(normalizeClinicalSentence)
    .filter((s) => s.length > 0)
    .join(' ')
}
