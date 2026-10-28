import { useMemo } from 'react'
import { shiftDateKey } from '../../../shared/date'
import { PRAYERS } from '../../../shared/types'
import type { DateKey } from '../../../shared/types'
import type { LogEntries } from '../../prayer-log'
// The store module, not the feature's index: the index brings in the log pages, whose
// azkar imports come back round to this feature, and the app, which loads azkar first,
// would start with azkar half-evaluated (see the cycle test beside this file).
import { usePrayerLog } from '../../prayer-log/store'
import { WINDOW_DAYS } from './plan'
import type { IsLogged } from './unlogged'

/**
 * The prayers logged on the days from `from` to `to`, whatever their status, as
 * one string such as "2026-10-12-fajr 2026-10-12-dhuhr". It stays the same while
 * a status only changes into another, so nothing is planned again for that.
 */
export function loggedSignature(entries: LogEntries, from: DateKey, to: DateKey): string {
  const logged: string[] = []
  for (let dateKey = from; dateKey <= to; dateKey = shiftDateKey(dateKey, 1)) {
    const day = Object.hasOwn(entries, dateKey) ? entries[dateKey] : undefined
    if (!day) continue
    for (const prayer of PRAYERS) if (day[prayer] !== undefined) logged.push(`${dateKey}-${prayer}`)
  }
  return logged.join(' ')
}

/**
 * Whether a prayer of a day is logged, for the days the reminders around
 * `today` can be about: yesterday, whose Isha ends after midnight, to the day
 * after the scheduling window. A new function only when one of them is logged
 * or cleared, so the reminders are planned again the moment that happens.
 */
export function useLoggedPrayers(today: DateKey): IsLogged {
  const from = shiftDateKey(today, -1)
  const to = shiftDateKey(today, WINDOW_DAYS + 1)
  const signature = usePrayerLog((state) => loggedSignature(state.entries, from, to))
  return useMemo(() => {
    const logged = new Set(signature.split(' '))
    return (dateKey, prayer) => logged.has(`${dateKey}-${prayer}`)
  }, [signature])
}
