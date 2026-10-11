import { describe, expect, it } from 'vitest'
import {
  dateKeyInZone,
  daysBetween,
  formatClock,
  formatDateKey,
  formatHijri,
  isValidDateKey,
  shiftDateKey,
  weekdayOfDateKey,
  zonedParts,
} from './date'

describe('dateKeyInZone', () => {
  it('reads the calendar day in the requested zone, not the device zone', () => {
    const instant = new Date('2026-03-10T22:30:00Z')
    expect(dateKeyInZone(instant, 'UTC')).toBe('2026-03-10')
    expect(dateKeyInZone(instant, 'Asia/Tokyo')).toBe('2026-03-11')
    expect(dateKeyInZone(instant, 'America/Los_Angeles')).toBe('2026-03-10')
  })

  it('reports midnight as hour 0', () => {
    expect(zonedParts(new Date('2026-01-01T00:00:00Z'), 'UTC')).toMatchObject({ hour: 0, minute: 0, day: 1 })
  })
})

describe('date key arithmetic', () => {
  it('shifts across month, year and leap-day boundaries', () => {
    expect(shiftDateKey('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDateKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDateKey('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('counts whole days between keys', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7)
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7)
  })

  it('knows the weekday', () => {
    expect(weekdayOfDateKey('2026-10-11')).toBe(0)
    expect(weekdayOfDateKey('2026-10-16')).toBe(5)
  })

  it('rejects malformed and impossible keys', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-2-3')).toBe(false)
    expect(isValidDateKey('nope')).toBe(false)
  })
})

describe('formatting', () => {
  it('formats a key without the device zone moving the day', () => {
    expect(formatDateKey('2026-10-11', 'en')).toBe('Sunday, October 11')
  })

  it('formats clocks in the given zone and cycle', () => {
    const instant = new Date('2026-10-11T02:05:00Z')
    expect(formatClock(instant, 'en', 'Africa/Cairo', false)).toBe('05:05')
    expect(formatClock(instant, 'en', 'Africa/Cairo', true)).toMatch(/^5:05\sAM$/)
  })

  it('formats the Hijri date and honours the offset', () => {
    const base = formatHijri('2026-10-11', 'en')
    expect(base).toMatch(/1448/)
    expect(formatHijri('2026-10-11', 'en', 1)).toBe(formatHijri('2026-10-12', 'en'))
    expect(formatHijri('2026-10-11', 'en', 1)).not.toBe(base)
  })
})
