import { describe, expect, it } from 'vitest'
import type { PrayerDay } from '../../shared/types'
import { isBeforeDawn, sunnahDateKey } from './night'

const ZONE = 'Asia/Riyadh'

/** 13 October in Riyadh (UTC+3), with Fajr at 04:59 local unless told otherwise. */
function day(fajr: Date = new Date('2026-10-13T01:59:00Z')): PrayerDay {
  const later = new Date('2026-10-13T09:00:00Z')
  return {
    dateKey: '2026-10-13',
    timeZone: ZONE,
    times: { fajr, sunrise: later, dhuhr: later, asr: later, maghrib: later, isha: later },
  }
}

describe('isBeforeDawn', () => {
  it('lasts from midnight until the day’s Fajr', () => {
    expect(isBeforeDawn(new Date('2026-10-12T21:00:00Z'), ZONE, day())).toBe(true) // 00:00
    expect(isBeforeDawn(new Date('2026-10-13T01:58:59Z'), ZONE, day())).toBe(true) // 04:58:59
    expect(isBeforeDawn(new Date('2026-10-13T01:59:00Z'), ZONE, day())).toBe(false) // Fajr
    expect(isBeforeDawn(new Date('2026-10-13T16:28:00Z'), ZONE, day())).toBe(false) // evening
  })

  it('follows the real Fajr rather than the clock when it is early or late', () => {
    const early = day(new Date('2026-10-12T23:10:00Z')) // 02:10
    expect(isBeforeDawn(new Date('2026-10-12T23:30:00Z'), ZONE, early)).toBe(false) // 02:30
    const late = day(new Date('2026-10-13T03:30:00Z')) // 06:30
    expect(isBeforeDawn(new Date('2026-10-13T02:30:00Z'), ZONE, late)).toBe(true) // 05:30
  })

  it('uses 4 am local when Fajr cannot be computed or no timetable is known', () => {
    for (const today of [day(new Date(Number.NaN)), null]) {
      expect(isBeforeDawn(new Date('2026-10-13T00:59:00Z'), ZONE, today)).toBe(true) // 03:59
      expect(isBeforeDawn(new Date('2026-10-13T01:00:00Z'), ZONE, today)).toBe(false) // 04:00
      expect(isBeforeDawn(new Date('2026-10-13T20:30:00Z'), ZONE, today)).toBe(false) // 23:30
    }
  })
})

describe('sunnahDateKey', () => {
  it('files the prayers of the night under the day before until Fajr', () => {
    for (const sunnah of ['witr', 'qiyam', 'afterIsha'] as const) {
      expect(sunnahDateKey(sunnah, '2026-10-13', true)).toBe('2026-10-12')
      expect(sunnahDateKey(sunnah, '2026-10-13', false)).toBe('2026-10-13')
    }
  })

  it('files the prayers of the day under today, before Fajr too', () => {
    for (const sunnah of ['beforeFajr', 'duha', 'beforeDhuhr', 'afterDhuhr', 'afterMaghrib'] as const) {
      expect(sunnahDateKey(sunnah, '2026-10-13', true)).toBe('2026-10-13')
      expect(sunnahDateKey(sunnah, '2026-10-13', false)).toBe('2026-10-13')
    }
  })

  it('steps back across the turn of a month and a year', () => {
    expect(sunnahDateKey('witr', '2026-03-01', true)).toBe('2026-02-28')
    expect(sunnahDateKey('qiyam', '2027-01-01', true)).toBe('2026-12-31')
  })
})
