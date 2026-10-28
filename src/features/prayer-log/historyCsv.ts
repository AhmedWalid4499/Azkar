import { formatHijri } from '../../shared/date'
import type { I18n } from '../../shared/i18n'
import { PRAYERS } from '../../shared/types'
import type { DateKey } from '../../shared/types'
import { COLLECTION_IDS } from '../azkar'
import type { SessionRecord } from '../azkar'
import { isoMinute, usableTimeZone } from './stamps'
import { statusLabelKey } from './statusLabels'
import { sunnahLabelKey } from './sunnahLabels'
import { recordedDays } from './trackerStats'
import type { HistoryData } from './trackerStats'
import { isPrayerStatus, SUNNAH_PRAYERS } from './types'

export interface HistoryCsvOptions {
  /** Headers and values are written in this language. */
  i18n: Pick<I18n, 't' | 'locale'>
  /** Every time is written on this zone's wall clock, and the zone is named on each row. */
  timeZone: string
  hijriOffset: number
}

interface Column {
  header: string
  value: (dateKey: DateKey) => string
}

/** Spreadsheets read a cell that begins like this as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, a quote or a line break,
 * with quotes doubled. A value that a spreadsheet would run as a formula is kept as text.
 */
export function csvField(value: string): string {
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Lets Excel recognise the file as UTF-8, so Arabic is not shown as mojibake. */
const BYTE_ORDER_MARK = '\uFEFF'

/**
 * Every recorded day as a CSV file, oldest first: the date and its Hijri date, each
 * obligatory prayer's status and when it was logged, when each sunnah prayer was
 * ticked off, and each azkar session's times, progress and recitations. A cell is
 * empty where nothing was recorded. Times are `YYYY-MM-DD HH:mm` in `timeZone`.
 */
export function historyCsv(data: HistoryData, { i18n, timeZone, hijriOffset }: HistoryCsvOptions): string {
  const { t, locale } = i18n
  const zone = usableTimeZone(timeZone)
  const time = (at: number | undefined) => (at === undefined ? '' : isoMinute(at, zone))
  const number = (value: number | undefined) => (value === undefined ? '' : String(value))

  const prayerColumns = PRAYERS.flatMap((prayer): Column[] => {
    const name = t(`prayer.${prayer}`)
    return [
      {
        header: t('log.csv.status', { prayer: name }),
        value: (key) => {
          const status = data.entries[key]?.[prayer]
          return isPrayerStatus(status) ? t(statusLabelKey(status)) : ''
        },
      },
      { header: t('log.csv.loggedAt', { prayer: name }), value: (key) => time(data.loggedAt[key]?.[prayer]) },
    ]
  })

  const sunnahColumns = SUNNAH_PRAYERS.map(
    (sunnah): Column => ({
      header: t('log.csv.sunnah', { sunnah: t(sunnahLabelKey(sunnah)) }),
      value: (key) => time(data.sunnah[key]?.[sunnah]),
    }),
  )

  const sessionColumns = COLLECTION_IDS.flatMap((collection): Column[] => {
    const session = t(`azkar.collection.${collection}`)
    const record = (key: DateKey): SessionRecord | undefined => data.sessions[key]?.[collection]
    return [
      {
        header: t('log.csv.session.status', { session }),
        value: (key) => {
          const found = record(key)
          if (!found) return ''
          return t(found.completed ? 'log.csv.completed' : 'log.csv.inProgress')
        },
      },
      { header: t('log.csv.session.startedAt', { session }), value: (key) => time(record(key)?.startedAt) },
      { header: t('log.csv.session.finishedAt', { session }), value: (key) => time(record(key)?.completedAt) },
      { header: t('log.csv.session.lastAt', { session }), value: (key) => time(record(key)?.lastAt) },
      {
        header: t('log.csv.session.done', { session }),
        // A completed session counts as read in full, even once "Start over" has begun a second reading.
        value: (key) => {
          const found = record(key)
          return number(found && (found.completed ? found.total : found.done))
        },
      },
      { header: t('log.csv.session.total', { session }), value: (key) => number(record(key)?.total) },
      { header: t('log.csv.session.recitations', { session }), value: (key) => number(record(key)?.recitations) },
    ]
  })

  const columns: Column[] = [
    { header: t('log.csv.date'), value: (key) => key },
    { header: t('log.csv.hijri'), value: (key) => formatHijri(key, locale, hijriOffset) },
    { header: t('log.csv.timeZone'), value: () => zone },
    ...prayerColumns,
    ...sunnahColumns,
    ...sessionColumns,
  ]

  const line = (cells: string[]) => cells.map(csvField).join(',')
  const rows = recordedDays(data).map((key) => line(columns.map((column) => column.value(key))))
  return `${BYTE_ORDER_MARK}${[line(columns.map((column) => column.header)), ...rows].join('\r\n')}\r\n`
}
