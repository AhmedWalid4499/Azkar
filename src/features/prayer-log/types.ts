import type { DateKey, PrayerName } from '../../shared/types'

/**
 * How a prayer was logged.
 * - `ontime`: prayed within its time
 * - `jamaah`: prayed in congregation
 * - `late`: made up after its time (qada)
 * - `missed`: not prayed
 * - `excused`: not required that day (for example during menstruation); it
 *   never counts against the user anywhere in the app
 */
export const PRAYER_STATUSES = ['ontime', 'jamaah', 'late', 'missed', 'excused'] as const
export type PrayerStatus = (typeof PRAYER_STATUSES)[number]

/** One calendar day's log. A prayer without a key has not been logged. */
export type DayLog = Partial<Record<PrayerName, PrayerStatus>>

/** Every logged day, keyed by calendar day. Days with nothing logged are absent. */
export type LogEntries = Record<DateKey, DayLog>

export function isPrayerStatus(value: unknown): value is PrayerStatus {
  return typeof value === 'string' && (PRAYER_STATUSES as readonly string[]).includes(value)
}
