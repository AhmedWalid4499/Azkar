import { describe, expect, it, vi } from 'vitest'
import { formatHijri } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import {
  buildMonthGrid,
  compareMonths,
  dateKeyInMonth,
  daysInMonth,
  formatMonthTitle,
  hijriSpanOfMonth,
  isInMonth,
  monthOfDateKey,
  moveInGrid,
  shiftMonth,
  weekdayNames,
  weekdayOrder,
  weekStartOf,
} from './calendar'

const SUNDAY = 0
const MONDAY = 1
const SATURDAY = 6

describe('month arithmetic', () => {
  it('reads the month of a day', () => {
    expect(monthOfDateKey('2026-10-11')).toEqual({ year: 2026, month: 10 })
    expect(monthOfDateKey('2028-02-29')).toEqual({ year: 2028, month: 2 })
  })

  it('shifts across year boundaries in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 })
    expect(shiftMonth({ year: 2026, month: 10 }, 0)).toEqual({ year: 2026, month: 10 })
    expect(shiftMonth({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 })
    expect(shiftMonth({ year: 2026, month: 11 }, 14)).toEqual({ year: 2028, month: 1 })
  })

  it('orders months', () => {
    expect(compareMonths({ year: 2026, month: 10 }, { year: 2026, month: 10 })).toBe(0)
    expect(compareMonths({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBeLessThan(0)
    expect(compareMonths({ year: 2026, month: 2 }, { year: 2025, month: 11 })).toBeGreaterThan(0)
  })

  it('knows month lengths, leap years included', () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28)
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29)
    expect(daysInMonth({ year: 2100, month: 2 })).toBe(28)
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30)
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31)
  })

  it('keeps a day inside its month', () => {
    expect(dateKeyInMonth({ year: 2026, month: 2 }, 31)).toBe('2026-02-28')
    expect(dateKeyInMonth({ year: 2028, month: 2 }, 31)).toBe('2028-02-29')
    expect(dateKeyInMonth({ year: 2026, month: 10 }, 0)).toBe('2026-10-01')
    expect(dateKeyInMonth({ year: 2026, month: 10 }, 9)).toBe('2026-10-09')
  })

  it('tests membership', () => {
    expect(isInMonth('2026-10-31', { year: 2026, month: 10 })).toBe(true)
    expect(isInMonth('2026-11-01', { year: 2026, month: 10 })).toBe(false)
    expect(isInMonth('2025-10-11', { year: 2026, month: 10 })).toBe(false)
  })
})

describe('weekStartOf', () => {
  it('starts the week on Sunday for English and Saturday for Arabic by default', () => {
    expect(weekStartOf('en', [])).toBe(SUNDAY)
    expect(weekStartOf('ar', [])).toBe(SATURDAY)
  })

  it('follows the region of a device language that matches the interface language', () => {
    expect(weekStartOf('en', ['en-GB'])).toBe(MONDAY)
    expect(weekStartOf('ar', ['ar-SA'])).toBe(SUNDAY)
    expect(weekStartOf('ar', ['en-GB', 'ar-MA'])).toBe(MONDAY)
    expect(weekStartOf('en', ['AR-sa', 'EN-gb'])).toBe(MONDAY)
  })

  it('does not borrow the region of another language', () => {
    expect(weekStartOf('en', ['ar-SA', 'fr-FR'])).toBe(SUNDAY)
    expect(weekStartOf('ar', ['en-GB'])).toBe(SATURDAY)
  })

  it('falls back to the language convention for a tag it cannot parse', () => {
    expect(weekStartOf('en', ['en-'])).toBe(SUNDAY)
    expect(weekStartOf('ar', ['ar-'])).toBe(SATURDAY)
  })

  it('falls back when the engine has no week data', () => {
    const prototype = Intl.Locale.prototype as unknown as { getWeekInfo: () => unknown; weekInfo: unknown }
    vi.spyOn(prototype, 'getWeekInfo').mockReturnValue(undefined)
    if ('weekInfo' in prototype) vi.spyOn(prototype, 'weekInfo', 'get').mockReturnValue(undefined)

    // Without the data even a region that starts on Monday gets the language default.
    expect(weekStartOf('en', ['en-GB'])).toBe(SUNDAY)
    expect(weekStartOf('ar', ['ar-MA'])).toBe(SATURDAY)
  })

  it('reads the older weekInfo getter when the method is missing', () => {
    const prototype = Intl.Locale.prototype as unknown as { getWeekInfo: unknown; weekInfo: unknown }
    const original = Object.getOwnPropertyDescriptor(prototype, 'getWeekInfo')
    Object.defineProperty(prototype, 'getWeekInfo', { value: undefined, configurable: true, writable: true })
    const getter = vi.fn(() => ({ firstDay: 5 }))
    const originalGetter = Object.getOwnPropertyDescriptor(prototype, 'weekInfo')
    Object.defineProperty(prototype, 'weekInfo', { get: getter, configurable: true })
    try {
      expect(weekStartOf('en', [])).toBe(5)
      expect(getter).toHaveBeenCalled()
    } finally {
      if (original) Object.defineProperty(prototype, 'getWeekInfo', original)
      if (originalGetter) Object.defineProperty(prototype, 'weekInfo', originalGetter)
      else delete (prototype as { weekInfo?: unknown }).weekInfo
    }
  })
})

