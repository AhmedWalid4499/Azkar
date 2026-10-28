import type { I18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { kindLabelKey, statusLabelKey } from './labels'
import type { FastingDays, FastRecord } from './types'

export interface FastingCsvColumn {
  header: string
  /** The cell for one day; empty where no fast is logged. */
  value: (dateKey: DateKey) => string
}

export interface FastingCsvOptions {
  /** Headers and values are written in this language. */
  t: I18n['t']
  /** Writes a logged time as the rest of the export writes times; `undefined` gives an empty cell. */
  time: (at: number | undefined) => string
}

/**
 * The fasting columns of the history export: what the fast was for, how it
 * went, and when it was logged. Same shape as the export's own columns.
 */
export function fastingCsvColumns(days: FastingDays, { t, time }: FastingCsvOptions): FastingCsvColumn[] {
  const record = (key: DateKey): FastRecord | undefined =>
    Object.prototype.hasOwnProperty.call(days, key) ? days[key] : undefined
  return [
    {
      header: t('fasting.csv.kind'),
      value: (key) => {
        const found = record(key)
        return found ? t(kindLabelKey(found.kind)) : ''
      },
    },
    {
      header: t('fasting.csv.status'),
      value: (key) => {
        const found = record(key)
        return found ? t(statusLabelKey(found.status)) : ''
      },
    },
    { header: t('fasting.csv.loggedAt'), value: (key) => time(record(key)?.at) },
  ]
}

/** The days with a fast logged, oldest first: the export's rows must include them. */
export function fastingDayKeys(days: FastingDays): DateKey[] {
  return Object.keys(days).sort()
}
