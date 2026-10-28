import { shiftDateKey } from '../../../shared/date'
import { PRAYERS } from '../../../shared/types'
import type { DateKey, PrayerDay, PrayerName, TimeSlot } from '../../../shared/types'
import type { IshaDeadline } from '../config'
import { isValidTime } from '../engine/compute'

const MINUTE_MS = 60_000

/** Whether a prayer of a day has been logged, whatever its status. */
export type IsLogged = (dateKey: DateKey, prayer: PrayerName) => boolean

export interface UnloggedChoices {
  /** How long before the prayer's time ends the reminder comes. */
  leadMinutes: number
  ishaEnds: IshaDeadline
  isLogged: IsLogged
}

/** "You haven't logged this prayer yet", shortly before its time ends. */
export interface UnloggedEntry {
  kind: 'unlogged'
  prayer: PrayerName
  dateKey: DateKey
  at: Date
  /** When the prayer's time ends. */
  endsAt: Date
  /** `endsAt` ends only the preferred time: Isha's at the middle of the night. */
  preferred: boolean
  key: string
}

/** The time that ends each prayer's time on its own day. Isha's ends on the next. */
const ENDED_BY: Record<Exclude<PrayerName, 'isha'>, TimeSlot> = {
  fajr: 'sunrise',
  dhuhr: 'asr',
  asr: 'maghrib',
  maghrib: 'isha',
}

/**
 * When the time of `prayer` on `day` ends: Fajr at sunrise, Dhuhr at Asr, Asr
 * at Maghrib, Maghrib at Isha, and Isha at the middle of the night between
 * Maghrib and the next Fajr, or at that Fajr. `null` when a time it depends
 * on does not exist (polar day or night) or `nextDay` is not given for Isha.
 */
export function prayerDeadline(
  prayer: PrayerName,
  day: PrayerDay,
  nextDay: PrayerDay | undefined,
  ishaEnds: IshaDeadline,
): { endsAt: Date; preferred: boolean } | null {
  if (prayer !== 'isha') {
    const end = day.times[ENDED_BY[prayer]]
    return isValidTime(end) ? { endsAt: end, preferred: false } : null
  }
  const nextFajr = nextDay?.times.fajr
  if (!isValidTime(nextFajr)) return null
  if (ishaEnds === 'fajr') return { endsAt: nextFajr, preferred: false }
  const maghrib = day.times.maghrib
  if (!isValidTime(maghrib)) return null
  // The prayer times are whole minutes, so the middle can fall on half of one:
  // the minute it falls in, so the reminder never promises more time than there is.
  const middle = (maghrib.getTime() + nextFajr.getTime()) / 2
  return { endsAt: new Date(Math.floor(middle / MINUTE_MS) * MINUTE_MS), preferred: true }
}

/**
 * The "not logged yet" reminders of `days`, unsorted: one `leadMinutes` before
 * the end of each prayer's time, for every prayer `isLogged` does not know of.
 * A prayer whose time or end does not exist that day is left out, and so is
 * one whose reminder would come before the prayer has even begun.
 */
export function unloggedEntries(days: readonly PrayerDay[], choices: UnloggedChoices): UnloggedEntry[] {
  const byDate = new Map(days.map((day) => [day.dateKey, day]))
  const entries: UnloggedEntry[] = []
  for (const day of days) {
    for (const prayer of PRAYERS) {
      const start = day.times[prayer]
      if (!isValidTime(start) || choices.isLogged(day.dateKey, prayer)) continue
      const deadline = prayerDeadline(prayer, day, byDate.get(shiftDateKey(day.dateKey, 1)), choices.ishaEnds)
      if (!deadline) continue
      const at = new Date(deadline.endsAt.getTime() - choices.leadMinutes * MINUTE_MS)
      if (at.getTime() <= start.getTime()) continue
      entries.push({ kind: 'unlogged', prayer, dateKey: day.dateKey, at, ...deadline, key: `${day.dateKey}-${prayer}-unlogged` })
    }
  }
  return entries
}
