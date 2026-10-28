/**
 * Statistics over the ticked sunnah prayers. Pure functions over date keys,
 * like those in `stats.ts`, and with the same vocabulary:
 * - a sunnah prayer is *done* when it is ticked for that day;
 * - one is *excused* when the obligatory prayer it goes with is excused that
 *   day (Duha goes with both Fajr and Dhuhr, the night prayers with Isha). An
 *   excused sunnah prayer is left out of every denominator; if it was ticked
 *   all the same, it counts as done;
 * - entries dated after today are ignored everywhere.
 *
 * Between midnight and Fajr the night prayers still count for the day before
 * (see `NIGHT_SUNNAH`). Pass that day as `today` then, so its Witr is still
 * under way rather than held against the user until it is ticked.
 */
import { daysBetween, isValidDateKey, shiftDateKey } from '../../shared/date'
import type { DateKey, PrayerName } from '../../shared/types'
import type { CompletionRate, DayStanding, Streaks } from './stats'
import { RAWATIB, RAWATIB_RAKAHS, SUNNAH_PRAYERS } from './types'
import type { DayLog, LogEntries, SunnahDay, SunnahEntries, SunnahPrayer } from './types'

const ANCHORS: Record<SunnahPrayer, readonly PrayerName[]> = {
  beforeFajr: ['fajr'],
  duha: ['fajr', 'dhuhr'],
  beforeDhuhr: ['dhuhr'],
  afterDhuhr: ['dhuhr'],
  afterMaghrib: ['maghrib'],
  afterIsha: ['isha'],
  qiyam: ['isha'],
  witr: ['isha'],
}

function isDone(day: SunnahDay | undefined, sunnah: SunnahPrayer): boolean {
  return typeof day?.[sunnah] === 'number'
}

/** Whether a sunnah prayer was not asked of the user that day: an obligatory prayer it goes with was excused. */
export function isSunnahExcused(sunnah: SunnahPrayer, log: DayLog | undefined): boolean {
  return ANCHORS[sunnah].some((prayer) => log?.[prayer] === 'excused')
}

/**
 * How a day counts towards a streak of `prayers`, as in `summarizeDay`:
 * `complete` when each is done or excused and at least one is done, `exempt`
 * when none is done and all are excused, `incomplete` otherwise.
 */
function standingOf(
  day: SunnahDay | undefined,
  log: DayLog | undefined,
  prayers: readonly SunnahPrayer[],
): DayStanding {
  let done = 0
  let excused = 0
  for (const sunnah of prayers) {
    if (isDone(day, sunnah)) done += 1
    else if (isSunnahExcused(sunnah, log)) excused += 1
  }
  if (done === 0 && excused === prayers.length) return 'exempt'
  if (done > 0 && done + excused === prayers.length) return 'complete'
  return 'incomplete'
}

export interface SunnahDaySummary {
  /** Sunnah prayers done, of the eight. */
  done: number
  /** Sunnah prayers open to the user that day: the eight less the excused ones not done. */
  due: number
  /** Rawatib done, of the five. */
  rawatib: number
  /** Rak'ahs of the rawatib done, of twelve. */
  rawatibRakahs: number
  /** `complete` when all twelve rak'ahs of the rawatib are done (or excused). */
  rawatibStanding: DayStanding
  witr: boolean
  witrStanding: DayStanding
}

/** Tallies one day's sunnah prayers. `log` is that day's obligatory log, which says what was excused. */
export function summarizeSunnahDay(day: SunnahDay | undefined, log?: DayLog): SunnahDaySummary {
  let done = 0
  let due = 0
  for (const sunnah of SUNNAH_PRAYERS) {
    if (isDone(day, sunnah)) {
      done += 1
      due += 1
    } else if (!isSunnahExcused(sunnah, log)) {
      due += 1
    }
  }
  let rawatib = 0
  let rawatibRakahs = 0
  for (const sunnah of RAWATIB) {
    if (!isDone(day, sunnah)) continue
    rawatib += 1
    rawatibRakahs += RAWATIB_RAKAHS[sunnah]
  }
  return {
    done,
    due,
    rawatib,
    rawatibRakahs,
    rawatibStanding: standingOf(day, log, RAWATIB),
    witr: isDone(day, 'witr'),
    witrStanding: standingOf(day, log, ['witr']),
  }
}

