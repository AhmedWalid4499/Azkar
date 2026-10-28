import { useMemo } from 'react'
import type { DateKey } from '../../shared/types'
import { useAzkarClock } from './clock'
import type { DaySessions } from './progressData'
import { useAzkarProgress } from './progressStore'
import { azkarCompletionRate, computeAzkarStreaks, lifetimeTotals, sessionsInRange } from './tracking'
import type { AzkarCompletionRates, AzkarLifetime, AzkarStreaks, DatedSessions } from './tracking'

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

/** Completed sessions per collection, every repetition counted, and the count of each dhikr. */
export function useAzkarLifetime(): AzkarLifetime {
  const sessions = useAzkarProgress((state) => state.sessions)
  const totals = useAzkarProgress((state) => state.totals)
  const totalRecitations = useAzkarProgress((state) => state.totalRecitations)
  return useMemo(() => lifetimeTotals({ sessions, totals, totalRecitations }), [sessions, totals, totalRecitations])
}
