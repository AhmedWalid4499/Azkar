import { describe, expect, it } from 'vitest'
import { deviceTimeZone, formatHijri } from '../../shared/date'
import { createI18n } from '../../shared/i18n'
import type { DateKey, Lang } from '../../shared/types'
import type { SessionRecord } from '../azkar'
import { parseCsv } from './csvTesting'
import { csvField, historyCsv } from './historyCsv'
import type { HistoryData } from './trackerStats'

const AT = (dateKey: DateKey, time: string) => Date.parse(`${dateKey}T${time}:00Z`)

const empty = (): HistoryData => ({ entries: {}, loggedAt: {}, sunnah: {}, sessions: {} })

const completed: SessionRecord = {
  startedAt: AT('2026-10-09', '02:00'),
  lastAt: AT('2026-10-09', '02:21'),
  completedAt: AT('2026-10-09', '02:21'),
  completed: true,
  done: 23,
  total: 23,
  recitations: 160,
}

function sample(): HistoryData {
  return {
    entries: {
      '2026-10-09': { fajr: 'ontime', dhuhr: 'missed', isha: 'excused' },
      '2026-10-10': { maghrib: 'jamaah' },
      // Kept as stored, even ahead of today: the export leaves nothing out.
      '2026-11-30': { asr: 'late' },
    },
    loggedAt: { '2026-10-09': { fajr: AT('2026-10-09', '02:12'), dhuhr: AT('2026-10-10', '18:03') } },
    sunnah: { '2026-10-09': { witr: AT('2026-10-09', '19:40') }, '2026-10-07': { duha: AT('2026-10-07', '06:00') } },
    sessions: {
      '2026-10-09': {
        morning: completed,
        // Read again after "Start over": the session still counts as read in full.
        evening: {
          ...completed,
          done: 4,
          startedAt: AT('2026-10-09', '14:00'),
          lastAt: AT('2026-10-09', '21:30'),
          completedAt: AT('2026-10-09', '21:30'),
        },
      },
      '2026-10-08': { morning: { startedAt: AT('2026-10-08', '03:00'), lastAt: AT('2026-10-08', '03:04'), completed: false, done: 5, total: 23, recitations: 12 } },
      // Carried over from the first version of the store, which kept no times.
      '2026-10-01': { evening: { completed: true, done: 20, total: 20, recitations: 0 } },
    },
  }
}

function table(lang: Lang, timeZone = 'Asia/Riyadh', data = sample(), arabicDigits = true) {
  const csv = historyCsv(data, { i18n: createI18n(lang, arabicDigits), timeZone, hijriOffset: 0 })
  const [header = [], ...rows] = parseCsv(csv.replace(/^\uFEFF/, ''))
  /** The cell under `column` on the row for `dateKey`. */
  const cell = (dateKey: DateKey, column: string) => {
    const at = header.indexOf(column)
    if (at === -1) throw new Error(`No column ${column}`)
    return rows.find((row) => row[0] === dateKey)?.[at]
  }
  return { csv, header, rows, cell }
}

describe('csvField', () => {
  it('leaves a plain value as it is', () => {
    expect(csvField('On time')).toBe('On time')
    expect(csvField('')).toBe('')
    expect(csvField('2026-10-09 05:12')).toBe('2026-10-09 05:12')
    expect(csvField('في وقتها')).toBe('في وقتها')
  })

  it('quotes a value holding a comma, a quote or a line break, and doubles its quotes', () => {
    expect(csvField('Rabiʻ II 27, 1448 AH')).toBe('"Rabiʻ II 27, 1448 AH"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
    expect(csvField('two\r\nlines')).toBe('"two\r\nlines"')
  })

  it('keeps a value that a spreadsheet would run as a formula as plain text', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvField('+1')).toBe("'+1")
    expect(csvField('-1')).toBe("'-1")
    expect(csvField('@SUM')).toBe("'@SUM")
  })
})

