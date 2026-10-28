import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatHijri, shiftDateKey } from '../../shared/date'
import {
  civilDaysOfHijriMonth,
  formatHijriDayMonth,
  formatHijriMonth,
  formatHijriYear,
  hijriOf,
  isRamadan,
  monthStartOf,
  ramadanDayOf,
} from './hijri'

// Umm al-Qura, as published: Ramadan 1447 ran from Wednesday 18 February to Thursday 19 March 2026
// (30 days) and Ramadan 1448 from Monday 8 February to Monday 8 March 2027 (29 days).

describe('hijriOf', () => {
  it('reads the Umm al-Qura date of a civil day', () => {
    expect(hijriOf('2026-02-17')).toEqual({ year: 1447, month: 8, day: 29 })
    expect(hijriOf('2026-02-18')).toEqual({ year: 1447, month: 9, day: 1 })
    expect(hijriOf('2026-03-19')).toEqual({ year: 1447, month: 9, day: 30 })
    expect(hijriOf('2026-03-20')).toEqual({ year: 1447, month: 10, day: 1 })
    expect(hijriOf('2026-06-16')).toEqual({ year: 1448, month: 1, day: 1 })
    expect(hijriOf('2026-10-29')).toEqual({ year: 1448, month: 5, day: 18 })
  })

  it('shifts by the offset exactly as the date shown on the Today page does', () => {
    // A positive offset moves the Hijri date later: Ramadan begins a civil day earlier.
    expect(hijriOf('2026-02-17', 1)).toEqual({ year: 1447, month: 9, day: 1 })
    expect(hijriOf('2026-03-19', 1)).toEqual({ year: 1447, month: 10, day: 1 })
    expect(hijriOf('2026-02-18', -1)).toEqual({ year: 1447, month: 8, day: 29 })
    expect(hijriOf('2026-03-20', -1)).toEqual({ year: 1447, month: 9, day: 30 })
    expect(hijriOf('2026-02-20', -2)).toEqual({ year: 1447, month: 9, day: 1 })

    for (const offset of [-2, -1, 0, 1, 2]) {
      const { day, year } = hijriOf('2026-10-29', offset)!
      const shown = formatHijri('2026-10-29', 'en-u-nu-latn', offset)
      expect(shown).toContain(String(day))
      expect(shown).toContain(String(year))
    }
  })

  it('treats an offset that is not a whole number as none', () => {
    expect(hijriOf('2026-02-18', 0.5)).toEqual(hijriOf('2026-02-18'))
    expect(hijriOf('2026-02-18', Number.NaN)).toEqual(hijriOf('2026-02-18'))
  })

  it('answers null for days that do not exist', () => {
    expect(hijriOf('2026-02-30')).toBeNull()
    expect(hijriOf('18/02/2026')).toBeNull()
    expect(hijriOf('__proto__')).toBeNull()
  })

  it('answers the same twice, from its cache', () => {
    const first = hijriOf('2026-04-01', 2)
    expect(hijriOf('2026-04-01', 2)).toEqual(first)
    expect(hijriOf('2026-04-03')).toEqual(first)
  })
})