/** The earliest day with a sunnah prayer ticked, ignoring the future. `null` when none ever was. */
export function firstSunnahDay(sunnah: SunnahEntries, today: DateKey): DateKey | null {
  let first: DateKey | null = null
  for (const key of Object.keys(sunnah)) {
    if (!isValidDateKey(key) || key > today || (first !== null && key >= first)) continue
    if (SUNNAH_PRAYERS.some((prayer) => isDone(sunnah[key], prayer))) first = key
  }
  return first
}

export interface SunnahCompletion extends CompletionRate {
  /** In `CompletionRate`'s terms: `prayed` is the sunnah prayers done, `due` those open to the user. */
  byPrayer: Record<SunnahPrayer, number>
  /** Days measured: the window, starting at the first day anything was ticked when that is later. */
  days: number
}

/**
 * Share of the sunnah prayers done over the last `days` days, today included,
 * and on how many of those days each one was done.
 *
 * - Days before the first day anything was ticked are left out, so a new
 *   user is measured from when they started.
 * - Today is still under way: only what is already done counts, so it can
 *   raise the rate but never lower it.
 * - Excused sunnah prayers are left out of what was open.
 */
export function sunnahCompletion(
  sunnah: SunnahEntries,
  entries: LogEntries,
  today: DateKey,
  days: number,
): SunnahCompletion {
  const byPrayer = Object.fromEntries(SUNNAH_PRAYERS.map((prayer) => [prayer, 0])) as Record<SunnahPrayer, number>
  let prayed = 0
  let due = 0
  let measured = 0
  const first = firstSunnahDay(sunnah, today)
  if (first !== null) {
    const windowStart = shiftDateKey(today, -(days - 1))
    for (let key = first > windowStart ? first : windowStart; key <= today; key = shiftDateKey(key, 1)) {
      const day = sunnah[key]
      const summary = summarizeSunnahDay(day, entries[key])
      prayed += summary.done
      due += key === today ? summary.done : summary.due
      measured += 1
      for (const prayer of SUNNAH_PRAYERS) if (isDone(day, prayer)) byPrayer[prayer] += 1
    }
  }
  return { prayed, due, rate: due > 0 ? prayed / due : null, byPrayer, days: measured }
}

/**
 * Streaks of days on which every one of `prayers` was done, counted like
 * `computeStreaks`: a day on which they were all excused carries the run
 * without adding to it, a day with one left undone ends it, and an unfinished
 * today is never held against the user.
 */
export function sunnahStreaks(
  sunnah: SunnahEntries,
  entries: LogEntries,
  today: DateKey,
  prayers: readonly SunnahPrayer[],
): Streaks {
  const first = firstSunnahDay(sunnah, today)
  if (first === null || prayers.length === 0) return { current: 0, best: 0 }
  // Only the days with something stored, as in `computeStreaks`: a backup can hold a day centuries back.
  const days = new Set<DateKey>([today])
  for (const key of [...Object.keys(sunnah), ...Object.keys(entries)]) {
    if (isValidDateKey(key) && key >= first && key <= today) days.add(key)
  }
  let run = 0
  let best = 0
  let previous: DateKey | null = null
  for (const key of [...days].sort()) {
    // Between these two lies at least one past day with nothing done and nothing excused.
    if (previous !== null && daysBetween(previous, key) > 1) run = 0
    previous = key
    const standing = standingOf(sunnah[key], entries[key], prayers)
    if (standing === 'complete') {
      run += 1
      best = Math.max(best, run)
    } else if (standing === 'incomplete' && key !== today) {
      run = 0
    }
  }
  return { current: run, best }
}

/** Days in a row with Witr prayed. */
export function witrStreaks(sunnah: SunnahEntries, entries: LogEntries, today: DateKey): Streaks {
  return sunnahStreaks(sunnah, entries, today, ['witr'])
}

/** Days in a row with all twelve rak'ahs of the rawatib prayed. */
export function rawatibStreaks(sunnah: SunnahEntries, entries: LogEntries, today: DateKey): Streaks {
  return sunnahStreaks(sunnah, entries, today, RAWATIB)
}
