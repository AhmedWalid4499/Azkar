import { dateKeyInZone, partsOfDateKey, shiftDateKey } from '../../../shared/date'
import { isolate } from '../../../shared/i18n'
import type { I18n } from '../../../shared/i18n'
import { PRAYERS } from '../../../shared/types'
import type { DateKey, PrayerDay, PrayerName } from '../../../shared/types'
import type { AzkarSession, MorningReminderTime } from '../config'
import { isValidTime } from '../engine/compute'

/** Notification groups, so each kind can be replaced without touching the other or other features' notifications. */
export const PRAYER_GROUP = 'prayer-times'
export const AZKAR_GROUP = 'azkar-reminders'

/** How far ahead the installed app schedules: renewed each time it opens. */
export const WINDOW_DAYS = 7
/**
 * iOS keeps the 64 soonest pending notifications of an app and drops the rest.
 * Prayer and azkar reminders together never take more than this, which leaves
 * room for other features. A week of everything switched on is 49.
 */
export const REMINDER_LIMIT = 50

const DAY_MS = 86_400_000

export interface ReminderChoices {
  prayers: boolean
  morning: boolean
  evening: boolean
  morningAt: MorningReminderTime
}

export type ReminderEntry =
  | { kind: 'prayer'; prayer: PrayerName; dateKey: DateKey; at: Date; key: string }
  | { kind: 'azkar'; session: AzkarSession; after: 'fajr' | 'sunrise' | 'asr'; dateKey: DateKey; at: Date; key: string }

/**
 * Every reminder the choices ask for on `days`, in time order. A time that
 * does not exist that day (polar day or night) is left out.
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
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/**
 * What the installed app hands to the system: the reminders after `now` and
 * within the next `WINDOW_DAYS` days, the soonest `REMINDER_LIMIT` of them.
 * `dayFor` gives the prayer times of a calendar day at the saved place.
 */
export function upcomingReminders(
  dayFor: (dateKey: DateKey) => PrayerDay,
  timeZone: string,
  choices: ReminderChoices,
  now: Date,
): ReminderEntry[] {
  const today = dateKeyInZone(now, timeZone)
  // From yesterday: at high latitudes its Isha can fall after midnight.
  const days = Array.from({ length: WINDOW_DAYS + 2 }, (_, offset) => dayFor(shiftDateKey(today, offset - 1)))
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

/**
 * A notification id that stays the same for the same reminder however often it
 * is scheduled: the day as YYYYMMDD and one digit for the reminder, so Asr on
 * 12 October 2026 is 202610122. Every id has nine digits, well inside a 32-bit
 * integer, and ends in 0 to 6.
 */
export function reminderId(entry: ReminderEntry): number {
  const { year, month, day } = partsOfDateKey(entry.dateKey)
  const digit = ID_DIGITS[entry.kind === 'prayer' ? entry.prayer : entry.session]
  return (year * 10_000 + month * 100 + day) * 10 + digit
}

export interface ReminderWording {
  t: I18n['t']
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
  { t, formatTime, timeZone, place, name }: ReminderWording,
): { title: string; body: string } {
  const time = formatTime(entry.at, timeZone)
  const named = name ? { name: isolate(name) } : null
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
