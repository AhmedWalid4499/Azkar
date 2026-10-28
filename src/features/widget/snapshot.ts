import { isolate } from '../../shared/i18n'
import type { I18n } from '../../shared/i18n'
import { PRAYERS } from '../../shared/types'
import type { DateKey, Lang, PrayerDay, PrayerName } from '../../shared/types'
import { PRAYER_STATUSES } from '../prayer-log'
import type { DayLog, LogEntries, PrayerStatus } from '../prayer-log'
import { isValidTime } from '../prayer-times'

/**
 * What the app hands to its iOS widgets, as JSON. The widget extension decodes
 * it with `WidgetSnapshot` in ios/App/Shared/WidgetSnapshot.swift: change both
 * together, and raise the version for a change the widget must tell apart.
 */
export const WIDGET_SNAPSHOT_VERSION = 1

/** Days published around today: yesterday (at high latitudes its Isha can fall after midnight) and the week ahead. */
export const DAYS_BEFORE = 1
export const DAYS_AFTER = 7

export interface WidgetPrayer {
  prayer: PrayerName
  /** Epoch milliseconds. */
  at: number
  /** As the app shows it: the interface's digits and the 12- or 24-hour setting, in the place's zone. */
  time: string
}

export interface WidgetDay {
  date: DateKey
  /** The prayers whose time exists that day (polar day and night leave some out), in order. */
  prayers: WidgetPrayer[]
  /** The day's logged statuses. */
  log: DayLog
}

/** Every text the widgets show once the app has published, in the interface language. */
export type WidgetLabels = Record<
  | 'nextPrayer'
  | 'tomorrow'
  | 'greeting'
  | 'countdown'
  | 'loggedRow'
  | 'unloggedRow'
  | 'noLocation'
  | 'stale'
  | `prayer.${PrayerName}`
  | `status.${PrayerStatus}`,
  string
>

export interface WidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_VERSION
  lang: Lang
  /** Arabic-Indic digits in the widget's own countdown. Only ever true in Arabic. */
  arabicDigits: boolean
  /** The saved place's zone, or `null` when no location is set (and `days` is empty). */
  timeZone: string | null
  name: string
  days: WidgetDay[]
  labels: WidgetLabels
}

export interface SnapshotInput {
  /** The published days in order; `null` for a day that has no times (no location yet). */
  days: ReadonlyArray<PrayerDay | null>
  log: LogEntries
  i18n: Pick<I18n, 'lang' | 't'>
  arabicDigits: boolean
  name: string
  formatTime: (date: Date, timeZone: string) => string
}

/**
 * The wording the widgets use. Templates keep their `{prayer}`, `{time}` and
 * `{status}` for the widget to fill, since a prayer's status can change on the
 * widget itself.
 */
export function widgetLabels(t: I18n['t'], name: string): WidgetLabels {
  const labels: Partial<WidgetLabels> = {
    nextPrayer: t('widget.nextPrayer'),
    tomorrow: t('widget.tomorrow'),
    greeting: name ? t('widget.greeting', { name: isolate(name) }) : '',
    countdown: t('widget.countdown'),
    loggedRow: t('widget.row.logged'),
    unloggedRow: t('widget.row.unlogged'),
    noLocation: t('widget.noLocation'),
    stale: t('widget.stale'),
  }
  for (const prayer of PRAYERS) labels[`prayer.${prayer}`] = t(`prayer.${prayer}`)
  for (const status of PRAYER_STATUSES) labels[`status.${status}`] = t(`log.status.${status}`)
  return labels as WidgetLabels
}

function widgetDay(day: PrayerDay, log: LogEntries, formatTime: SnapshotInput['formatTime']): WidgetDay {
  const prayers: WidgetPrayer[] = []
  for (const prayer of PRAYERS) {
    const at = day.times[prayer]
    if (isValidTime(at)) prayers.push({ prayer, at: at.getTime(), time: formatTime(at, day.timeZone) })
  }
  return { date: day.dateKey, prayers, log: { ...log[day.dateKey] } }
}

export function buildWidgetSnapshot({ days, log, i18n, arabicDigits, name, formatTime }: SnapshotInput): WidgetSnapshot {
  const known = days.filter((day): day is PrayerDay => day !== null)
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    lang: i18n.lang,
    arabicDigits: i18n.lang === 'ar' && arabicDigits,
    timeZone: known[0]?.timeZone ?? null,
    name,
    days: known.map((day) => widgetDay(day, log, formatTime)),
    labels: widgetLabels(i18n.t, name),
  }
}
