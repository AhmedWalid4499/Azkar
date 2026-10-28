import { dateKeyInZone, partsOfDateKey, shiftDateKey } from '../../../shared/date'
import { isolate } from '../../../shared/i18n'
import type { I18n } from '../../../shared/i18n'
import { PRAYERS } from '../../../shared/types'
import type { DateKey, PrayerDay, PrayerName } from '../../../shared/types'
import type { AzkarSession, MorningReminderTime } from '../config'
import { isValidTime } from '../engine/compute'
import { describeDuration } from '../format'
import { unloggedEntries } from './unlogged'
import type { UnloggedChoices, UnloggedEntry } from './unlogged'

/** Notification groups, so each kind can be replaced without touching the others or other features' notifications. */
export const PRAYER_GROUP = 'prayer-times'
export const AZKAR_GROUP = 'azkar-reminders'
export const UNLOGGED_GROUP = 'prayer-unlogged'

/** How far ahead the installed app schedules: renewed each time it opens. */
export const WINDOW_DAYS = 7
/**
 * iOS keeps the 64 soonest pending notifications of an app and drops the rest.
 * Prayer, "not logged yet" and azkar reminders together never take more than
 * this, which leaves room for other features. A week of everything is about
 * 84, so with everything switched on the soonest 50 reach about four days ahead.
 */
export const REMINDER_LIMIT = 50

const DAY_MS = 86_400_000

export interface ReminderChoices {
  prayers: boolean
  morning: boolean
  evening: boolean
  morningAt: MorningReminderTime
  /** The "not logged yet" reminders; none when absent. */
  unlogged?: UnloggedChoices
}

export type ReminderEntry =
  | { kind: 'prayer'; prayer: PrayerName; dateKey: DateKey; at: Date; key: string }
  | { kind: 'azkar'; session: AzkarSession; after: 'fajr' | 'sunrise' | 'asr'; dateKey: DateKey; at: Date; key: string }
  | UnloggedEntry

/** At the same instant: prayers first, then "not logged yet", then azkar. */
const RANK: Record<ReminderEntry['kind'], number> = { prayer: 0, unlogged: 1, azkar: 2 }

/** Soonest first, and at the same instant by kind, so the limit keeps the soonest and, among equals, the most important. */
export function compareReminders(a: ReminderEntry, b: ReminderEntry): number {
  return a.at.getTime() - b.at.getTime() || RANK[a.kind] - RANK[b.kind]
}

/**
 * Every reminder the choices ask for on `days`, in the order of
 * `compareReminders`. A time that does not exist that day (polar day or night)
 * is left out. Isha's "not logged yet" reminder needs the next day in `days`.
 */
export function reminderEntries(days: readonly PrayerDay[], choices: ReminderChoices): ReminderEntry[] {
  const entries: ReminderEntry[] = []
  for (const { dateKey, times } of days) {
    if (choices.prayers) {
      for (const prayer of PRAYERS) {
        const at = times[prayer]
        if (isValidTime(at)) entries.push({ kind: 'prayer', prayer, dateKey, at, key: `${dateKey}-${prayer}` })
      }
    }
    const azkar = [
      choices.morning && { session: 'morning' as const, after: choices.morningAt },
      choices.evening && { session: 'evening' as const, after: 'asr' as const },
    ]
    for (const reminder of azkar) {
      if (!reminder) continue
      const at = times[reminder.after]
      if (isValidTime(at)) entries.push({ kind: 'azkar', ...reminder, dateKey, at, key: `${dateKey}-${reminder.session}` })
    }
  }
  if (choices.unlogged) entries.push(...unloggedEntries(days, choices.unlogged))
  return entries.sort(compareReminders)
}

/**
 * What the installed app hands to the system: the reminders after `now` and
 * within the next `WINDOW_DAYS` days, the first `REMINDER_LIMIT` of them by
 * `compareReminders`. `dayFor` gives the prayer times of a calendar day at the saved place.
 */
