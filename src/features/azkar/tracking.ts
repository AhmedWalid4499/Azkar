/**
 * Statistics over the session records. Pure functions over date keys: no React and no
 * clock. The caller says which calendar day is today and which part of the day it is,
 * because the evening session stays open past midnight (see `sessionDateKey`).
 *
 * Vocabulary used throughout:
 * - a session *day* is the date a session is filed under, so evening azkar read at 1 am
 *   count for the evening before;
 * - a session is *open* while it can still be read for its day: the morning session of
 *   today, and the evening session of today, or of yesterday until Fajr. An open session
 *   that is not completed yet is never held against the user;
 * - records dated after a session's open day (a device clock that was wrong) are ignored
 *   by the streaks and rates.
 */
import { daysBetween, isValidDateKey, shiftDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import { sessionDateKey } from './clock'
import type { DayPhase } from './clock'
import { DAILY_COLLECTIONS } from './collections'
import { azkarData, COLLECTION_IDS } from './data'
import type { CollectionId } from './data'
import type { DaySessions, ProgressData } from './progressData'
import { snippet } from './reader/text'

export type SessionHistory = ProgressData['sessions']

export interface DatedSessions {
  dateKey: DateKey
  sessions: DaySessions
}

/** Days from `from` to `to`, both included, that have at least one record; oldest first. */
export function sessionsInRange(sessions: SessionHistory, from: DateKey, to: DateKey): DatedSessions[] {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return []
  return Object.keys(sessions)
    .filter((key) => isValidDateKey(key) && key >= from && key <= to)
    .sort()
    .map((dateKey) => ({ dateKey, sessions: sessions[dateKey] ?? {} }))
}

function isCompleted(sessions: SessionHistory, dateKey: DateKey, collection: CollectionId): boolean {
  return sessions[dateKey]?.[collection]?.completed === true
}

export interface Streak {
  /** Consecutive days up to now. */
  current: number
  /** The longest run ever, `current` included. */
  best: number
}

export interface AzkarStreaks {
  morning: Streak
  evening: Streak
  /** Days on which both the morning and the evening session were completed. */
  both: Streak
}

type DailyCollection = (typeof DAILY_COLLECTIONS)[number]

/**
 * Consecutive days on which every one of `collections` was completed, counted back from the
 * latest open day. A day neither breaks the run nor adds to it while each of its sessions not
 * completed yet is still open; any other incomplete day ends it. So before dawn, yesterday is
 * still undecided only if its morning was completed: its evening alone being open is not enough.
 */
function streakOf(
  sessions: SessionHistory,
  collections: readonly DailyCollection[],
  open: Record<DailyCollection, DateKey>,
  candidates: readonly DateKey[],
): Streak {
  const completedOn = (key: DateKey, collection: DailyCollection) =>
    key <= open[collection] && isCompleted(sessions, key, collection)
  const complete = (key: DateKey) => collections.every((collection) => completedOn(key, collection))
  const undecided = (key: DateKey) =>
    collections.every((collection) => completedOn(key, collection) || key >= open[collection])
  const latest = collections.map((collection) => open[collection]).sort().at(-1)
  if (latest === undefined) return { current: 0, best: 0 }
  return streakFrom(candidates, latest, complete, undecided)
}

/**
 * The run of `complete` days counted back from `latest`, and the longest run among the
 * `candidates` up to it. A day that is `undecided` neither breaks the current run nor adds to
 * it. Some day before `latest` must be neither, or the count back would never end.
 */
export function streakFrom(
  candidates: readonly DateKey[],
  latest: DateKey,
  complete: (key: DateKey) => boolean,
  undecided: (key: DateKey) => boolean,
): Streak {
  let best = 0
  let run = 0
  let previous: DateKey | null = null
  for (const key of candidates.filter((day) => day <= latest && complete(day)).sort()) {
    run = previous !== null && daysBetween(previous, key) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = key
  }

  let current = 0
  for (let key = latest; ; key = shiftDateKey(key, -1)) {
    if (complete(key)) current += 1
    else if (!undecided(key)) break
  }
  return { current, best: Math.max(best, current) }
}

/** The day each daily session is filed under right now. */
function openDays(today: DateKey, phase: DayPhase): Record<DailyCollection, DateKey> {
  return {
    morning: sessionDateKey('morning', today, phase),
    evening: sessionDateKey('evening', today, phase),
  }
}

/** Current and best streaks of the morning session, the evening session, and of both on the same day. */
export function computeAzkarStreaks(sessions: SessionHistory, today: DateKey, phase: DayPhase): AzkarStreaks {
  if (!isValidDateKey(today)) {
    const none = { current: 0, best: 0 }
    return { morning: none, evening: none, both: none }
  }
  const open = openDays(today, phase)
  const keys = Object.keys(sessions).filter(isValidDateKey)
  return {
    morning: streakOf(sessions, ['morning'], open, keys),
    evening: streakOf(sessions, ['evening'], open, keys),
    both: streakOf(sessions, DAILY_COLLECTIONS, open, keys),
  }
}

export interface AzkarRate {
  completed: number
  due: number
  /** `completed / due` between 0 and 1, or `null` when nothing was due in the window. */
  rate: number | null
}

export interface AzkarCompletionRates {
  /** The morning and evening sessions together. */
  all: AzkarRate
  morning: AzkarRate
  evening: AzkarRate
}

function rateOf(completed: number, due: number): AzkarRate {
  return { completed, due, rate: due > 0 ? completed / due : null }
}

/**
 * Share of the morning and evening sessions completed over the last `days` calendar days,
 * today included.
 *
 * - Days before the first day with any morning or evening record are left out, so a new
 *   user is measured from when they started rather than against an empty month.
 * - From that day on, a closed session that was not completed counts as due.
 * - An open session counts only once it is completed: one still to come cannot pull the
 *   rate down. Sessions of days after their open day are not due yet.
 */
export function azkarCompletionRate(
  sessions: SessionHistory,
  today: DateKey,
  phase: DayPhase,
  days: number,
): AzkarCompletionRates {
  const open = isValidDateKey(today) ? openDays(today, phase) : { morning: today, evening: today }
  const tally = { morning: { completed: 0, due: 0 }, evening: { completed: 0, due: 0 } }
  const first = Object.keys(sessions)
    .filter((key) => isValidDateKey(key) && DAILY_COLLECTIONS.some((collection) => sessions[key]?.[collection]))
    .sort()[0]

  if (first !== undefined && days > 0 && isValidDateKey(today)) {
    const windowStart = shiftDateKey(today, -(Math.floor(days) - 1))
    for (let key = first > windowStart ? first : windowStart; key <= today; key = shiftDateKey(key, 1)) {
      for (const collection of DAILY_COLLECTIONS) {
        const counts = tally[collection]
        if (isCompleted(sessions, key, collection)) {
          if (key > open[collection]) continue
          counts.completed += 1
          counts.due += 1
        } else if (key < open[collection]) {
          counts.due += 1
        }
      }
    }
  }

  const { morning, evening } = tally
  return {
    all: rateOf(morning.completed + evening.completed, morning.due + evening.due),
    morning: rateOf(morning.completed, morning.due),
    evening: rateOf(evening.completed, evening.due),
  }
}

/**
 * The bedtime session's streak: consecutive nights on which it was completed. It is filed as
 * the evening is (until Fajr, last night), and kept apart from the daily streaks, since many
 * people read it only some nights.
 */
export function computeSleepStreak(sessions: SessionHistory, today: DateKey, phase: DayPhase): Streak {
  if (!isValidDateKey(today)) return { current: 0, best: 0 }
  const open = sessionDateKey('sleep', today, phase)
  const complete = (key: DateKey) => key <= open && isCompleted(sessions, key, 'sleep')
  return streakFrom(Object.keys(sessions).filter(isValidDateKey), open, complete, (key) => key >= open)
}

/**
 * Share of the nights the bedtime session was completed over the last `days` calendar days,
 * as `azkarCompletionRate` counts the daily sessions, but from the first night it was read.
 */
export function sleepCompletionRate(sessions: SessionHistory, today: DateKey, phase: DayPhase, days: number): AzkarRate {
  const first = Object.keys(sessions)
    .filter((key) => isValidDateKey(key) && sessions[key]?.sleep)
    .sort()[0]
  if (first === undefined || days <= 0 || !isValidDateKey(today)) return rateOf(0, 0)
  const open = sessionDateKey('sleep', today, phase)
  const windowStart = shiftDateKey(today, -(Math.floor(days) - 1))
  let completed = 0
  let due = 0
  for (let key = first > windowStart ? first : windowStart; key <= today; key = shiftDateKey(key, 1)) {
    if (isCompleted(sessions, key, 'sleep')) {
      if (key > open) continue
      completed += 1
      due += 1
    } else if (key < open) {
      due += 1
    }
  }
  return rateOf(completed, due)
}

/** A rate as a whole percentage, rounded down so that 100% means every due session was completed. */
export function ratePercent({ completed, due }: AzkarRate): number | null {
  return due > 0 ? Math.floor((completed * 100) / due) : null
}

export interface DhikrTotal {
  id: string
  /** Lifetime repetitions, every session and day together. */
  recitations: number
  /** The opening words of the dhikr's Arabic text, or `null` if the dataset no longer has it. */
  snippet: string | null
}

export interface AzkarLifetime {
  /** Completed records per session, over every day still kept (about ten years). */
  sessionsCompleted: Record<CollectionId, number>
  /** Every repetition ever counted in the reader, after the prayers too. */
  recitations: number
  /** Most recited first; ties by id. */
  byDhikr: DhikrTotal[]
}

function arabicSnippet(id: string): string | null {
  const dhikr = Object.hasOwn(azkarData.items, id) ? azkarData.items[id] : undefined
  return dhikr ? snippet(dhikr.arabic) : null
}

/** A lifetime tally by dhikr id, most recited first; ties by id. */
export function dhikrTotals(totals: Readonly<Record<string, number>>): DhikrTotal[] {
  return Object.entries(totals)
    .filter(([, recitations]) => recitations > 0)
    .map(([id, recitations]) => ({ id, recitations, snippet: arabicSnippet(id) }))
    .sort((a, b) => b.recitations - a.recitations || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Completed sessions, and every repetition counted in the reader: the after-prayer azkar's
 * too, which `afterPrayerLifetime` also gives on their own. The tasbih counter is apart.
 */
export function lifetimeTotals(data: Pick<ProgressData, 'sessions' | 'totals' | 'totalRecitations'>): AzkarLifetime {
  const sessionsCompleted = Object.fromEntries(COLLECTION_IDS.map((id) => [id, 0])) as Record<CollectionId, number>
  for (const day of Object.values(data.sessions)) {
    for (const collection of COLLECTION_IDS) {
      if (day[collection]?.completed) sessionsCompleted[collection] += 1
    }
  }
  return { sessionsCompleted, recitations: data.totalRecitations, byDhikr: dhikrTotals(data.totals) }
}
