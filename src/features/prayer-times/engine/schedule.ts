import { PRAYERS } from '../../../shared/types'
import type { PrayerDay, UpcomingPrayer } from '../../../shared/types'
import { isValidTime } from './compute'

/**
 * The obligatory prayers of several days as one chronological list. Times that
 * could not be computed are left out. Sorting by instant rather than trusting
 * the day order matters at high latitudes, where a day's Maghrib and Isha can
 * fall after the next civil midnight.
 */
export function buildTimeline(days: ReadonlyArray<PrayerDay>): UpcomingPrayer[] {
  const timeline: UpcomingPrayer[] = []
  for (const day of days) {
    for (const prayer of PRAYERS) {
      const at = day.times[prayer]
      if (isValidTime(at)) timeline.push({ prayer, at, dateKey: day.dateKey })
    }
  }
  return timeline.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** The first prayer strictly after `now`; a prayer whose time has just arrived is no longer "next". */
export function nextPrayerAt(timeline: ReadonlyArray<UpcomingPrayer>, now: Date): UpcomingPrayer | null {
  const instant = now.getTime()
  return timeline.find((entry) => entry.at.getTime() > instant) ?? null
}

/**
 * The prayer whose time it currently is, or `null` when there is none: between
 * sunrise and Dhuhr, or when the times around `now` could not be computed.
 * Isha runs until the following Fajr.
 */
export function currentPrayerAt(
  timeline: ReadonlyArray<UpcomingPrayer>,
  days: ReadonlyArray<PrayerDay>,
  now: Date,
): UpcomingPrayer | null {
  const instant = now.getTime()
  const current = timeline.findLast((entry) => entry.at.getTime() <= instant)
  const day = current && days.find((candidate) => candidate.dateKey === current.dateKey)
  if (!current || !day) return null
  // With gaps in the day there is no telling which period this really is.
  if (PRAYERS.some((prayer) => !isValidTime(day.times[prayer]))) return null
  if (current.prayer === 'fajr') {
    const sunrise = day.times.sunrise
    if (!isValidTime(sunrise) || sunrise.getTime() <= instant) return null
  }
  return current
}
