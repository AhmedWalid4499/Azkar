import { useMemo } from 'react'
import { formatClock, shiftDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { useTodayKey } from '../../shared/time'
import type { DateKey, PrayerDay } from '../../shared/types'
import { useLogRange } from '../prayer-log'
import { usePrayerDay } from '../prayer-times'
import { buildWidgetSnapshot, DAYS_AFTER, DAYS_BEFORE } from './snapshot'

/**
 * Yesterday, today and the seven days after (DAYS_BEFORE and DAYS_AFTER), as
 * one list that keeps its identity while none of them changes.
 */
function usePublishedDays(today: DateKey): Array<PrayerDay | null> {
  // One call per day, the same ones in the same order on every render. Each day
  // keeps its identity until its times change, so the list can be memoised on them.
  const yesterday = usePrayerDay(shiftDateKey(today, -1))
  const day0 = usePrayerDay(today)
  const day1 = usePrayerDay(shiftDateKey(today, 1))
  const day2 = usePrayerDay(shiftDateKey(today, 2))
  const day3 = usePrayerDay(shiftDateKey(today, 3))
  const day4 = usePrayerDay(shiftDateKey(today, 4))
  const day5 = usePrayerDay(shiftDateKey(today, 5))
  const day6 = usePrayerDay(shiftDateKey(today, 6))
  const day7 = usePrayerDay(shiftDateKey(today, 7))
  return useMemo(
    () => [yesterday, day0, day1, day2, day3, day4, day5, day6, day7],
    [yesterday, day0, day1, day2, day3, day4, day5, day6, day7],
  )
}

/**
 * The snapshot the widgets should show now, as JSON. The text stays the same
 * until something it contains changes (the times, the log, the language, the
 * digits, the clock format or the name), so it can be compared to decide
 * whether to publish.
 */
export function useWidgetSnapshot(): string {
  const i18n = useI18n()
  const arabicDigits = useSettings((state) => state.arabicDigits)
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  const name = useSettings((state) => state.name)
  const today = useTodayKey()
  const days = usePublishedDays(today)
  const { entries } = useLogRange(shiftDateKey(today, -DAYS_BEFORE), shiftDateKey(today, DAYS_AFTER))

  return useMemo(
    () =>
      JSON.stringify(
        buildWidgetSnapshot({
          days,
          log: entries,
          i18n,
          arabicDigits,
          name,
          formatTime: (date, timeZone) => formatClock(date, i18n.locale, timeZone, hour12),
        }),
      ),
    [days, entries, i18n, arabicDigits, hour12, name],
  )
}
