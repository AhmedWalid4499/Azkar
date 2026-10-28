/**
 * Figures the tracker page adds to those in `stats.ts`, `sunnahStats.ts` and the
 * azkar feature's tracking. Pure functions over date keys, with the same rules:
 * no clock, the caller says which day is today, and days after today are ignored.
 */
import { isValidDateKey, shiftDateKey, weekdayOfDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import { DAILY_COLLECTIONS } from '../azkar'
import type { DayPhase, SessionHistory } from '../azkar'
import { firstLoggedDay, summarizeDay } from './stats'
import { firstSunnahDay } from './sunnahStats'
import { SUNNAH_PRAYERS } from './types'
import type { LoggedAtEntries, LogEntries, SunnahDay, SunnahEntries } from './types'

function ticked(day: SunnahDay | undefined): number {
  return SUNNAH_PRAYERS.filter((sunnah) => typeof day?.[sunnah] === 'number').length
}

function completedDaily(sessions: SessionHistory, dateKey: DateKey): number {
  return DAILY_COLLECTIONS.filter((collection) => sessions[dateKey]?.[collection]?.completed === true).length
}

/**
 * The day the streaks and rates are counted up to. Between midnight and Fajr the
 * night still belongs to the day before: its Isha and Witr are still under way, so
 * that day is measured as "today" until Fajr, and is not held against the user.
 */
export function statsDayOf(today: DateKey, phase: DayPhase): DateKey {
  return phase === 'beforeDawn' ? shiftDateKey(today, -1) : today
}

/** Whether anything at all has been recorded up to today: a prayer, a sunnah prayer or an azkar session. */
export function hasAnyRecord(
  entries: LogEntries,
  sunnah: SunnahEntries,
  sessions: SessionHistory,
  today: DateKey,
): boolean {
  if (firstLoggedDay(entries, today) !== null || firstSunnahDay(sunnah, today) !== null) return true
  return Object.keys(sessions).some(
    (key) => isValidDateKey(key) && key <= today && Object.keys(sessions[key] ?? {}).length > 0,
  )
}

export interface LifetimePrayers {
  /** Obligatory prayers with any status. */
  logged: number
  /** Obligatory prayers logged as on time, in congregation or made up late. */
  prayed: number
  /** Sunnah prayers ticked off. */
  sunnah: number
}

/** Every prayer ever logged up to today. */
export function lifetimePrayers(entries: LogEntries, sunnah: SunnahEntries, today: DateKey): LifetimePrayers {
  let logged = 0
  let prayed = 0
  let sunnahDone = 0
  for (const key of Object.keys(entries)) {
    if (!isValidDateKey(key) || key > today) continue
    const summary = summarizeDay(entries[key])
    logged += summary.logged
    prayed += summary.prayed
  }
  for (const key of Object.keys(sunnah)) {
    if (isValidDateKey(key) && key <= today) sunnahDone += ticked(sunnah[key])
  }
  return { logged, prayed, sunnah: sunnahDone }
}

export interface WeekTotals {
  /** The week's first day. */
  start: DateKey
  /** Its days that have begun: 7, or fewer for the week under way. */
  days: number
  /** The week today falls in. */
  current: boolean
  /** Obligatory prayers prayed: on time, in congregation or made up late. */
  prayed: number
  /** Sunnah prayers ticked off. */
  sunnah: number
  /** Morning and evening sessions completed. */
  azkar: number
}

export interface TrackerData {
  entries: LogEntries
  sunnah: SunnahEntries
  sessions: SessionHistory
}

/** The most a day can hold of each weekly figure. */
export const DAILY_MAXIMUM = { prayed: 5, sunnah: SUNNAH_PRAYERS.length, azkar: DAILY_COLLECTIONS.length } as const

/**
 * Totals for the last `weeks` weeks, oldest first, the last being the week under way.
 * Weeks begin on `weekStart` (0 = Sunday … 6 = Saturday), as the calendar's do.
 */
export function weeklyTotals(data: TrackerData, today: DateKey, weekStart: number, weeks: number): WeekTotals[] {
  if (!isValidDateKey(today)) return []
  const currentStart = shiftDateKey(today, -((weekdayOfDateKey(today) - weekStart + 7) % 7))
  const result: WeekTotals[] = []
  for (let back = weeks - 1; back >= 0; back--) {
    const start = shiftDateKey(currentStart, -7 * back)
    const week: WeekTotals = { start, days: 0, current: back === 0, prayed: 0, sunnah: 0, azkar: 0 }
    for (let offset = 0; offset < 7; offset++) {
      const key = shiftDateKey(start, offset)
      if (key > today) break
      week.days += 1
      week.prayed += summarizeDay(data.entries[key]).prayed
      week.sunnah += ticked(data.sunnah[key])
      week.azkar += completedDaily(data.sessions, key)
    }
    result.push(week)
  }
  return result
}

export interface HistoryData extends TrackerData {
  loggedAt: LoggedAtEntries
}

/** Every day with anything stored, oldest first. Days after today are kept: an export leaves nothing out. */
export function recordedDays(data: HistoryData): DateKey[] {
  const days = new Set<DateKey>()
  for (const map of [data.entries, data.loggedAt, data.sunnah, data.sessions]) {
    for (const key of Object.keys(map)) if (isValidDateKey(key)) days.add(key)
  }
  return [...days].sort()
}
