import type { I18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { formatHijriDayMonth } from './hijri'
import { SHAWWAL_FASTS } from './occasions'
import type { FastingReason, ForbiddenDay } from './occasions'
import type { FastKind, FastRecord, FastStatus } from './types'

export function kindLabelKey(kind: FastKind) {
  return `fasting.kind.${kind}` as const
}

export function kindHintKey(kind: FastKind) {
  return `fasting.kind.${kind}.hint` as const
}

export function statusLabelKey(status: FastStatus) {
  return `fasting.status.${status}` as const
}

export function statusHintKey(status: FastStatus) {
  return `fasting.status.${status}.hint` as const
}

export function forbiddenKey(day: ForbiddenDay) {
  return `fasting.forbidden.${day}` as const
}

/** "Voluntary fast: Fasted", for a calendar cell's accessible name or a line of text. */
export function describeFast(record: Pick<FastRecord, 'kind' | 'status'>, { t }: Pick<I18n, 't'>): string {
  return t('fasting.describe', { kind: t(kindLabelKey(record.kind)), status: t(statusLabelKey(record.status)) })
}

export interface ReasonContext {
  dateKey: DateKey
  offsetDays: number
  /** Voluntary fasts already made in this Shawwal, for the six days. */
  shawwalDone: number
}

/** One reason a day is recommended, as a phrase. */
export function reasonText(
  reason: FastingReason,
  { dateKey, offsetDays, shawwalDone }: ReasonContext,
  { t, locale }: Pick<I18n, 't' | 'locale'>,
): string {
  switch (reason) {
    case 'whiteDays':
      return t('fasting.reason.whiteDays', { date: formatHijriDayMonth(dateKey, locale, offsetDays) })
    case 'shawwal': {
      // More voluntary fasts than six can be logged in Shawwal; the sunnah is complete at six.
      const done = Math.min(shawwalDone, SHAWWAL_FASTS)
      return `${t('fasting.reason.shawwal')}: ${t('fasting.reason.shawwal.progress', { done, total: SHAWWAL_FASTS })}`
    }
    default:
      return t(`fasting.reason.${reason}`)
  }
}
