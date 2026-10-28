import type { StringKey } from '../../shared/i18n'
import type { SunnahPrayer } from './types'

/** The name shown for a sunnah prayer, with its rak'ahs for the rawatib: "2 before Fajr". */
export function sunnahLabelKey(sunnah: SunnahPrayer): StringKey {
  return `log.sunnah.${sunnah}`
}
