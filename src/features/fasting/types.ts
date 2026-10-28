import type { DateKey } from '../../shared/types'

/**
 * What a fast is for.
 * - `ramadan`: a day of Ramadan
 * - `qada`: making up a day of Ramadan that was not fasted
 * - `voluntary`: any fast that is not owed (Mondays and Thursdays, the white days, Arafah…)
 */
export const FAST_KINDS = ['ramadan', 'qada', 'voluntary'] as const
export type FastKind = (typeof FAST_KINDS)[number]

/**
 * How the day went.
 * - `fasted`: fasted from Fajr to Maghrib
 * - `broken`: began the fast and did not complete it
 * - `excused`: did not fast for a valid reason (travel, illness, menstruation); it never
 *   counts against the user, but a Ramadan day still has to be made up
 * - `missed`: did not fast, without an excuse
 */
export const FAST_STATUSES = ['fasted', 'broken', 'excused', 'missed'] as const
export type FastStatus = (typeof FAST_STATUSES)[number]

/** One day's fast. */
export interface FastRecord {
  kind: FastKind
  status: FastStatus
  /** When it was logged or last changed, in epoch milliseconds. Absent only if a stored time was unreadable. */
  at?: number
}

/** Every day with a fast logged, keyed by calendar day. Days with nothing logged are absent. */
export type FastingDays = Record<DateKey, FastRecord>

export function isFastKind(value: unknown): value is FastKind {
  return typeof value === 'string' && (FAST_KINDS as readonly string[]).includes(value)
}

export function isFastStatus(value: unknown): value is FastStatus {
  return typeof value === 'string' && (FAST_STATUSES as readonly string[]).includes(value)
}
