/**
 * Statistics over the after-prayer records, in the vocabulary of tracking.ts. The azkar after a
 * prayer are filed under the prayer's day, and that day stays *open* while it is today, or
 * yesterday until Fajr (see `afterPrayerDateKey`): a prayer of the open day not read after yet
 * is never held against the user. Records dated after it (a wrong device clock) are ignored.
 *
 * Which prayers count is the caller's to say, by default those the dataset has azkar for: a
 * prayer without any is never due.
 */
import { isValidDateKey, shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import { afterPrayerDateKey, availableAfterPrayers } from './afterPrayer'
import type { AfterPrayerDay, AfterPrayerProgress } from './afterPrayerData'
import type { DayPhase } from './clock'
import { dhikrTotals, streakFrom } from './tracking'
import type { AzkarRate, DhikrTotal, Streak } from './tracking'

export type AfterPrayerHistory = AfterPrayerProgress['sessions']

export interface DatedAfterPrayer {
  dateKey: DateKey
  prayers: AfterPrayerDay
}

/** Days from `from` to `to`, both included, with at least one after-prayer record; oldest first. */
export function afterPrayerInRange(history: AfterPrayerHistory, from: DateKey, to: DateKey): DatedAfterPrayer[] {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return []
  return Object.keys(history)
    .filter((key) => isValidDateKey(key) && key >= from && key <= to)
    .sort()
    .map((dateKey) => ({ dateKey, prayers: history[dateKey] ?? {} }))
}

function isCompleted(history: AfterPrayerHistory, dateKey: DateKey, prayer: PrayerName): boolean {
  return history[dateKey]?.[prayer]?.completed === true
}

const NO_STREAK: Streak = { current: 0, best: 0 }

export interface AfterPrayerStreaks {
  /** Days on which the azkar after every prayer were completed. */
  all: Streak
  /** Days on which the azkar after that prayer were completed. */
  byPrayer: Record<PrayerName, Streak>
}

function streakOver(history: AfterPrayerHistory, prayers: readonly PrayerName[], open: DateKey): Streak {
  if (prayers.length === 0) return NO_STREAK
  const complete = (key: DateKey) => key <= open && prayers.every((prayer) => isCompleted(history, key, prayer))
  return streakFrom(Object.keys(history).filter(isValidDateKey), open, complete, (key) => key >= open)
}

export function computeAfterPrayerStreaks(
  history: AfterPrayerHistory,
  today: DateKey,
  phase: DayPhase,
  prayers: readonly PrayerName[] = availableAfterPrayers(),
): AfterPrayerStreaks {
  const counted = PRAYERS.filter((prayer) => prayers.includes(prayer))
  const byPrayer = Object.fromEntries(PRAYERS.map((prayer) => [prayer, NO_STREAK])) as Record<PrayerName, Streak>
  if (!isValidDateKey(today)) return { all: NO_STREAK, byPrayer }
  const open = afterPrayerDateKey(today, phase)
  for (const prayer of counted) byPrayer[prayer] = streakOver(history, [prayer], open)
  return { all: streakOver(history, counted, open), byPrayer }
}

export interface AfterPrayerRates {
  /** Every prayer together. */
  all: AzkarRate
  byPrayer: Record<PrayerName, AzkarRate>
}

function rateOf(completed: number, due: number): AzkarRate {
  return { completed, due, rate: due > 0 ? completed / due : null }
}

/**
 * Share of the prayers whose after-prayer azkar were completed over the last `days` calendar
 * days, today included. As for the sessions (see `azkarCompletionRate`): days before the first
 * after-prayer record are left out; from then on every prayer of a closed day is due; one of the
 * open day counts only once completed.
 */
export function afterPrayerCompletionRate(
  history: AfterPrayerHistory,
  today: DateKey,
  phase: DayPhase,
  days: number,
  prayers: readonly PrayerName[] = availableAfterPrayers(),
): AfterPrayerRates {
  const counted = PRAYERS.filter((prayer) => prayers.includes(prayer))
  const tally = Object.fromEntries(PRAYERS.map((prayer) => [prayer, { completed: 0, due: 0 }])) as Record<
    PrayerName,
    { completed: number; due: number }
  >
  const first = Object.keys(history)
    .filter((key) => isValidDateKey(key) && Object.keys(history[key] ?? {}).length > 0)
    .sort()[0]

  if (first !== undefined && days > 0 && isValidDateKey(today)) {
    const open = afterPrayerDateKey(today, phase)
    const windowStart = shiftDateKey(today, -(Math.floor(days) - 1))
    for (let key = first > windowStart ? first : windowStart; key <= today; key = shiftDateKey(key, 1)) {
      for (const prayer of counted) {
        const counts = tally[prayer]
        if (isCompleted(history, key, prayer)) {
          if (key > open) continue
          counts.completed += 1
          counts.due += 1
        } else if (key < open) {
          counts.due += 1
        }
      }
    }
  }

  const byPrayer = Object.fromEntries(
    PRAYERS.map((prayer) => [prayer, rateOf(tally[prayer].completed, tally[prayer].due)]),
  ) as Record<PrayerName, AzkarRate>
  const completed = counted.reduce((sum, prayer) => sum + tally[prayer].completed, 0)
  const due = counted.reduce((sum, prayer) => sum + tally[prayer].due, 0)
  return { all: rateOf(completed, due), byPrayer }
}

export interface AfterPrayerLifetime {
  /** Completed records per prayer, over every day still kept (about ten years). */
  completed: Record<PrayerName, number>
  /** Completed records of every prayer together. */
  completedAll: number
  /** Every repetition counted after the prayers. */
  recitations: number
  /** Most recited first; ties by id. */
  byDhikr: DhikrTotal[]
}

export function afterPrayerLifetime(data: Pick<AfterPrayerProgress, 'sessions' | 'totals'>): AfterPrayerLifetime {
  const completed = Object.fromEntries(PRAYERS.map((prayer) => [prayer, 0])) as Record<PrayerName, number>
  for (const day of Object.values(data.sessions)) {
    for (const prayer of PRAYERS) {
      if (day[prayer]?.completed) completed[prayer] += 1
    }
  }
  const byDhikr = dhikrTotals(data.totals)
  return {
    completed,
    completedAll: PRAYERS.reduce((sum, prayer) => sum + completed[prayer], 0),
    recitations: byDhikr.reduce((sum, row) => sum + row.recitations, 0),
    byDhikr,
  }
}
