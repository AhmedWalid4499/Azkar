import { describe, expect, it } from 'vitest'
import { createI18n } from '../../shared/i18n'
import { fastingCsvColumns, fastingDayKeys } from './csv'
import { describeFast } from './labels'
import { fastingMarkOf, fastingMarkOn } from './marks'
import type { FastingDays } from './types'

const AT = Date.UTC(2026, 9, 26, 4, 30)
const DAYS: FastingDays = {
  '2026-10-26': { kind: 'voluntary', status: 'fasted', at: AT },
  '2026-03-05': { kind: 'ramadan', status: 'excused', at: AT },
  '2026-04-06': { kind: 'qada', status: 'broken' },
}
const time = (at: number | undefined) => (at === undefined ? '' : new Date(at).toISOString().slice(0, 16).replace('T', ' '))

describe('the CSV export’s fasting columns', () => {
  it('give each day what the fast was for, how it went and when it was logged', () => {
    const columns = fastingCsvColumns(DAYS, { t: createI18n('en', false).t, time })
    expect(columns.map((column) => column.header)).toEqual(['Fast', 'Fast: status', 'Fast: logged at'])
    const row = (key: string) => columns.map((column) => column.value(key))
    expect(row('2026-10-26')).toEqual(['Voluntary fast', 'Fasted', '2026-10-26 04:30'])
    expect(row('2026-03-05')).toEqual(['Ramadan fast', 'Excused', '2026-10-26 04:30'])
    expect(row('2026-04-06')).toEqual(['Make-up fast', 'Broke the fast', ''])
    expect(row('2026-10-27')).toEqual(['', '', ''])
    expect(row('__proto__')).toEqual(['', '', ''])
  })

  it('are written in Arabic for an Arabic export', () => {
    const columns = fastingCsvColumns(DAYS, { t: createI18n('ar', true).t, time })
    expect(columns.map((column) => column.header)).toEqual(['الصيام', 'الصيام: الحالة', 'الصيام: وقت التسجيل'])
    expect(columns.map((column) => column.value('2026-03-05'))).toEqual(['صيام رمضان', 'إفطار بعذر', '2026-10-26 04:30'])
  })

  it('list the days with a fast, oldest first, for the export’s rows', () => {
    expect(fastingDayKeys(DAYS)).toEqual(['2026-03-05', '2026-04-06', '2026-10-26'])
  })
})

describe('calendar marks', () => {
  it('say whether a day has a fast, its kind, and whether it was fasted to the end', () => {
    expect(fastingMarkOn(DAYS, '2026-10-26')).toEqual({ kind: 'voluntary', status: 'fasted', fasted: true })
    expect(fastingMarkOn(DAYS, '2026-03-05')).toEqual({ kind: 'ramadan', status: 'excused', fasted: false })
    expect(fastingMarkOn(DAYS, '2026-10-27')).toBeNull()
    expect(fastingMarkOn(DAYS, 'constructor')).toBeNull()
    expect(fastingMarkOf(undefined)).toBeNull()
  })

  it('come with words for a cell’s accessible name', () => {
    expect(describeFast(DAYS['2026-04-06']!, createI18n('en', false))).toBe('Make-up fast: Broke the fast')
    expect(describeFast(DAYS['2026-10-26']!, createI18n('ar', true))).toBe('صيام تطوع: صيام تام')
  })
})