describe('week layout', () => {
  it('orders the weekdays from the first day of the week', () => {
    expect(weekdayOrder(SUNDAY)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekdayOrder(SATURDAY)).toEqual([6, 0, 1, 2, 3, 4, 5])
    expect(weekdayOrder(MONDAY)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('names the weekdays from Sunday', () => {
    expect(weekdayNames('en', 'short')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(weekdayNames('ar', 'long')).toEqual(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'])
    expect(weekdayNames('ar', 'narrow')).toEqual(['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'])
  })
})

describe('buildMonthGrid', () => {
  const leading = (weeks: Array<Array<DateKey | null>>) => weeks[0]!.findIndex((cell) => cell !== null)
  const days = (weeks: Array<Array<DateKey | null>>) => weeks.flat().filter((cell) => cell !== null)

  it.each([
    // October 2026 begins on a Thursday.
    [{ year: 2026, month: 10 }, SUNDAY, 4, 5],
    [{ year: 2026, month: 10 }, SATURDAY, 5, 6],
    [{ year: 2026, month: 10 }, MONDAY, 3, 5],
    // February 2026 begins on a Sunday and has exactly four weeks.
    [{ year: 2026, month: 2 }, SUNDAY, 0, 4],
    [{ year: 2026, month: 2 }, SATURDAY, 1, 5],
    [{ year: 2026, month: 2 }, MONDAY, 6, 5],
    // August 2026 begins on a Saturday.
    [{ year: 2026, month: 8 }, SUNDAY, 6, 6],
    [{ year: 2026, month: 8 }, SATURDAY, 0, 5],
    // February 2028 is a leap month beginning on a Tuesday.
    [{ year: 2028, month: 2 }, SUNDAY, 2, 5],
    [{ year: 2028, month: 2 }, SATURDAY, 3, 5],
  ])('lays out %o with the week starting on weekday %i', (month, weekStart, blanks, rows) => {
    const weeks = buildMonthGrid(month, weekStart)
    expect(leading(weeks)).toBe(blanks)
    expect(weeks).toHaveLength(rows)
    for (const week of weeks) expect(week).toHaveLength(7)

    const keys = days(weeks)
    expect(keys).toHaveLength(daysInMonth(month))
    expect(keys[0]).toBe(dateKeyInMonth(month, 1))
    expect(keys.at(-1)).toBe(dateKeyInMonth(month, 31))
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('puts each day under its own weekday', () => {
    const weeks = buildMonthGrid({ year: 2026, month: 10 }, SATURDAY)
    // Sunday 11 October sits in the second column of a Saturday-first week.
    expect(weeks[2]).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ])
    expect(weeks[0]).toEqual([null, null, null, null, null, '2026-10-01', '2026-10-02'])
    expect(weeks.at(-1)).toEqual(['2026-10-31', null, null, null, null, null, null])
  })
})

describe('moveInGrid', () => {
  const far = '2099-12-31'
  const ltr = { dir: 'ltr', weekStart: SUNDAY, today: far } as const
  const rtl = { dir: 'rtl', weekStart: SATURDAY, today: far } as const

  it('moves a day at a time, following the reading direction', () => {
    expect(moveInGrid('ArrowRight', '2026-10-07', ltr)).toBe('2026-10-08')
    expect(moveInGrid('ArrowLeft', '2026-10-07', ltr)).toBe('2026-10-06')
    expect(moveInGrid('ArrowRight', '2026-10-07', rtl)).toBe('2026-10-06')
    expect(moveInGrid('ArrowLeft', '2026-10-07', rtl)).toBe('2026-10-08')
  })

  it('moves a week at a time whatever the direction', () => {
    for (const options of [ltr, rtl]) {
      expect(moveInGrid('ArrowUp', '2026-10-07', options)).toBe('2026-09-30')
      expect(moveInGrid('ArrowDown', '2026-10-07', options)).toBe('2026-10-14')
    }
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(moveInGrid('ArrowLeft', '2026-01-01', ltr)).toBe('2025-12-31')
    expect(moveInGrid('ArrowRight', '2025-12-31', ltr)).toBe('2026-01-01')
    expect(moveInGrid('ArrowUp', '2026-03-05', ltr)).toBe('2026-02-26')
    expect(moveInGrid('ArrowRight', '2028-02-28', ltr)).toBe('2028-02-29')
    expect(moveInGrid('ArrowRight', '2026-02-28', ltr)).toBe('2026-03-01')
  })

  it('goes to the edges of the week with Home and End', () => {
    // Wednesday 7 October 2026.
    expect(moveInGrid('Home', '2026-10-07', ltr)).toBe('2026-10-04')
    expect(moveInGrid('End', '2026-10-07', ltr)).toBe('2026-10-10')
    expect(moveInGrid('Home', '2026-10-07', rtl)).toBe('2026-10-03')
    expect(moveInGrid('End', '2026-10-07', rtl)).toBe('2026-10-09')
    // A Monday-first week ends on the Sunday.
    expect(moveInGrid('Home', '2026-10-11', { ...ltr, weekStart: MONDAY })).toBe('2026-10-05')
    expect(moveInGrid('End', '2026-10-11', { ...ltr, weekStart: MONDAY })).toBe('2026-10-11')
    // Already at the edge.
    expect(moveInGrid('Home', '2026-10-04', ltr)).toBe('2026-10-04')
  })

  it('changes month with PageUp and PageDown, keeping the day where it exists', () => {
    expect(moveInGrid('PageUp', '2026-10-11', ltr)).toBe('2026-09-11')
    expect(moveInGrid('PageDown', '2026-10-11', ltr)).toBe('2026-11-11')
    expect(moveInGrid('PageUp', '2026-01-15', ltr)).toBe('2025-12-15')
    expect(moveInGrid('PageDown', '2025-12-15', ltr)).toBe('2026-01-15')
    expect(moveInGrid('PageUp', '2026-03-31', ltr)).toBe('2026-02-28')
    expect(moveInGrid('PageUp', '2028-03-31', ltr)).toBe('2028-02-29')
    expect(moveInGrid('PageDown', '2026-10-31', ltr)).toBe('2026-11-30')
  })

  it('never moves past today', () => {
    const options = { ...ltr, today: '2026-10-11' }
    expect(moveInGrid('ArrowRight', '2026-10-11', options)).toBe('2026-10-11')
    expect(moveInGrid('ArrowRight', '2026-10-10', options)).toBe('2026-10-11')
    expect(moveInGrid('ArrowDown', '2026-10-08', options)).toBe('2026-10-11')
    expect(moveInGrid('End', '2026-10-11', options)).toBe('2026-10-11')
    expect(moveInGrid('PageDown', '2026-09-20', options)).toBe('2026-10-11')
    expect(moveInGrid('ArrowLeft', '2026-10-10', { ...rtl, today: '2026-10-11' })).toBe('2026-10-11')
    expect(moveInGrid('ArrowLeft', '2026-10-11', { ...rtl, today: '2026-10-11' })).toBe('2026-10-11')
  })

  it('leaves other keys alone', () => {
    for (const key of ['Enter', ' ', 'Tab', 'a', 'Escape']) expect(moveInGrid(key, '2026-10-07', ltr)).toBeNull()
  })
})

describe('labels', () => {
  it('titles a month in the Gregorian calendar', () => {
    expect(formatMonthTitle({ year: 2026, month: 10 }, 'en')).toBe('October 2026')
    expect(formatMonthTitle({ year: 2026, month: 10 }, 'ar-u-nu-arab')).toBe('أكتوبر ٢٠٢٦')
    expect(formatMonthTitle({ year: 2026, month: 10 }, 'ar-u-nu-latn')).toBe('أكتوبر 2026')
  })

  it('names the two Hijri months a Gregorian month usually spans', () => {
    expect(hijriSpanOfMonth({ year: 2026, month: 10 }, 'en')).toEqual({ from: 'Rabiʻ II', to: 'Jumada I 1448 AH' })
    expect(hijriSpanOfMonth({ year: 2026, month: 10 }, 'ar-u-nu-arab')).toEqual({
      from: 'ربيع الآخر',
      to: 'جمادى الأولى ١٤٤٨ هـ',
    })
  })

  it('keeps both years when the Hijri new year falls inside the month', () => {
    expect(hijriSpanOfMonth({ year: 2026, month: 6 }, 'en')).toEqual({
      from: 'Dhuʻl-Hijjah 1447 AH',
      to: 'Muharram 1448 AH',
    })
  })

  it('gives a single month when the whole month falls inside it', () => {
    expect(hijriSpanOfMonth({ year: 2025, month: 2 }, 'en')).toEqual({ from: 'Shaʻban 1446 AH', to: null })
  })

  it('gives the first and last of three months', () => {
    expect(hijriSpanOfMonth({ year: 2022, month: 5 }, 'en')).toEqual({ from: 'Ramadan', to: 'Dhuʻl-Qiʻdah 1443 AH' })
  })

  it('applies the same day offset as formatHijri', () => {
    // February 2025 runs from 2 to 29 Shaʻban; a day either way tips it into a neighbouring month.
    expect(hijriSpanOfMonth({ year: 2025, month: 2 }, 'en', 1)).toEqual({ from: 'Shaʻban', to: 'Ramadan 1446 AH' })
    expect(hijriSpanOfMonth({ year: 2025, month: 2 }, 'en', -2)).toEqual({ from: 'Rajab', to: 'Shaʻban 1446 AH' })
    expect(formatHijri('2025-02-28', 'en', 1)).toContain('Ramadan')
    expect(formatHijri('2025-02-01', 'en', -2)).toContain('Rajab')
  })
})
