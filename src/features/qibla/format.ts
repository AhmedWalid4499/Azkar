import type { I18n } from '../../shared/i18n'

/**
 * Whole degrees with the degree sign, isolated left to right: in an Arabic line
 * Arabic-Indic digits would otherwise let the sign drift to the far side of the number.
 */
export function formatDegrees(value: number, { n }: Pick<I18n, 'n'>): string {
  const whole = Math.round(value) % 360
  return `⁦${n(whole)}°⁩`
}

const kilometres = new Map<string, Intl.NumberFormat>()

/** "1,287 km", "١٬٢٨٧ كم": whole kilometres, grouped and abbreviated the locale's way. */
export function formatKilometres(value: number, locale: string): string {
  let format = kilometres.get(locale)
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 0 })
    kilometres.set(locale, format)
  }
  return format.format(value)
}