describe('historyCsv', () => {
  it('is UTF-8 with a byte order mark, so Arabic opens correctly, and ends every line with CRLF', () => {
    const { csv, rows, header } = table('en')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    for (const row of rows) expect(row).toHaveLength(header.length)
  })

  it('names every column in English', () => {
    expect(table('en').header).toEqual([
      'Date',
      'Hijri date',
      'Time zone',
      'Fajr: status',
      'Fajr: logged at',
      'Dhuhr: status',
      'Dhuhr: logged at',
      'Asr: status',
      'Asr: logged at',
      'Maghrib: status',
      'Maghrib: logged at',
      'Isha: status',
      'Isha: logged at',
      '2 before Fajr: logged at',
      'Duha: logged at',
      '4 before Dhuhr: logged at',
      '2 after Dhuhr: logged at',
      '2 after Maghrib: logged at',
      '2 after Isha: logged at',
      'Night prayer: logged at',
      'Witr: logged at',
      ...['Morning azkar', 'Evening azkar', 'Before sleep'].flatMap((session) => [
        `${session}: status`,
        `${session}: started at`,
        `${session}: finished at`,
        `${session}: last count at`,
        `${session}: azkar done`,
        `${session}: azkar in session`,
        `${session}: recitations`,
      ]),
    ])
  })

  it('names every column in Arabic', () => {
    expect(table('ar').header).toEqual([
      'التاريخ',
      'التاريخ الهجري',
      'المنطقة الزمنية',
      'الفجر: الحالة',
      'الفجر: وقت التسجيل',
      'الظهر: الحالة',
      'الظهر: وقت التسجيل',
      'العصر: الحالة',
      'العصر: وقت التسجيل',
      'المغرب: الحالة',
      'المغرب: وقت التسجيل',
      'العشاء: الحالة',
      'العشاء: وقت التسجيل',
      'ركعتان قبل الفجر: وقت التسجيل',
      'الضحى: وقت التسجيل',
      'أربع ركعات قبل الظهر: وقت التسجيل',
      'ركعتان بعد الظهر: وقت التسجيل',
      'ركعتان بعد المغرب: وقت التسجيل',
      'ركعتان بعد العشاء: وقت التسجيل',
      'قيام الليل: وقت التسجيل',
      'الوتر: وقت التسجيل',
      ...['أذكار الصباح', 'أذكار المساء', 'أذكار النوم'].flatMap((session) => [
        `${session}: الحالة`,
        `${session}: وقت البدء`,
        `${session}: وقت الإتمام`,
        `${session}: وقت آخر عدّ`,
        `${session}: الأذكار المكتملة`,
        `${session}: عدد الأذكار`,
        `${session}: مرات الذكر`,
      ]),
    ])
  })

  it('has one row for every recorded day, oldest first, whatever was recorded on it', () => {
    expect(table('en').rows.map((row) => row[0])).toEqual([
      '2026-10-01',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-11-30',
    ])
    expect(table('en', 'UTC', empty()).rows).toEqual([])
  })

  it('writes each prayer’s status in the language, and when it was logged', () => {
    const { cell } = table('en')
    expect(cell('2026-10-09', 'Fajr: status')).toBe('On time')
    expect(cell('2026-10-09', 'Dhuhr: status')).toBe('Missed')
    expect(cell('2026-10-09', 'Isha: status')).toBe('Excused')
    expect(cell('2026-10-09', 'Asr: status')).toBe('')
    expect(cell('2026-10-10', 'Maghrib: status')).toBe('Jamaah')
    expect(cell('2026-11-30', 'Asr: status')).toBe('Late')
    // Kept from before times were recorded: a status with no time.
    expect(cell('2026-10-09', 'Isha: logged at')).toBe('')

    const arabic = table('ar')
    expect(arabic.cell('2026-10-09', 'الفجر: الحالة')).toBe('في وقتها')
    expect(arabic.cell('2026-10-10', 'المغرب: الحالة')).toBe('جماعة')
  })

  it('gives every time on the wall clock of the active zone, and names that zone on each row', () => {
    const riyadh = table('en', 'Asia/Riyadh')
    expect(riyadh.cell('2026-10-09', 'Time zone')).toBe('Asia/Riyadh')
    expect(riyadh.cell('2026-10-09', 'Fajr: logged at')).toBe('2026-10-09 05:12')
    // Logged the next evening: the date says so.
    expect(riyadh.cell('2026-10-09', 'Dhuhr: logged at')).toBe('2026-10-10 21:03')
    expect(riyadh.cell('2026-10-09', 'Witr: logged at')).toBe('2026-10-09 22:40')
    // Past midnight in Riyadh, still the evening session of the 9th.
    expect(riyadh.cell('2026-10-09', 'Evening azkar: finished at')).toBe('2026-10-10 00:30')

    const newYork = table('en', 'America/New_York')
    expect(newYork.cell('2026-10-09', 'Time zone')).toBe('America/New_York')
    expect(newYork.cell('2026-10-09', 'Fajr: logged at')).toBe('2026-10-08 22:12')
    expect(newYork.cell('2026-10-09', 'Witr: logged at')).toBe('2026-10-09 15:40')
  })

  it('keeps the times in Latin digits in Arabic too, so a spreadsheet can sort them', () => {
    const { cell } = table('ar', 'Asia/Riyadh')
    expect(cell('2026-10-09', 'الفجر: وقت التسجيل')).toBe('2026-10-09 05:12')
    expect(cell('2026-10-09', 'أذكار الصباح: مرات الذكر')).toBe('160')
  })

  it('falls back to the device zone when the active one cannot be used', () => {
    expect(table('en', 'Not/AZone').cell('2026-10-09', 'Time zone')).toBe(deviceTimeZone())
  })

  it('leaves a sunnah prayer’s cell empty unless it was ticked off', () => {
    const { cell } = table('en')
    expect(cell('2026-10-07', 'Duha: logged at')).toBe('2026-10-07 09:00')
    expect(cell('2026-10-07', 'Witr: logged at')).toBe('')
    expect(cell('2026-10-09', 'Duha: logged at')).toBe('')
  })

  it('gives each azkar session’s state, times, progress and recitations', () => {
    const { cell } = table('en')
    const session = (dateKey: DateKey, name: string) =>
      ['status', 'started at', 'finished at', 'last count at', 'azkar done', 'azkar in session', 'recitations'].map((field) =>
        cell(dateKey, `${name}: ${field}`),
      )

    expect(session('2026-10-09', 'Morning azkar')).toEqual([
      'Completed',
      '2026-10-09 05:00',
      '2026-10-09 05:21',
      '2026-10-09 05:21',
      '23',
      '23',
      '160',
    ])
    expect(session('2026-10-09', 'Evening azkar')).toEqual([
      'Completed',
      '2026-10-09 17:00',
      '2026-10-10 00:30',
      '2026-10-10 00:30',
      '23',
      '23',
      '160',
    ])
    expect(session('2026-10-08', 'Morning azkar')).toEqual(['In progress', '2026-10-08 06:00', '', '2026-10-08 06:04', '5', '23', '12'])
    // No times were kept then, and none are made up.
    expect(session('2026-10-01', 'Evening azkar')).toEqual(['Completed', '', '', '', '20', '20', '0'])
    expect(session('2026-10-10', 'Morning azkar')).toEqual(['', '', '', '', '', '', ''])

    expect(table('ar').cell('2026-10-08', 'أذكار الصباح: الحالة')).toBe('لم تكتمل')
    expect(table('ar').cell('2026-10-01', 'أذكار المساء: الحالة')).toBe('مكتملة')
  })

  it('gives the Hijri date in the language, with the Hijri adjustment, quoted when it holds a comma', () => {
    const english = formatHijri('2026-10-09', 'en')
    expect(english).toContain(',')
    const { csv, cell } = table('en')
    expect(cell('2026-10-09', 'Hijri date')).toBe(english)
    expect(csv).toContain(`,"${english}",`)

    const adjusted = historyCsv(sample(), { i18n: createI18n('en', true), timeZone: 'UTC', hijriOffset: 1 })
    expect(adjusted).toContain(`"${formatHijri('2026-10-10', 'en')}"`)

    expect(table('ar').cell('2026-10-09', 'التاريخ الهجري')).toBe(formatHijri('2026-10-09', 'ar-u-nu-arab'))
    expect(table('ar', 'UTC', sample(), false).cell('2026-10-09', 'التاريخ الهجري')).toBe(
      formatHijri('2026-10-09', 'ar-u-nu-latn'),
    )
  })
})
