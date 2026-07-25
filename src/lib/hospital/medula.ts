// Medula free-text formatting: sentence-by-sentence flowing clinical text,
// ready to paste into the Medula anamnesis field.
// Bare negative answers ("yok", "hayır", ...) are NEVER emitted on their own —
// they always carry their question heading ("Alerjiler: Yok.") so the printed
// output can never read as an ambiguous "yok, yok" sequence.
// Turkish casing rules apply (i → İ, ı → I via tr-TR locale).

const TERMINAL_PUNCTUATION = /[.!?…]$/

// An answer whose ENTIRE text is a negative statement carries no context of its
// own; without the question heading it is clinically ambiguous.
const BARE_NEGATIVE_ANSWER = /^(yok|yoktur|hayır|mevcut değil|değil|bulunmuyor|bulunmamaktadır|olmadığı|olumsuz|saptanmadı|izlenmedi|görülmedi|kullanmıyor|almıyor)$/

// One question/answer pair — structurally compatible with HospitalEntry.
export interface MedulaEntry {
  question: string
  answer: string
}

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

/** True when the whole answer is a bare negative ("yok", "bulunmuyor", ...). */
export function isBareNegativeAnswer(answer: string): boolean {
  const text = answer
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?…]+$/, '')
    .toLocaleLowerCase('tr-TR')
  return BARE_NEGATIVE_ANSWER.test(text)
}

/** Question text as an inline heading: trimmed, capitalized, no trailing '?'. */
function normalizeQuestionHeading(question: string): string {
  const text = question.replace(/\s+/g, ' ').trim().replace(/[?:.\s]+$/, '')
  if (!text) return ''
  return text[0].toLocaleUpperCase('tr-TR') + text.slice(1)
}

/**
 * Entries joined into one paragraph for Medula copy-paste.
 * Context-rich answers stay heading-free; a bare negative answer always gets
 * its question heading prefixed ("Alerjiler: Yok.").
 */
export function buildMedulaText(entries: MedulaEntry[]): string {
  return entries
    .map(({ question, answer }) => {
      const sentence = normalizeClinicalSentence(answer)
      if (!sentence) return ''
      if (!isBareNegativeAnswer(answer)) return sentence
      const heading = normalizeQuestionHeading(question)
      return heading ? `${heading}: ${sentence}` : sentence
    })
    .filter((s) => s.length > 0)
    .join(' ')
}
