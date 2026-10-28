import { useCallback } from 'react'
import { dateKeyInZone, deviceTimeZone, formatClock, formatDateKey, isValidTimeZone } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import type { I18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { useActiveTimeZone } from '../../shared/time'
import type { DateKey } from '../../shared/types'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const twoDigits = new Map<string, Intl.NumberFormat>()

/** `H:MM:SS` until an instant `ms` milliseconds away; never negative. */
export function formatCountdown(ms: number, { locale, n }: Pick<I18n, 'locale' | 'n'>): string {
  let pad = twoDigits.get(locale)
  if (!pad) twoDigits.set(locale, (pad = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })))
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${n(hours)}:${pad.format(minutes)}:${pad.format(total % 60)}`
}

/** A spoken-style duration to the minute, e.g. "1 hour and 12 minutes". */
export function describeDuration(ms: number, { t, tp }: Pick<I18n, 't' | 'tp'>): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000)
  if (totalMinutes < 1) return t('fasting.duration.lessThanMinute')
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return tp('fasting.duration.minutes', minutes)
  if (minutes === 0) return tp('fasting.duration.hours', hours)
  return t('fasting.duration.join', {
    hours: tp('fasting.duration.hours', hours),
    minutes: tp('fasting.duration.minutes', minutes),
  })
}

/** Formats an instant as a wall-clock time in `timeZone`, honouring the 12/24-hour setting. */
export function useClock(): (date: Date, timeZone: string) => string {
  const { locale } = useI18n()
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  return useCallback((date, timeZone) => formatClock(date, locale, timeZone, hour12), [locale, hour12])
}

/**
 * When something filed under `dateKey` was logged: the time alone on that day,
 * with the date as well when it was another day (a fast logged the day after).
 */
export function useWhen(): (at: number, dateKey: DateKey) => string {
  const { t, locale } = useI18n()
  const active = useActiveTimeZone()
  const timeZone = isValidTimeZone(active) ? active : deviceTimeZone()
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  return useCallback(
    (at, dateKey) => {
      const instant = new Date(at)
      const time = formatClock(instant, locale, timeZone, hour12)
      const day = dateKeyInZone(instant, timeZone)
      if (day === dateKey) return time
      const otherYear = day.slice(0, 4) !== dateKey.slice(0, 4)
      const date = formatDateKey(day, locale, { day: 'numeric', month: 'short', year: otherYear ? 'numeric' : undefined })
      return t('fasting.when', { date, time })
    },
    [t, locale, timeZone, hour12],
  )
}
