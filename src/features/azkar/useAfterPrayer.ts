import { useMemo } from 'react'
import type { DateKey, PrayerName } from '../../shared/types'
import { afterPrayerDateKey } from './afterPrayer'
import type { AfterPrayerDay } from './afterPrayerData'
import {
  afterPrayerCompletionRate,
  afterPrayerInRange,
  afterPrayerLifetime,
  computeAfterPrayerStreaks,
} from './afterPrayerTracking'
import type { AfterPrayerLifetime, AfterPrayerRates, AfterPrayerStreaks, DatedAfterPrayer } from './afterPrayerTracking'
import { useAzkarClock } from './clock'
import { useAzkarProgress } from './progressStore'
import { afterPrayerReading, useReading, useReadingRecord } from './readings'
import { standingOf } from './useSessionStanding'
import type { SessionStanding } from './useSessionStanding'

/** The day after-prayer azkar read now are filed under: today, or yesterday until Fajr. */
export function useAfterPrayerDateKey(): DateKey {
  const { today, phase } = useAzkarClock()
  return afterPrayerDateKey(today, phase)
}

/** One day's after-prayer records, or `undefined` when nothing was read after a prayer that day. */
export function useAfterPrayerSessions(dateKey: DateKey): AfterPrayerDay | undefined {
  return useAzkarProgress((state) => state.afterPrayer.sessions[dateKey])
}

/** Days from `from` to `to`, both included, with at least one after-prayer record; oldest first. */
export function useAfterPrayerInRange(from: DateKey, to: DateKey): DatedAfterPrayer[] {
  const history = useAzkarProgress((state) => state.afterPrayer.sessions)
  return useMemo(() => afterPrayerInRange(history, from, to), [history, from, to])
}

/** Streaks of completing the after-prayer azkar, after every prayer and after each, as of now. */
export function useAfterPrayerStreaks(): AfterPrayerStreaks {
  const history = useAzkarProgress((state) => state.afterPrayer.sessions)
  const { today, phase } = useAzkarClock()
  return useMemo(() => computeAfterPrayerStreaks(history, today, phase), [history, today, phase])
}

/** Completion of the after-prayer azkar over the last `days` days (7 and 30 on the tracker), as of now. */
export function useAfterPrayerCompletionRate(days: number): AfterPrayerRates {
  const history = useAzkarProgress((state) => state.afterPrayer.sessions)
  const { today, phase } = useAzkarClock()
  return useMemo(() => afterPrayerCompletionRate(history, today, phase, days), [history, today, phase, days])
}

/** Completed after-prayer readings per prayer, every repetition after the prayers, and each dhikr's count. */
export function useAfterPrayerLifetime(): AfterPrayerLifetime {
  const sessions = useAzkarProgress((state) => state.afterPrayer.sessions)
  const totals = useAzkarProgress((state) => state.afterPrayer.totals)
  return useMemo(() => afterPrayerLifetime({ sessions, totals }), [sessions, totals])
}

/** Where the azkar after one prayer stand for a day, as the picker and the prompt show it. */
export function useAfterPrayerStanding(prayer: PrayerName, dateKey: DateKey): SessionStanding {
  const reading = afterPrayerReading(prayer)
  const { summary } = useReading(reading, dateKey)
  const record = useReadingRecord(reading, dateKey)
  return useMemo(() => standingOf(summary, record), [summary, record])
}
