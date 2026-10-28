import { shiftDateKey, zonedParts } from '../../shared/date'
import type { DateKey, PrayerDay } from '../../shared/types'
import { isNightSunnah } from '../prayer-log'
import type { SunnahPrayer } from '../prayer-log'
import { isValidTime } from '../prayer-times'

/** Stand-in for Fajr (local hour) on days it cannot be computed, as near the poles in summer. */
const FALLBACK_FAJR_HOUR = 4

/**
 * Whether `now` still belongs to last night: past midnight and not yet Fajr.
 * `today` is the timetable of the calendar day `now` falls on in `timeZone`.
 */
export function isBeforeDawn(now: Date, timeZone: string, today: PrayerDay | null): boolean {
  const fajr = today?.times.fajr
  if (isValidTime(fajr)) return now.getTime() < fajr.getTime()
  return zonedParts(now, timeZone).hour < FALLBACK_FAJR_HOUR
}

/**
 * The day a sunnah prayer ticked now is filed under. The prayers of the night
 * (the two after Isha, the Night prayer and Witr) belong to the day whose Isha
 * opened that night, so until Fajr they still count for the day before, just
 * like last night's Isha.
 */
export function sunnahDateKey(sunnah: SunnahPrayer, today: DateKey, beforeDawn: boolean): DateKey {
  return beforeDawn && isNightSunnah(sunnah) ? shiftDateKey(today, -1) : today
}
