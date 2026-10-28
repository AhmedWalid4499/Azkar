import { useMemo } from 'react'
import { useSettings } from '../../shared/settings'
import type { DateKey } from '../../shared/types'
import { fastingDayInfo, SHAWWAL_FASTS } from './occasions'
import type { FastingDayInfo, FastingReason } from './occasions'
import { owedDays, shawwalFastsBefore } from './stats'
import type { OwedDays } from './stats'
import { useFast, useFasting } from './store'
import type { FastRecord } from './types'

/** The user's Hijri offset from the shared settings. */
export function useHijriOffset(): number {
  return useSettings((state) => state.hijriOffset)
}

/** What the calendar says about fasting on a day, with the user's Hijri offset. */
export function useFastingDayInfo(dateKey: DateKey): FastingDayInfo {
  const offsetDays = useHijriOffset()
  return useMemo(() => fastingDayInfo(dateKey, offsetDays), [dateKey, offsetDays])
}

export interface FastingDay extends FastingDayInfo {
  offsetDays: number
  record: FastRecord | undefined
  /** Voluntary fasts made this Shawwal, the day itself included once it is fasted; 0 outside Shawwal. */
  shawwalDone: number
  /** The reasons worth suggesting: the six days of Shawwal drop out once six are fasted. */
  suggested: FastingReason[]
}

/** Everything a card or panel needs to know about fasting on one day. */
export function useFastingDay(dateKey: DateKey): FastingDay {
  const offsetDays = useHijriOffset()
  const info = useFastingDayInfo(dateKey)
  const record = useFast(dateKey)
  const inShawwal = info.reasons.includes('shawwal')
  const shawwalBefore = useFasting((state) => (inShawwal ? shawwalFastsBefore(state.days, dateKey, offsetDays) : 0))
  const fastedToday = inShawwal && record?.kind === 'voluntary' && record.status === 'fasted'
  // Only the other days decide: logging the sixth must not make the card it was logged on disappear.
  const suggested = useMemo(
    () => info.reasons.filter((reason) => reason !== 'shawwal' || shawwalBefore < SHAWWAL_FASTS),
    [info.reasons, shawwalBefore],
  )
  return { ...info, offsetDays, record, shawwalDone: shawwalBefore + (fastedToday ? 1 : 0), suggested }
}

/** Days of Ramadan still to be made up, with how the figure is made. */
export function useOwedDays(): OwedDays {
  const days = useFasting((state) => state.days)
  const owedBefore = useFasting((state) => state.owedBefore)
  return useMemo(() => owedDays(days, owedBefore), [days, owedBefore])
}
