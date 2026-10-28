import { isValidDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import { isPrayerStatus, SUNNAH_PRAYERS } from './types'
import type { DayLog, LogEntries, LoggedAtDay, LoggedAtEntries, SunnahDay, SunnahEntries } from './types'

/** What the store saves: everything the user has logged. */
export interface PersistedLog {
  entries: LogEntries
  loggedAt: LoggedAtEntries
  sunnah: SunnahEntries
}

/** The latest instant a `Date` can hold. */
const MAX_TIME = 8.64e15

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Not Object.hasOwn: the iOS app supports iOS 15.0, whose web view gained it only in 15.4.
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined
}

/** An epoch time in whole milliseconds, as `Date.now()` gives it. */
export function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_TIME
}

function sanitizeDay(value: unknown): DayLog | null {
  if (!isRecord(value)) return null
  const day: DayLog = {}
  for (const prayer of PRAYERS) {
    const status = own(value, prayer)
    if (isPrayerStatus(status)) day[prayer] = status
  }
  return Object.keys(day).length > 0 ? day : null
}

/**
 * Keeps only what is certainly a log entry: real calendar days, the five
 * prayers, known statuses. Everything else is dropped rather than repaired, and
 * days left empty disappear. Days after today are kept: a trip across the date
 * line, or a clock set wrong, can put a real entry there.
 */
export function sanitizeEntries(value: unknown): LogEntries {
  const entries: LogEntries = {}
  if (!isRecord(value)) return entries
  for (const key of Object.keys(value)) {
    if (!isValidDateKey(key)) continue
    const day = sanitizeDay(value[key])
    if (day) entries[key] = day
  }
  return entries
}

/** Keeps a change time only where `entries` holds a status for that prayer on that day. */
export function sanitizeLoggedAt(value: unknown, entries: LogEntries): LoggedAtEntries {
  const loggedAt: LoggedAtEntries = {}
  if (!isRecord(value)) return loggedAt
  for (const [key, log] of Object.entries(entries)) {
    const stored = own(value, key)
    if (!isRecord(stored)) continue
    const day: LoggedAtDay = {}
    for (const prayer of PRAYERS) {
      const at = own(stored, prayer)
      if (log[prayer] !== undefined && isTimestamp(at)) day[prayer] = at
    }
    if (Object.keys(day).length > 0) loggedAt[key] = day
  }
  return loggedAt
}

/** Real calendar days, known sunnah prayers, real times. Anything else is dropped and empty days disappear. */
export function sanitizeSunnah(value: unknown): SunnahEntries {
  const sunnah: SunnahEntries = {}
  if (!isRecord(value)) return sunnah
  for (const key of Object.keys(value)) {
    if (!isValidDateKey(key)) continue
    const stored = value[key]
    if (!isRecord(stored)) continue
    const day: SunnahDay = {}
    for (const prayer of SUNNAH_PRAYERS) {
      const at = own(stored, prayer)
      if (isTimestamp(at)) day[prayer] = at
    }
    if (Object.keys(day).length > 0) sunnah[key] = day
  }
  return sunnah
}

/**
 * Reads a stored log of any version as far as it can be understood. Version 1
 * held only `entries`; the other two maps then start empty.
 */
export function sanitizeLog(value: unknown): PersistedLog {
  const state = isRecord(value) ? value : {}
  const entries = sanitizeEntries(state.entries)
  return { entries, loggedAt: sanitizeLoggedAt(state.loggedAt, entries), sunnah: sanitizeSunnah(state.sunnah) }
}
