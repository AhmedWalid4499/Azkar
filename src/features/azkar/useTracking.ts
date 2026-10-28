import { useMemo } from 'react'
import type { DateKey } from '../../shared/types'
import { useAzkarClock } from './clock'
import type { DaySessions } from './progressData'
import { useAzkarProgress } from './progressStore'
import {
  azkarCompletionRate,
  computeAzkarStreaks,
  computeSleepStreak,
  lifetimeTotals,
  sessionsInRange,
  sleepCompletionRate,
} from './tracking'
import type { AzkarCompletionRates, AzkarLifetime, AzkarRate, AzkarStreaks, DatedSessions, Streak } from './tracking'

/** Every session recorded for one day, or `undefined` when nothing was read that day. */
export function useDaySessions(dateKey: DateKey): DaySessions | undefined {
  return useAzkarProgress((state) => state.sessions[dateKey])
}

/** Days from `from` to `to`, both included, that have at least one record; oldest first. */
export function useSessionsInRange(from: DateKey, to: DateKey): DatedSessions[] {
  const sessions = useAzkarProgress((state) => state.sessions)
  return useMemo(() => sessionsInRange(sessions, from, to), [sessions, from, to])
}

/** Morning, evening and both-on-one-day streaks as of now, following the clock. */
export function useAzkarStreaks(): AzkarStreaks {
  const sessions = useAzkarProgress((state) => state.sessions)
  const { today, phase } = useAzkarClock()
  return useMemo(() => computeAzkarStreaks(sessions, today, phase), [sessions, today, phase])
}

/** Completion over the last `days` days (7 and 30 on the tracker), as of now. */
export function useAzkarCompletionRate(days: number): AzkarCompletionRates {
  const sessions = useAzkarProgress((state) => state.sessions)
  const { today, phase } = useAzkarClock()
  return useMemo(() => azkarCompletionRate(sessions, today, phase, days), [sessions, today, phase, days])
}

/** The bedtime session's streak as of now, following the night rule. */
export function useSleepStreak(): Streak {
  const sessions = useAzkarProgress((state) => state.sessions)
  const { today, phase } = useAzkarClock()
  return useMemo(() => computeSleepStreak(sessions, today, phase), [sessions, today, phase])
}

/** Completion of the bedtime session over the last `days` days, from the first night it was read. */
export function useSleepCompletionRate(days: number): AzkarRate {
  const sessions = useAzkarProgress((state) => state.sessions)
  const { today, phase } = useAzkarClock()
  return useMemo(() => sleepCompletionRate(sessions, today, phase, days), [sessions, today, phase, days])
}

/** Completed sessions per collection, every repetition counted, and the count of each dhikr. */
export function useAzkarLifetime(): AzkarLifetime {
  const sessions = useAzkarProgress((state) => state.sessions)
  const totals = useAzkarProgress((state) => state.totals)
  const totalRecitations = useAzkarProgress((state) => state.totalRecitations)
  return useMemo(() => lifetimeTotals({ sessions, totals, totalRecitations }), [sessions, totals, totalRecitations])
}
