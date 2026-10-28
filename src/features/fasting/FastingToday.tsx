import { useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { FastingCard } from './FastingCard'
import { useFastingDayInfo } from './hooks'
import { RamadanCard } from './RamadanCard'

export interface FastingTodayProps {
  /** Today's calendar day at the saved location; read from the clock when omitted. */
  today?: DateKey
}

/** The fasting card that fits today: Ramadan mode in Ramadan, else the recommended-fast card, or nothing. */
export function FastingToday({ today: given }: FastingTodayProps) {
  const clockToday = useTodayKey()
  const today = given ?? clockToday
  const { ramadanDay } = useFastingDayInfo(today)
  return ramadanDay !== null ? <RamadanCard today={today} /> : <FastingCard today={today} />
}