export function upcomingReminders(
  dayFor: (dateKey: DateKey) => PrayerDay,
  timeZone: string,
  choices: ReminderChoices,
  now: Date,
): ReminderEntry[] {
  const today = dateKeyInZone(now, timeZone)
  // From yesterday: at high latitudes its Isha can fall after midnight, and the end of its
  // time does anyway. To the day after the window: the last day's Isha ends on it.
  const days = Array.from({ length: WINDOW_DAYS + 3 }, (_, offset) => dayFor(shiftDateKey(today, offset - 1)))
  const from = now.getTime()
  const until = from + WINDOW_DAYS * DAY_MS
  return reminderEntries(days, choices)
    .filter(({ at }) => at.getTime() > from && at.getTime() <= until)
    .slice(0, REMINDER_LIMIT)
}

/** The last digit of an id: one per reminder of a day. */
const ID_DIGITS: Record<PrayerName | AzkarSession, number> = {
  fajr: 0,
  dhuhr: 1,
  asr: 2,
  maghrib: 3,
  isha: 4,
  morning: 5,
  evening: 6,
}

/** Added to the "not logged yet" reminders' ids, which otherwise follow the prayers' own. */
export const UNLOGGED_ID_BASE = 1_000_000_000

function dayNumber(dateKey: DateKey): number {
  const { year, month, day } = partsOfDateKey(dateKey)
  return year * 10_000 + month * 100 + day
}

/**
 * The id of the "not logged yet" reminder of one prayer of one day:
 * 1_000_000_000 + YYYYMMDD * 10 + 0 to 4 for Fajr to Isha, so Asr on
 * 12 October 2026 is 1202610122. The iOS widget cancels a pending one by this
 * id when the prayer is ticked off there: the formula must never change.
 */
export function unloggedReminderId(dateKey: DateKey, prayer: PrayerName): number {
  return UNLOGGED_ID_BASE + dayNumber(dateKey) * 10 + ID_DIGITS[prayer]
}

/**
 * A notification id that stays the same for the same reminder however often it
 * is scheduled: the day as YYYYMMDD and one digit for the reminder, so Asr on
 * 12 October 2026 is 202610122. Every such id has nine digits and ends in 0 to
 * 6; a "not logged yet" reminder's has ten (see `unloggedReminderId`). All are
 * well inside a 32-bit integer.
 */
export function reminderId(entry: ReminderEntry): number {
  if (entry.kind === 'unlogged') return unloggedReminderId(entry.dateKey, entry.prayer)
  const digit = ID_DIGITS[entry.kind === 'prayer' ? entry.prayer : entry.session]
  return dayNumber(entry.dateKey) * 10 + digit
}

export interface ReminderWording {
  t: I18n['t']
  /** For how long is left in a "not logged yet" reminder. */
  tp: I18n['tp']
  formatTime: (date: Date, timeZone: string) => string
  /** The zone the times are shown in: the saved place's. */
  timeZone: string
  /** The saved place as shown, or `null` when there is none. */
  place: string | null
  /** The user's name from Settings; empty or absent when not given. */
  name?: string
}

/** The notification's title and body, in the interface language, addressing the user by name when there is one. */
export function reminderText(
  entry: ReminderEntry,
  { t, tp, formatTime, timeZone, place, name }: ReminderWording,
): { title: string; body: string } {
  const named = name ? { name: isolate(name) } : null
  if (entry.kind === 'unlogged') {
    const prayer = t(`prayer.${entry.prayer}`)
    const left = {
      prayer,
      duration: describeDuration(entry.endsAt.getTime() - entry.at.getTime(), { t, tp }),
      time: formatTime(entry.endsAt, timeZone),
    }
    return {
      title: named ? t('times.notify.unlogged.titleNamed', { prayer, ...named }) : t('times.notify.unlogged.title', { prayer }),
      body: t(entry.preferred ? 'times.notify.unlogged.body.preferred' : 'times.notify.unlogged.body', left),
    }
  }
  const time = formatTime(entry.at, timeZone)
  if (entry.kind === 'prayer') {
    const prayer = t(`prayer.${entry.prayer}`)
    return {
      title: named ? t('times.notify.message.titleNamed', { prayer, ...named }) : t('times.notify.message.title', { prayer }),
      body: place ? t('times.notify.message.body', { time, place }) : time,
    }
  }
  return {
    title: named
      ? t(`times.notify.azkar.${entry.session}.titleNamed`, named)
      : t(`times.notify.azkar.${entry.session}.title`),
    body: t(`times.notify.azkar.after.${entry.after}`, { time }),
  }
}
