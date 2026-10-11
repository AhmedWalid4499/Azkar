import {
  dateKeyToUtcNoon,
  formatDateKey,
  makeDateKey,
  partsOfDateKey,
  shiftDateKey,
  weekdayOfDateKey,
} from '../../shared/date'
import type { DateKey, Lang } from '../../shared/types'

/** A Gregorian month; `month` runs 1 to 12. */
export interface MonthRef {
  year: number
  month: number
}

export function monthOfDateKey(key: DateKey): MonthRef {
  const { year, month } = partsOfDateKey(key)
  return { year, month }
}

/** Negative when `a` is the earlier month, zero when they are the same. */
export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + (ref.month - 1) + delta
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 }
}

export function daysInMonth(ref: MonthRef): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate()
}

/** A day of the month as a key; a day past the month's end lands on its last day. */
export function dateKeyInMonth(ref: MonthRef, day: number): DateKey {
  return makeDateKey(ref.year, ref.month, Math.min(Math.max(day, 1), daysInMonth(ref)))
}

export function isInMonth(key: DateKey, ref: MonthRef): boolean {
  return compareMonths(monthOfDateKey(key), ref) === 0
}

/* ---------- Week layout ---------- */

interface WeekInfo {
  firstDay?: number
}

// Not in TypeScript's lib yet: engines ship either the method or the older getter.
type LocaleWithWeekInfo = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo }

const FALLBACK_WEEK_START: Record<Lang, number> = { en: 0, ar: 6 }

function deviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages ?? [navigator.language]
}

/**
 * First day of the week, 0 = Sunday … 6 = Saturday.
 *
 * The week's first day is a regional habit, not a linguistic one (Monday in
 * Britain, Sunday in Saudi Arabia, Saturday in Egypt), so a device language
 * that matches the interface language and names a region wins over the bare
 * language.
 */
export function weekStartOf(lang: Lang, preferred: readonly string[] = deviceLanguages()): number {
  const tag = preferred.find((candidate) => candidate.toLowerCase().split('-')[0] === lang) ?? lang
  try {
    const locale = new Intl.Locale(tag) as LocaleWithWeekInfo
    const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay
    // Intl counts Monday = 1 … Sunday = 7.
    if (typeof firstDay === 'number' && firstDay >= 1 && firstDay <= 7) return firstDay % 7
  } catch {
    // An unparseable tag: use the language's usual convention.
  }
  return FALLBACK_WEEK_START[lang]
}

/** Weekday indices (0 = Sunday) in display order. */
export function weekdayOrder(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, index) => (weekStart + index) % 7)
}

/** Weekday names indexed 0 = Sunday … 6 = Saturday. */
export function weekdayNames(locale: string, width: 'long' | 'short' | 'narrow'): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' })
  // 2026-10-11 is a Sunday.
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2026, 9, 11 + index, 12))))
}

/** The month as rows of seven cells. `null` pads the cells that belong to neighbouring months. */
export function buildMonthGrid(ref: MonthRef, weekStart: number): Array<Array<DateKey | null>> {
  const lead = (weekdayOfDateKey(dateKeyInMonth(ref, 1)) - weekStart + 7) % 7
  const cells: Array<DateKey | null> = Array.from({ length: lead }, () => null)
  const total = daysInMonth(ref)
  for (let day = 1; day <= total; day++) cells.push(makeDateKey(ref.year, ref.month, day))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: Array<Array<DateKey | null>> = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))
  return weeks
}

/* ---------- Keyboard navigation ---------- */

export interface GridMoveOptions {
  dir: 'ltr' | 'rtl'
  weekStart: number
  /** The last day that can take focus; later days are inert. */
  today: DateKey
}

/**
 * Where a key press moves focus from `from`, or `null` when the key does not
 * navigate. Left and right follow the reading direction, so in RTL the left
 * arrow goes to the next day. A move that would pass `today` stops on it.
 */
export function moveInGrid(key: string, from: DateKey, { dir, weekStart, today }: GridMoveOptions): DateKey | null {
  const towardsRight = dir === 'rtl' ? -1 : 1
  const offsetInWeek = (weekdayOfDateKey(from) - weekStart + 7) % 7
  let target: DateKey
  switch (key) {
    case 'ArrowRight':
      target = shiftDateKey(from, towardsRight)
      break
    case 'ArrowLeft':
      target = shiftDateKey(from, -towardsRight)
      break
    case 'ArrowUp':
      target = shiftDateKey(from, -7)
      break
    case 'ArrowDown':
      target = shiftDateKey(from, 7)
      break
    case 'Home':
      target = shiftDateKey(from, -offsetInWeek)
      break
    case 'End':
      target = shiftDateKey(from, 6 - offsetInWeek)
      break
    case 'PageUp':
      target = dateKeyInMonth(shiftMonth(monthOfDateKey(from), -1), partsOfDateKey(from).day)
      break
    case 'PageDown':
      target = dateKeyInMonth(shiftMonth(monthOfDateKey(from), 1), partsOfDateKey(from).day)
      break
    default:
      return null
  }
  return target > today ? today : target
}

/* ---------- Labels ---------- */

export function formatMonthTitle(ref: MonthRef, locale: string): string {
  return formatDateKey(dateKeyInMonth(ref, 1), locale, { month: 'long', year: 'numeric' })
}

export interface HijriSpan {
  from: string
  /** `null` when the whole Gregorian month falls inside one Hijri month. */
  to: string | null
}

/**
 * The Hijri month or months a Gregorian month covers, on the same Umm al-Qura
 * calendar and day offset as the shared `formatHijri`. When both ends share a
 * year it is written once: "Rabiʻ II" to "Jumada I 1448 AH".
 */
export function hijriSpanOfMonth(ref: MonthRef, locale: string, offsetDays = 0): HijriSpan {
  const base = { calendar: 'islamic-umalqura', timeZone: 'UTC' } as const
  const monthAndYear = new Intl.DateTimeFormat(locale, { ...base, month: 'long', year: 'numeric' })
  const monthOnly = new Intl.DateTimeFormat(locale, { ...base, month: 'long' })
  const yearOf = (date: Date) => monthAndYear.formatToParts(date).find((part) => part.type === 'year')?.value

  const start = dateKeyToUtcNoon(shiftDateKey(dateKeyInMonth(ref, 1), offsetDays))
  const end = dateKeyToUtcNoon(shiftDateKey(dateKeyInMonth(ref, daysInMonth(ref)), offsetDays))
  const from = monthAndYear.format(start)
  const to = monthAndYear.format(end)

  if (from === to) return { from, to: null }
  if (yearOf(start) === yearOf(end)) return { from: monthOnly.format(start), to }
  return { from, to }
}
