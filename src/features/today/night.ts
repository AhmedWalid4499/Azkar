import { zonedParts } from '../../shared/date'
import type { PrayerDay } from '../../shared/types'
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
