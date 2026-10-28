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

/** When each logged prayer's status last changed, in epoch milliseconds. Kept only beside a status. */
export type LoggedAtDay = Partial<Record<PrayerName, number>>

/** Change times keyed by calendar day. Entries carried over from version 1 have none. */
export type LoggedAtEntries = Record<DateKey, LoggedAtDay>

/**
 * The voluntary prayers that can be ticked off, in the order of the day:
 * the confirmed sunnah prayers that go with the obligatory ones (the rawatib),
 * Duha in the forenoon, and the Night prayer (Qiyam, Tahajjud) and Witr.
 */
export const SUNNAH_PRAYERS = [
  'beforeFajr',
  'duha',
  'beforeDhuhr',
  'afterDhuhr',
  'afterMaghrib',
  'afterIsha',
  'qiyam',
  'witr',
] as const
export type SunnahPrayer = (typeof SUNNAH_PRAYERS)[number]

/** The confirmed sunnah prayers that go with the obligatory ones: twelve rak'ahs a day. */
export const RAWATIB = [
  'beforeFajr',
  'beforeDhuhr',
  'afterDhuhr',
  'afterMaghrib',
  'afterIsha',
] as const satisfies readonly SunnahPrayer[]
export type RawatibPrayer = (typeof RAWATIB)[number]

export const RAWATIB_RAKAHS: Record<RawatibPrayer, number> = {
  beforeFajr: 2,
  beforeDhuhr: 4,
  afterDhuhr: 2,
  afterMaghrib: 2,
  afterIsha: 2,
}

/**
 * Prayed in the night that follows a day's Isha, so they belong to that day:
 * one prayed after midnight but before Fajr counts for the day before.
 */
export const NIGHT_SUNNAH = ['afterIsha', 'qiyam', 'witr'] as const satisfies readonly SunnahPrayer[]

/** A day's ticked sunnah prayers. A key means done; its value is when it was ticked, in epoch milliseconds. */
export type SunnahDay = Partial<Record<SunnahPrayer, number>>

/** Every day with a sunnah prayer ticked, keyed by calendar day. Days with nothing ticked are absent. */
export type SunnahEntries = Record<DateKey, SunnahDay>

export function isSunnahPrayer(value: unknown): value is SunnahPrayer {
  return typeof value === 'string' && (SUNNAH_PRAYERS as readonly string[]).includes(value)
}

export function isRawatibPrayer(value: unknown): value is RawatibPrayer {
  return typeof value === 'string' && (RAWATIB as readonly string[]).includes(value)
}

export function isNightSunnah(value: unknown): boolean {
  return typeof value === 'string' && (NIGHT_SUNNAH as readonly string[]).includes(value)
}
