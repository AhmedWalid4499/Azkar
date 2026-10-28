import { isValidDateKey } from '../../shared/date'
import { isFastKind, isFastStatus } from './types'
import type { FastingDays, FastRecord } from './types'

/** What the store saves: everything the user has logged. */
export interface PersistedFasting {
  days: FastingDays
  /** Days of Ramadan owed from before the log began, as the user counts them. */
  owedBefore: number
}

/** The most earlier days that can be entered: a hundred Ramadans. */
export const OWED_BEFORE_MAX = 3000

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

/**
 * A stored fast, or `null` when it is not certainly one. A fast whose time
 * cannot be read keeps its kind and status: the fast is what matters.
 */
export function sanitizeRecord(value: unknown): FastRecord | null {
  if (!isRecord(value)) return null
  const kind = own(value, 'kind')
  const status = own(value, 'status')
  if (!isFastKind(kind) || !isFastStatus(status)) return null
  const at = own(value, 'at')
  return isTimestamp(at) ? { kind, status, at } : { kind, status }
}

/**
 * Real calendar days with a known kind and status. Anything else is dropped
 * rather than repaired. Days after today are kept: a trip across the date
 * line, or a clock set wrong, can put a real fast there.
 */
export function sanitizeDays(value: unknown): FastingDays {
  const days: FastingDays = {}
  if (!isRecord(value)) return days
  for (const key of Object.keys(value)) {
    if (!isValidDateKey(key)) continue
    const record = sanitizeRecord(value[key])
    if (record) days[key] = record
  }
  return days
}

export function sanitizeOwedBefore(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(OWED_BEFORE_MAX, Math.max(0, value)) : 0
}

/**
 * Reads stored fasting data of any version as far as it can be understood.
 * Version 1 is the only shape so far; fields a newer build adds are left out,
 * and every fast it shares with this one is kept.
 */
export function sanitizeFasting(value: unknown): PersistedFasting {
  const state = isRecord(value) ? value : {}
  return { days: sanitizeDays(own(state, 'days')), owedBefore: sanitizeOwedBefore(own(state, 'owedBefore')) }
}
