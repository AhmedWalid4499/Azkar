import type { DateKey } from './types'

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Wall-clock fields of an instant as seen in `timeZone`. */
export function zonedParts(date: Date, timeZone: string = deviceTimeZone()): ZonedParts {
  let formatter = partsFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    partsFormatters.set(timeZone, formatter)
  }
  const out: Record<string, number> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value)
  }
  return out as unknown as ZonedParts
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function makeDateKey(year: number, month: number, day: number): DateKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** The calendar day an instant falls on in `timeZone`. */
export function dateKeyInZone(date: Date, timeZone: string = deviceTimeZone()): DateKey {
  const { year, month, day } = zonedParts(date, timeZone)
  return makeDateKey(year, month, day)
}

export function isValidDateKey(key: string): key is DateKey {
  const match = DATE_KEY_RE.exec(key)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function partsOfDateKey(key: DateKey): { year: number; month: number; day: number } {
  const match = DATE_KEY_RE.exec(key)
  if (!match) throw new Error(`Invalid date key: ${key}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/**
 * Noon UTC on the given calendar day. Use it with `timeZone: 'UTC'` to format a
 * date key without the device's zone shifting it onto a neighbouring day.
 */
export function dateKeyToUtcNoon(key: DateKey): Date {
  const { year, month, day } = partsOfDateKey(key)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

export function shiftDateKey(key: DateKey, days: number): DateKey {
  const date = dateKeyToUtcNoon(key)
  date.setUTCDate(date.getUTCDate() + days)
  return makeDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((dateKeyToUtcNoon(to).getTime() - dateKeyToUtcNoon(from).getTime()) / 86_400_000)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfDateKey(key: DateKey): number {
  return dateKeyToUtcNoon(key).getUTCDay()
}

export function formatDateKey(
  key: DateKey,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory', timeZone: 'UTC' }).format(
    dateKeyToUtcNoon(key),
  )
}

/**
 * Hijri date for a civil day using the Umm al-Qura calendar. Local moon
 * sighting can differ by a day or two, hence `offsetDays`.
 */
export function formatHijri(key: DateKey, locale: string, offsetDays = 0): string {
  return new Intl.DateTimeFormat(locale, {
    calendar: 'islamic-umalqura',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateKeyToUtcNoon(shiftDateKey(key, offsetDays)))
}

export function formatClock(date: Date, locale: string, timeZone: string, hour12: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: hour12 ? 'h12' : 'h23',
    timeZone,
  }).format(date)
}
