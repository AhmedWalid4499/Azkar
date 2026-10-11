import { useCallback } from 'react'
import { formatClock } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import type { I18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Formats an instant as a wall-clock time in `timeZone`, honouring the 12/24-hour setting. */
export function useClockFormat(): (date: Date, timeZone: string) => string {
  const { locale } = useI18n()
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  return useCallback((date, timeZone) => formatClock(date, locale, timeZone, hour12), [locale, hour12])
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
  if (totalMinutes < 1) return t('times.duration.lessThanMinute')
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return tp('times.duration.minutes', minutes)
  if (minutes === 0) return tp('times.duration.hours', hours)
  return t('times.duration.join', {
    hours: tp('times.duration.hours', hours),
    minutes: tp('times.duration.minutes', minutes),
  })
}

const signed = new Map<string, Intl.NumberFormat>()

/** A whole number with an explicit sign in the locale's own convention: "+2", "-5", "0". */
export function formatSigned(value: number, locale: string): string {
  let format = signed.get(locale)
  if (!format) signed.set(locale, (format = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', useGrouping: false })))
  return format.format(value)
}
