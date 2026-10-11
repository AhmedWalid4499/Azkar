import type { Lang } from '../../../shared/types'
import type { Bilingual } from '../data'

/** Harakat, Qur'anic annotation marks and tatweel: they add no width to a line. */
const NON_SPACING = /[ؐ-ؚـً-ٰٟۖ-ۭ]/g

const SHORT_PASSAGE_LETTERS = 48
const SNIPPET_WORDS = 6

/** A dhikr short enough to sit on a line or two, which reads well centred. */
export function isShortPassage(arabic: string): boolean {
  const text = arabic.trim()
  return !text.includes('\n') && text.replace(NON_SPACING, '').length <= SHORT_PASSAGE_LETTERS
}

/** The opening words of a dhikr, for lists. */
export function snippet(arabic: string): string {
  const words = arabic.trim().split(/\s+/)
  return words.length > SNIPPET_WORDS ? `${words.slice(0, SNIPPET_WORDS).join(' ')} …` : words.join(' ')
}

/** The interface-language side of a bilingual field, falling back to the other when it is empty. */
export function localized(field: Bilingual, lang: Lang): string {
  const other = lang === 'ar' ? 'en' : 'ar'
  return field[lang]?.trim() || field[other]?.trim() || ''
}
