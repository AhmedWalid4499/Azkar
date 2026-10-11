/**
 * Statistics over the prayer log. Pure functions over date keys: no React, no
 * clock, no time zones. The caller passes in which calendar day is "today".
 *
 * Vocabulary used throughout:
 * - a prayer is *prayed* when its status is `ontime`, `jamaah` or `late`
 *   (a prayer made up later still counts as prayed);
 * - an *excused* prayer was not required, so it is left out of every
 *   denominator and can never lower a number;
 * - entries dated after today are ignored everywhere.
 */
import { daysBetween, isValidDateKey, makeDateKey, shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import { daysInMonth } from './calendar'
import type { MonthRef } from './calendar'
import { isPrayerStatus, PRAYER_STATUSES } from './types'
import type { DayLog, LogEntries, PrayerStatus } from './types'

export type StatusCounts = Record<PrayerStatus, number>

/**
 * How a day counts towards a streak.
 * - `complete`: all five prayers are accounted for, each one either prayed or
 *   excused, and at least one was prayed;
 * - `exempt`: all five are excused, so the day is skipped over;
 * - `incomplete`: anything else: a prayer missed, or one not logged.
 */
export type DayStanding = 'complete' | 'exempt' | 'incomplete'

export interface DaySummary {
  counts: StatusCounts
  /** Prayers with any status at all. */
  logged: number
  /** Prayers logged as on time, in congregation or made up late. */
  prayed: number
  /** Prayers that were required of the user: five minus the excused ones. */
  due: number
  standing: DayStanding
}

function emptyCounts(): StatusCounts {
  return { ontime: 0, jamaah: 0, late: 0, missed: 0, excused: 0 }
}

/** Tallies one day. An absent day is five unlogged prayers. */
export function summarizeDay(day: DayLog | undefined): DaySummary {
  const counts = emptyCounts()
  let logged = 0
  for (const prayer of PRAYERS) {
    const status = day?.[prayer]
    if (!isPrayerStatus(status)) continue
    counts[status] += 1
    logged += 1
  }
  const prayed = counts.ontime + counts.jamaah + counts.late
  const total = PRAYERS.length
  let standing: DayStanding = 'incomplete'
  if (counts.excused === total) standing = 'exempt'
  else if (prayed + counts.excused === total) standing = 'complete'
  return { counts, logged, prayed, due: total - counts.excused, standing }
}

/** Logged days up to and including today, oldest first. */
function pastKeys(entries: LogEntries, today: DateKey): DateKey[] {
  return Object.keys(entries)
    .filter((key) => isValidDateKey(key) && key <= today && summarizeDay(entries[key]).logged > 0)
    .sort()
}

/** The earliest day with anything logged, ignoring the future. `null` for a new user. */
export function firstLoggedDay(entries: LogEntries, today: DateKey): DateKey | null {
  return pastKeys(entries, today)[0] ?? null
}

export interface Streaks {
  current: number
  best: number
}

/**
 * Streaks, counted in days.
 *
 * - A `complete` day extends the run by one.
 * - An `exempt` day (all five excused) neither breaks the run nor extends it;
 *   a run carries straight across any number of them.
 * - An `incomplete` day, and any day with nothing logged, ends the run.
 * - Today is never held against the user: while it is incomplete, or not
 *   logged at all, the run simply stands at yesterday's count. Once today is
 *   complete it adds one.
 * - Entries dated after today are ignored.
 *
 * `current` is the run that reaches today; `best` is the longest run ever.
 */
export function computeStreaks(entries: LogEntries, today: DateKey): Streaks {
  let run = 0
  let best = 0
  let previous: DateKey | null = null

  for (const key of pastKeys(entries, today)) {
    // At least one day with nothing logged lies between these two entries.
    if (previous !== null && daysBetween(previous, key) > 1) run = 0

    const { standing } = summarizeDay(entries[key])
    if (standing === 'complete') {
      run += 1
      best = Math.max(best, run)
    } else if (standing === 'incomplete' && key !== today) {
      run = 0
    }
    previous = key
  }

  // The run only reaches the present if no day before today was left unlogged.
  const reachesToday = previous !== null && daysBetween(previous, today) <= 1
  return { current: reachesToday ? run : 0, best }
}

export interface CompletionRate {
  prayed: number
  due: number
  /** `prayed / due` between 0 and 1, or `null` when nothing was due in the window. */
  rate: number | null
}

/**
 * Share of required prayers that were prayed over the last `days` days, today
 * included.
 *
 * - Excused prayers are not required, so they are left out of the denominator.
 * - Days before the user's first logged day are left out too: a new user is
 *   measured from when they started, not against an empty week.
 * - From the first logged day on, a past day's unlogged prayers do count as
 *   due, exactly like missed ones.
 * - Today is still under way, so only what has been logged so far today is
 *   counted; prayers whose time has not come cannot pull the rate down.
 */
export function completionRate(entries: LogEntries, today: DateKey, days: number): CompletionRate {
  const first = firstLoggedDay(entries, today)
  let prayed = 0
  let due = 0
  if (first !== null) {
    const windowStart = shiftDateKey(today, -(days - 1))
    for (let key = first > windowStart ? first : windowStart; key <= today; key = shiftDateKey(key, 1)) {
      const summary = summarizeDay(entries[key])
      prayed += summary.prayed
      due += key === today ? summary.logged - summary.counts.excused : summary.due
    }
  }
  return { prayed, due, rate: due > 0 ? prayed / due : null }
}

/**
 * A completion rate as a whole percentage, rounded down so that "100%" is only
 * ever shown when every due prayer was prayed.
 */
export function wholePercent({ prayed, due }: CompletionRate): number | null {
  return due > 0 ? Math.floor((prayed * 100) / due) : null
}

export interface MonthBreakdown {
  /** Days of the month that have begun, today included; zero for a future month. */
  elapsedDays: number
  /** Total logged prayers in the month. */
  logged: number
  byStatus: StatusCounts
  byPrayer: Record<PrayerName, StatusCounts>
}

/**
 * Counts for one Gregorian month, per prayer and per status. Days after today
 * are skipped, so for the current month `elapsedDays` stops at today; a prayer
 * has `elapsedDays` minus its logged total still unlogged.
 */
export function monthBreakdown(entries: LogEntries, month: MonthRef, today: DateKey): MonthBreakdown {
  const byStatus = emptyCounts()
  const byPrayer = Object.fromEntries(PRAYERS.map((prayer) => [prayer, emptyCounts()])) as Record<
    PrayerName,
    StatusCounts
  >
  let elapsedDays = 0
  let logged = 0

  const total = daysInMonth(month)
  for (let day = 1; day <= total; day++) {
    const key = makeDateKey(month.year, month.month, day)
    if (key > today) break
    elapsedDays += 1
    const log = entries[key]
    if (!log) continue
    for (const prayer of PRAYERS) {
      const status = log[prayer]
      if (!isPrayerStatus(status)) continue
      byPrayer[prayer][status] += 1
      byStatus[status] += 1
      logged += 1
    }
  }
  return { elapsedDays, logged, byStatus, byPrayer }
}

/** Sum of every status in a tally. */
export function totalOf(counts: StatusCounts): number {
  return PRAYER_STATUSES.reduce((sum, status) => sum + counts[status], 0)
}
