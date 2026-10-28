import { shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import type { DayPhase } from './clock'
import { getAfterPrayerAzkar } from './data'

export function isPrayerName(value: unknown): value is PrayerName {
  return (PRAYERS as readonly unknown[]).includes(value)
}

/** The prayers the dataset has after-prayer azkar for, in the order of the day. */
export function availableAfterPrayers(): PrayerName[] {
  return PRAYERS.filter((prayer) => getAfterPrayerAzkar(prayer).length > 0)
}

/**
 * The day a prayer's after-prayer azkar are filed under right now: today, or yesterday until
 * Fajr. Isha read at 1 am belongs to the evening before, as the prayer log has it, and so does
 * every other prayer's: none of today's has come yet.
 */
export function afterPrayerDateKey(today: DateKey, phase: DayPhase): DateKey {
  return phase === 'beforeDawn' ? shiftDateKey(today, -1) : today
}

/**
 * The reader of one prayer's after-prayer azkar. Without `dateKey` it follows the clock
 * (see `afterPrayerDateKey`); with one it reads that day, which may be in the past.
 */
export function afterPrayerPath(prayer: PrayerName, dateKey?: DateKey): string {
  return dateKey === undefined ? `/azkar/after/${prayer}` : `/azkar/after/${prayer}/${dateKey}`
}
