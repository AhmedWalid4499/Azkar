import { dateKeyToUtcNoon, isValidDateKey, shiftDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'

/** A day of the Umm al-Qura calendar. Months run from 1 (Muharram) to 12 (Dhu al-Hijjah). */
export interface HijriDate {
  year: number
  month: number
  day: number
}

export const MUHARRAM = 1
export const RAMADAN = 9
export const SHAWWAL = 10
export const DHU_AL_HIJJAH = 12

const CALENDAR = 'islamic-umalqura'

let numeric: Intl.DateTimeFormat | null | undefined

/** `null` where the runtime lacks the calendar: it would silently answer in Gregorian. */
function ummAlQura(): Intl.DateTimeFormat | null {
  if (numeric === undefined) {
    const format = new Intl.DateTimeFormat(`en-u-ca-${CALENDAR}-nu-latn`, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    })
    numeric = format.resolvedOptions().calendar === CALENDAR ? format : null
  }
  return numeric
}

/** Keyed by the civil day after the offset is applied, so every offset shares it. */
const cache = new Map<DateKey, HijriDate | null>()
const CACHE_LIMIT = 4000

function lookUp(key: DateKey): HijriDate | null {
  const format = ummAlQura()
  if (!format) return null
  const out: Record<string, number> = {}
  for (const part of format.formatToParts(dateKeyToUtcNoon(key))) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') out[part.type] = Number(part.value)
  }
  const { year, month, day } = out
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  return { year: year!, month: month!, day: day! }
}

function usableOffset(offsetDays: number): number {
  return Number.isInteger(offsetDays) ? offsetDays : 0
}

/**
 * The Hijri date of a civil day on the Umm al-Qura calendar, shifted by the
 * user's `offsetDays` exactly as the shared `formatHijri` shifts it (a positive
 * offset moves the Hijri date later). `null` when the day is not a real date or
 * the runtime has no Umm al-Qura calendar.
 */
export function hijriOf(dateKey: DateKey, offsetDays = 0): HijriDate | null {
  if (!isValidDateKey(dateKey)) return null
  const key = shiftDateKey(dateKey, usableOffset(offsetDays))
  if (cache.has(key)) return cache.get(key) ?? null
  const found = lookUp(key)
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, found)
  return found
}

/** The day of Ramadan (1 to 30), or `null` outside Ramadan. */
export function ramadanDayOf(dateKey: DateKey, offsetDays = 0): number | null {
  const hijri = hijriOf(dateKey, offsetDays)
  return hijri?.month === RAMADAN ? hijri.day : null
}

export function isRamadan(dateKey: DateKey, offsetDays = 0): boolean {
  return ramadanDayOf(dateKey, offsetDays) !== null
}

/** The civil day on which the Hijri month containing `dateKey` begins. */
export function monthStartOf(dateKey: DateKey, offsetDays = 0): DateKey | null {
  const hijri = hijriOf(dateKey, offsetDays)
  return hijri ? shiftDateKey(dateKey, 1 - hijri.day) : null
}

/** The mean length of a lunar month, in days. */
const LUNATION = 29.530588853
/** 1 Muharram 1448 on the Umm al-Qura calendar: an anchor for estimating where a month begins. */
const ANCHOR = { key: '2026-06-16', index: 1448 * 12 }

/**
 * The civil days of one Hijri month, in order, as the user's offset places them.
 * Empty when the runtime has no Umm al-Qura calendar or the month is out of its range.
 */
export function civilDaysOfHijriMonth(year: number, month: number, offsetDays = 0): DateKey[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return []
  const index = year * 12 + (month - 1)
  const estimate = shiftDateKey(ANCHOR.key, Math.round((index - ANCHOR.index) * LUNATION))
  // A month begins within a day or two of its mean date; five either way is ample.
  let start: DateKey | null = null
  for (let delta = -5; delta <= 5 && start === null; delta++) {
    const candidate = shiftDateKey(estimate, delta)
    const hijri = hijriOf(candidate, offsetDays)
    if (hijri?.year === year && hijri.month === month && hijri.day === 1) start = candidate
  }
  if (start === null) return []
  const days: DateKey[] = []
  for (let key = start; days.length < 30; key = shiftDateKey(key, 1)) {
    const hijri = hijriOf(key, offsetDays)
    if (hijri?.year !== year || hijri.month !== month) break
    days.push(key)
  }
  return days
}

function formatIn(locale: string, options: Intl.DateTimeFormatOptions, dateKey: DateKey, offsetDays: number): string {
  return new Intl.DateTimeFormat(locale, { ...options, calendar: CALENDAR, timeZone: 'UTC' }).format(
    dateKeyToUtcNoon(shiftDateKey(dateKey, usableOffset(offsetDays))),
  )
}

/** The Hijri month and year of a civil day in the reader's language: "Jumada I 1448 AH". */
export function formatHijriMonth(dateKey: DateKey, locale: string, offsetDays = 0): string {
  return formatIn(locale, { month: 'long', year: 'numeric' }, dateKey, offsetDays)
}

/** The Hijri year of a civil day: "1448 AH". */
export function formatHijriYear(dateKey: DateKey, locale: string, offsetDays = 0): string {
  return formatIn(locale, { year: 'numeric' }, dateKey, offsetDays)
}

/** The Hijri day and month without the year: "13 Jumada I". */
export function formatHijriDayMonth(dateKey: DateKey, locale: string, offsetDays = 0): string {
  return formatIn(locale, { day: 'numeric', month: 'long' }, dateKey, offsetDays)
}