describe('Ramadan', () => {
  it('knows the day of Ramadan, and that the days around it are not', () => {
    expect(ramadanDayOf('2026-02-17')).toBeNull()
    expect(ramadanDayOf('2026-02-18')).toBe(1)
    expect(ramadanDayOf('2026-03-01')).toBe(12)
    expect(ramadanDayOf('2026-03-19')).toBe(30)
    expect(ramadanDayOf('2026-03-20')).toBeNull()
    expect(isRamadan('2027-03-08')).toBe(true)
    expect(isRamadan('2027-03-09')).toBe(false)
  })

  it('moves with the offset', () => {
    expect(ramadanDayOf('2026-02-17', 1)).toBe(1)
    expect(ramadanDayOf('2026-03-19', 1)).toBeNull()
    expect(ramadanDayOf('2026-02-18', -1)).toBeNull()
    expect(ramadanDayOf('2026-03-20', -1)).toBe(30)
  })

  it('lists the civil days of a Hijri month', () => {
    const ramadan1447 = civilDaysOfHijriMonth(1447, 9)
    expect(ramadan1447).toHaveLength(30)
    expect(ramadan1447[0]).toBe('2026-02-18')
    expect(ramadan1447.at(-1)).toBe('2026-03-19')

    const ramadan1448 = civilDaysOfHijriMonth(1448, 9)
    expect(ramadan1448).toHaveLength(29)
    expect(ramadan1448[0]).toBe('2027-02-08')
    expect(ramadan1448.at(-1)).toBe('2027-03-08')

    expect(civilDaysOfHijriMonth(1448, 1)[0]).toBe('2026-06-16')
    expect(civilDaysOfHijriMonth(1448, 12)[0]).toBe('2027-05-07')
  })

  it('finds every month a day-by-day walk finds, decades either way and with every offset', () => {
    for (const offset of [-2, 0, 2]) {
      const walked = new Map<string, string[]>()
      for (let key = '1979-11-01'; key < '2077-12-01'; key = shiftDateKey(key, 1)) {
        const { year, month } = hijriOf(key, offset)!
        const id = `${year}-${month}`
        walked.set(id, [...(walked.get(id) ?? []), key])
      }
      // The first and last months walked are cut off by the range.
      const months = [...walked.entries()].slice(1, -1)
      expect(months.length).toBeGreaterThan(1200)
      for (const [id, days] of months) {
        const [year, month] = id.split('-').map(Number) as [number, number]
        expect(civilDaysOfHijriMonth(year, month, offset), id).toEqual(days)
      }
    }
  })

  it('lists them where the offset places them', () => {
    expect(civilDaysOfHijriMonth(1447, 9, 1)[0]).toBe('2026-02-17')
    expect(civilDaysOfHijriMonth(1447, 9, 1).at(-1)).toBe('2026-03-18')
    expect(civilDaysOfHijriMonth(1447, 9, -2)[0]).toBe('2026-02-20')
    expect(civilDaysOfHijriMonth(1447, 9, -2)).toHaveLength(30)
  })

  it('lists nothing for a month that does not exist', () => {
    expect(civilDaysOfHijriMonth(1447, 13)).toEqual([])
    expect(civilDaysOfHijriMonth(1447, 0)).toEqual([])
    expect(civilDaysOfHijriMonth(1447.5, 9)).toEqual([])
  })

  it('finds where a month begins', () => {
    expect(monthStartOf('2026-03-01')).toBe('2026-02-18')
    expect(monthStartOf('2026-03-01', 1)).toBe('2026-02-17')
    expect(monthStartOf('2026-02-30')).toBeNull()
  })
})

describe('labels', () => {
  it('names the Hijri month, year and day in either language', () => {
    expect(formatHijriMonth('2026-03-01', 'en')).toBe('Ramadan 1447 AH')
    expect(formatHijriYear('2026-10-29', 'en')).toBe('1448 AH')
    expect(formatHijriDayMonth('2026-10-24', 'en')).toBe('Jumada I 13')
    expect(formatHijriMonth('2026-03-01', 'ar-u-nu-latn')).toBe('رمضان 1447 هـ')
    expect(formatHijriDayMonth('2026-10-24', 'ar-u-nu-arab')).toBe('١٣ جمادى الأولى')
    expect(formatHijriMonth('2026-02-17', 'en', 1)).toBe('Ramadan 1447 AH')
  })
})

describe('on a runtime without the Umm al-Qura calendar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('knows no Hijri date rather than taking Gregorian months for Hijri ones', async () => {
    const Real = Intl.DateTimeFormat
    // Such a runtime silently falls back to the Gregorian calendar.
    const Fallback = function (locale?: string, options?: Intl.DateTimeFormatOptions) {
      return new Real(locale?.replace('-ca-islamic-umalqura', ''), { ...options, calendar: 'gregory' })
    } as unknown as typeof Intl.DateTimeFormat
    vi.stubGlobal('Intl', { ...Intl, DateTimeFormat: Fallback })
    vi.resetModules()
    const fresh = await import('./hijri')

    expect(fresh.hijriOf('2026-09-15')).toBeNull()
    expect(fresh.ramadanDayOf('2026-09-15')).toBeNull()
    expect(fresh.civilDaysOfHijriMonth(1447, 9)).toEqual([])
  })
})
