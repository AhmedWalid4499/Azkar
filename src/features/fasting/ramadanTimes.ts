import type { DateKey, PrayerDay } from '../../shared/types'

export interface RamadanMoment {
  /** Suhoor ends at Fajr; iftar is at Maghrib. */
  kind: 'suhoor' | 'iftar'
  at: Date
  /** Tomorrow's suhoor, after today's iftar. */
  tomorrow: boolean
}

function timeOf(day: PrayerDay | null, dateKey: DateKey, slot: 'fajr' | 'maghrib'): Date | null {
  // The hook may still hold another day's timetable for a moment, and a time may not exist (polar day or night).
  if (!day || day.dateKey !== dateKey) return null
  const at = day.times[slot]
  return at instanceof Date && !Number.isNaN(at.getTime()) ? at : null
}

export interface RamadanTimes {
  suhoorEnds: Date | null
  iftar: Date | null
  /** The next of them from now, then tomorrow's suhoor if tomorrow is still Ramadan. `null` once the last iftar is past. */
  next: RamadanMoment | null
}

export function ramadanTimes(
  now: Date,
  { today, todayTimes, tomorrow, tomorrowTimes, tomorrowIsRamadan }: {
    today: DateKey
    todayTimes: PrayerDay | null
    tomorrow: DateKey
    tomorrowTimes: PrayerDay | null
    tomorrowIsRamadan: boolean
  },
): RamadanTimes {
  const suhoorEnds = timeOf(todayTimes, today, 'fajr')
  const iftar = timeOf(todayTimes, today, 'maghrib')
  const nextSuhoor = tomorrowIsRamadan ? timeOf(tomorrowTimes, tomorrow, 'fajr') : null
  const candidates: RamadanMoment[] = []
  if (suhoorEnds) candidates.push({ kind: 'suhoor', at: suhoorEnds, tomorrow: false })
  if (iftar) candidates.push({ kind: 'iftar', at: iftar, tomorrow: false })
  if (nextSuhoor) candidates.push({ kind: 'suhoor', at: nextSuhoor, tomorrow: true })
  const next = candidates.find((moment) => moment.at.getTime() > now.getTime()) ?? null
  return { suhoorEnds, iftar, next }
}
