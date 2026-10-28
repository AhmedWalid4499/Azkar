import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import {
  isRecord,
  MAX_LIFETIME_RECITATIONS,
  sanitizeCounts,
  sanitizeDated,
  sanitizeRecord,
  sanitizeSlots,
  sanitizeTally,
} from './progressData'
import type { SessionRecord } from './progressData'
import type { Counts } from './session'

/** One day's counts per prayer, by dhikr id. */
export type AfterPrayerCounts = Partial<Record<PrayerName, Counts>>

/** One day's after-prayer readings: a record per prayer, as for the morning and evening sessions. */
export type AfterPrayerDay = Partial<Record<PrayerName, SessionRecord>>

/** The azkar read after the five prayers. Added in version 3 of the store. */
export interface AfterPrayerProgress {
  /** Counts per day, prayer and dhikr id, so a reading can be resumed. The last `DETAIL_DAYS` days only. */
  days: Record<DateKey, AfterPrayerCounts>
  /** What was read after each prayer on each day, kept as long as the session records. */
  sessions: Record<DateKey, AfterPrayerDay>
  /**
   * Lifetime repetitions per dhikr id, after the prayers only. Never pruned. The store's own
   * `totals` count these too, with every other count in the reader.
   */
  totals: Record<string, number>
}

export function emptyAfterPrayer(): AfterPrayerProgress {
  return { days: {}, sessions: {}, totals: {} }
}

/** Keeps what is certainly after-prayer progress, as `sanitizeProgress` does for the sessions. */
export function sanitizeAfterPrayer(value: unknown): AfterPrayerProgress {
  const data = emptyAfterPrayer()
  if (!isRecord(value)) return data
  data.days = sanitizeDated(value.days, (day) => sanitizeCounts(day, PRAYERS))
  data.sessions = sanitizeDated(value.sessions, (day) => sanitizeSlots(day, PRAYERS, sanitizeRecord))
  data.totals = sanitizeTally(value.totals, MAX_LIFETIME_RECITATIONS) ?? {}
  return data
}
