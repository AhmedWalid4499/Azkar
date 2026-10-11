import type { StringKey } from '../../shared/i18n'
import type { PrayerStatus } from './types'

export function statusLabelKey(status: PrayerStatus | null): StringKey {
  return `log.status.${status ?? 'none'}`
}

export function statusHintKey(status: PrayerStatus): StringKey {
  return `log.status.${status}.hint`
}
