const signed = new Map<string, Intl.NumberFormat>()

/**
 * A whole number with an explicit sign, written the locale's own way: "+1",
 * "-2", "0". In Arabic the result carries the direction mark that keeps the
 * sign on the correct side of the digits, which a hand-placed "+" does not.
 */
export function formatSigned(value: number, locale: string): string {
  let format = signed.get(locale)
  if (!format) signed.set(locale, (format = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', useGrouping: false })))
  return format.format(value)
}
