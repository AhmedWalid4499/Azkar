import { isValidDateKey, shiftDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import { civilDaysOfHijriMonth, hijriOf, RAMADAN } from './hijri'
import { forbiddenDayOf, isMondayOrThursday, isWhiteDay } from './occasions'
import type { FastingDays, FastRecord } from './types'

function recordOn(days: FastingDays, key: DateKey): FastRecord | undefined {
  return Object.prototype.hasOwnProperty.call(days, key) ? days[key] : undefined
}

/** A day of Ramadan that was logged and not fasted to the end: it has to be made up. */
export function isOwedRamadanDay(record: FastRecord | undefined): boolean {
  return record?.kind === 'ramadan' && record.status !== 'fasted'
}

/** A make-up fast that was completed. */
export function isMadeUp(record: FastRecord | undefined): boolean {
  return record?.kind === 'qada' && record.status === 'fasted'
}

export interface OwedDays {
  /** Days of Ramadan, of any year, logged as not fasted: missed, excused or broken. */
  fromRamadan: number
  /** Days owed from before the log began, as the user entered them. */
  before: number
  /** Make-up fasts completed. */
  madeUp: number
  /** What is still to be made up. Never below zero. */
  remaining: number
}

/**
 * Days of Ramadan still to be made up: every logged Ramadan day not fasted,
 * and the days the user owed before they started logging, less every make-up
 * fast completed. Days of Ramadan with nothing logged are not counted: the app
 * cannot know how they went.
 */
export function owedDays(days: FastingDays, owedBefore = 0): OwedDays {
  let fromRamadan = 0
  let madeUp = 0
  for (const [key, record] of Object.entries(days)) {
    if (!isValidDateKey(key)) continue
    if (isOwedRamadanDay(record)) fromRamadan += 1
    if (isMadeUp(record)) madeUp += 1
  }
  const before = Math.max(0, owedBefore)
  return { fromRamadan, before, madeUp, remaining: Math.max(0, fromRamadan + before - madeUp) }
}

export interface RamadanSummary {
  /** The Hijri year of this Ramadan. */
  year: number
  /** Its civil days, as the user's offset places them. Empty if they cannot be worked out. */
  days: DateKey[]
  /** The days of it that have begun: all of them once it is over. */
  elapsed: number
  /** Ramadan fasts of that year completed. */
  fasted: number
  /** Ramadan days of that year logged as not fasted. */
  notFasted: number
  /** Days that have begun with nothing logged. */
  unlogged: number
  /** Today is one of its days. */
  ongoing: boolean
}

/**
 * The Ramadan of the current Hijri year once it has begun, else last year's.
 * Fasts are counted by the Hijri year of their day, so a fast logged on the
 * edge of the month before the user changed their offset still counts.
 */
export function ramadanSummary(days: FastingDays, today: DateKey, offsetDays = 0): RamadanSummary | null {
  const now = hijriOf(today, offsetDays)
  if (!now) return null
  const year = now.month >= RAMADAN ? now.year : now.year - 1
  const civil = civilDaysOfHijriMonth(year, RAMADAN, offsetDays)
  let fasted = 0
  let notFasted = 0
  for (const [key, record] of Object.entries(days)) {
    if (record.kind !== 'ramadan' || hijriOf(key, offsetDays)?.year !== year) continue
    if (record.status === 'fasted') fasted += 1
    else notFasted += 1
  }
  const begun = civil.filter((key) => key <= today)
  const unlogged = begun.filter((key) => recordOn(days, key) === undefined).length
  return { year, days: civil, elapsed: begun.length, fasted, notFasted, unlogged, ongoing: now.month === RAMADAN }
}

export interface VoluntaryCounts {
  /** Voluntary fasts completed in the Hijri month of today. */
  month: number
  /** …and in its Hijri year. */
  year: number
}

export function voluntaryCounts(days: FastingDays, today: DateKey, offsetDays = 0): VoluntaryCounts | null {
  const now = hijriOf(today, offsetDays)
  if (!now) return null
  let month = 0
  let year = 0
  for (const [key, record] of Object.entries(days)) {
    if (record.kind !== 'voluntary' || record.status !== 'fasted') continue
    const hijri = hijriOf(key, offsetDays)
    if (hijri?.year !== now.year) continue
    year += 1
    if (hijri.month === now.month) month += 1
  }
  return { month, year }
}

/**
 * Voluntary fasts completed in the Shawwal that `dateKey` falls in, `dateKey` itself left out.
 * A fast filed on the Eid (the offset changed since, say) is not one of the six.
 */
export function shawwalFastsBefore(days: FastingDays, dateKey: DateKey, offsetDays = 0): number {
  const hijri = hijriOf(dateKey, offsetDays)
  if (!hijri) return 0
  let count = 0
  for (const [key, record] of Object.entries(days)) {
    if (key === dateKey || record.kind !== 'voluntary' || record.status !== 'fasted') continue
    const other = hijriOf(key, offsetDays)
    if (other?.year === hijri.year && other.month === hijri.month && forbiddenDayOf(other) === null) count += 1
  }
  return count
}

export interface FastingStreak {
  current: number
  best: number
}

/** `skip` neither extends nor breaks a run: an excused day, or today while nothing is logged yet. */
type Outcome = 'kept' | 'broken' | 'skip'

function streakOf(outcomes: Outcome[]): FastingStreak {
  let run = 0
  let best = 0
  for (const outcome of outcomes) {
    if (outcome === 'kept') best = Math.max(best, ++run)
    else if (outcome === 'broken') run = 0
  }
  return { current: run, best }
}

/** The first day with a fast logged, up to `today`: streaks are counted from when the user began. */
function firstLoggedDay(days: FastingDays, today: DateKey): DateKey | null {
  let first: DateKey | null = null
  for (const key of Object.keys(days)) {
    if (key <= today && isValidDateKey(key) && (first === null || key < first)) first = key
  }
  return first
}

function outcomeOf(record: FastRecord | undefined, key: DateKey, today: DateKey): Outcome {
  if (record?.status === 'fasted') return 'kept'
  if (record?.status === 'excused') return 'skip'
  if (!record && key === today) return 'skip'
  return 'broken'
}

/**
 * Mondays and Thursdays fasted one after the other, counted in fasts. Days of
 * Ramadan and days fasting is not permitted are left out, an excused day
 * neither breaks nor extends the run, and today counts once it is logged.
 */
export function mondayThursdayStreak(days: FastingDays, today: DateKey, offsetDays = 0): FastingStreak {
  const first = firstLoggedDay(days, today)
  if (first === null) return { current: 0, best: 0 }
  const outcomes: Outcome[] = []
  for (let key = first; key <= today; key = shiftDateKey(key, 1)) {
    if (!isMondayOrThursday(key)) continue
    const hijri = hijriOf(key, offsetDays)
    if (hijri && (hijri.month === RAMADAN || forbiddenDayOf(hijri) !== null)) continue
    outcomes.push(outcomeOf(recordOn(days, key), key, today))
  }
  return streakOf(outcomes)
}

/**
 * Hijri months in a row whose white days (13 to 15) were fasted, counted in
 * months. A month is kept when every white day that has come was fasted or
 * excused and at least one was fasted. Ramadan and the 13th of Dhu al-Hijjah
 * (a day of Tashriq) are left out.
 */
export function whiteDaysStreak(days: FastingDays, today: DateKey, offsetDays = 0): FastingStreak {
  const first = firstLoggedDay(days, today)
  if (first === null) return { current: 0, best: 0 }
  const months: Outcome[] = []
  let monthId: string | null = null
  let month: Outcome = 'skip'
  for (let key = first; key <= today; key = shiftDateKey(key, 1)) {
    const hijri = hijriOf(key, offsetDays)
    if (!isWhiteDay(hijri)) continue
    const id = `${hijri.year}-${hijri.month}`
    if (id !== monthId) {
      if (monthId !== null) months.push(month)
      monthId = id
      month = 'skip'
    }
    const outcome = outcomeOf(recordOn(days, key), key, today)
    if (outcome === 'broken') month = 'broken'
    else if (outcome === 'kept' && month === 'skip') month = 'kept'
  }
  if (monthId !== null) months.push(month)
  return streakOf(months)
}

export interface FastingStatsData {
  owed: OwedDays
  ramadan: RamadanSummary | null
  voluntary: VoluntaryCounts | null
  mondayThursday: FastingStreak
  whiteDays: FastingStreak
}

export function fastingStats(
  days: FastingDays,
  { today, offsetDays = 0, owedBefore = 0 }: { today: DateKey; offsetDays?: number; owedBefore?: number },
): FastingStatsData {
  return {
    owed: owedDays(days, owedBefore),
    ramadan: ramadanSummary(days, today, offsetDays),
    voluntary: voluntaryCounts(days, today, offsetDays),
    mondayThursday: mondayThursdayStreak(days, today, offsetDays),
    whiteDays: whiteDaysStreak(days, today, offsetDays),
  }
}
