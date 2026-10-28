import { useCallback } from 'react'
import {
  dateKeyInZone,
  deviceTimeZone,
  formatClock,
  formatDateKey,
  isValidTimeZone,
  zonedParts,
} from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { useActiveTimeZone } from '../../shared/time'
import type { DateKey } from '../../shared/types'

export interface StampFormat {
  locale: string
  timeZone: string
  hour12: boolean
}

export interface StampParts {
  /** The wall-clock time in the zone. */
  time: string
  /** The date as well, short, when the instant fell on another day than the one it is filed under. */
  date: string | null
}

/**
 * How to show when something filed under `dateKey` was recorded: the time alone on
 * that day; with the date when it was another day, as for Fajr logged the evening
 * after or evening azkar finished past midnight.
 */
export function stampParts(at: number, dateKey: DateKey, { locale, timeZone, hour12 }: StampFormat): StampParts {
  const instant = new Date(at)
  const time = formatClock(instant, locale, timeZone, hour12)
  const day = dateKeyInZone(instant, timeZone)
  if (day === dateKey) return { time, date: null }
  const otherYear = day.slice(0, 4) !== dateKey.slice(0, 4)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: otherYear ? 'numeric' : undefined }
  return { time, date: formatDateKey(day, locale, options) }
}

/** The zone times are shown in: the saved location's, else the device's, and never one Intl cannot use. */
export function usableTimeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : deviceTimeZone()
}

/** Formats the times of a day's records in the active zone, honouring the 12/24-hour setting. */
export function useStamp(): (at: number, dateKey: DateKey) => StampParts {
  const { locale } = useI18n()
  const timeZone = usableTimeZone(useActiveTimeZone())
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  return useCallback((at, dateKey) => stampParts(at, dateKey, { locale, timeZone, hour12 }), [locale, timeZone, hour12])
}

/** "When" in one string: the time, or the date and the time on another day. */
export function useWhen(): (at: number, dateKey: DateKey) => string {
  const { t } = useI18n()
  const stamp = useStamp()
  return useCallback(
    (at, dateKey) => {
      const { time, date } = stamp(at, dateKey)
      return date === null ? time : t('log.when', { date, time })
    },
    [t, stamp],
  )
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** An instant as `YYYY-MM-DD HH:mm` on the wall clock of `timeZone`: unambiguous, and sorts as text. */
export function isoMinute(at: number, timeZone: string): string {
  const { year, month, day, hour, minute } = zonedParts(new Date(at), timeZone)
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`
}
