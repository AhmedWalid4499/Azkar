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

const ARABIC_INDIC_ZERO = '٠'

/** Whether a number formatter (`useI18n().n`) writes Arabic-Indic digits: Arabic interface, digits setting on. */
export function writesArabicIndicDigits(n: (value: number) => string): boolean {
  return n(0) === ARABIC_INDIC_ZERO
}

/** Western digits rewritten as Arabic-Indic ones. For prose shown around a recitation, never for the recitation. */
export function toArabicIndicDigits(text: string): string {
  return text.replace(/[0-9]/g, (digit) => String.fromCharCode(ARABIC_INDIC_ZERO.charCodeAt(0) + Number(digit)))
}

/**
 * A bilingual field of prose (a reference, virtue or note) for display. The dataset writes
 * its numbers in Western digits; with `arabicDigits` the Arabic side shows them like every
 * other number on the page. An English fallback keeps its own digits.
 */
export function localizedProse(field: Bilingual, lang: Lang, arabicDigits: boolean): string {
  const text = localized(field, lang)
  return arabicDigits && lang === 'ar' && text === field.ar?.trim() ? toArabicIndicDigits(text) : text
}
