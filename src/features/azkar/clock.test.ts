import { describe, expect, it, vi } from 'vitest'
import type { PrayerDay } from '../../shared/types'
import { dayPhase, recommendedCollection, sessionDateKey } from './clock'

vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

/** Plausible times for Makkah on 12 October 2026. Asia/Riyadh is UTC+3 all year, so the test cannot drift with DST rules. */
const ZONE = 'Asia/Riyadh'

function makkahDay(overrides: Partial<PrayerDay['times']> = {}): PrayerDay {
  return {
    dateKey: '2026-10-12',
    timeZone: ZONE,
    times: {
      fajr: new Date('2026-10-12T01:58:00Z'),
      sunrise: new Date('2026-10-12T03:15:00Z'),
      dhuhr: new Date('2026-10-12T09:07:00Z'),
      asr: new Date('2026-10-12T12:27:00Z'),
      maghrib: new Date('2026-10-12T14:56:00Z'),
      isha: new Date('2026-10-12T16:26:00Z'),
      ...overrides,
    },
  }
}

describe('dayPhase with prayer times', () => {
  const day = makkahDay()
  const at = (iso: string) => dayPhase(new Date(iso), ZONE, day)

  it('is still last night until Fajr', () => {
    expect(at('2026-10-11T21:05:00Z')).toBe('beforeDawn') // 00:05 local on the 12th
    expect(at('2026-10-12T01:57:59Z')).toBe('beforeDawn')
  })

  it('is morning from Fajr until Dhuhr', () => {
    expect(at('2026-10-12T01:58:00Z')).toBe('morning')
    expect(at('2026-10-12T09:06:59Z')).toBe('morning')
  })

  it('is midday from Dhuhr until Asr', () => {
    expect(at('2026-10-12T09:07:00Z')).toBe('midday')
    expect(at('2026-10-12T12:26:59Z')).toBe('midday')
  })

  it('is evening from Asr to the end of the calendar day', () => {
    expect(at('2026-10-12T12:27:00Z')).toBe('evening')
    expect(at('2026-10-12T20:59:00Z')).toBe('evening') // 23:59 local
  })

  it('ignores times that belong to another day', () => {
    // 00:30 local on the 13th, but the times are still the 12th's: the clock decides.
    expect(at('2026-10-12T21:30:00Z')).toBe('beforeDawn')
    // 10:00 local on the 13th would read as "evening" against the 12th's Asr.
    expect(at('2026-10-13T07:00:00Z')).toBe('morning')
  })

  it('falls back to the clock when a time could not be computed', () => {
    const broken = makkahDay({ fajr: new Date(Number.NaN) })
    expect(dayPhase(new Date('2026-10-12T00:30:00Z'), ZONE, broken)).toBe('beforeDawn') // 03:30 local
    // 04:10 local is before the real Fajr above, so "morning" can only come from the clock rule.
    expect(dayPhase(new Date('2026-10-12T01:10:00Z'), ZONE, broken)).toBe('morning')
  })
})

describe('dayPhase without prayer times', () => {
  it('uses the clock of the given zone, not the device', () => {
    const instant = new Date('2026-10-12T01:00:00Z')
    expect(dayPhase(instant, 'Asia/Tokyo', null)).toBe('morning') // 10:00
    expect(dayPhase(instant, 'UTC', null)).toBe('beforeDawn') // 01:00
    expect(dayPhase(instant, 'America/New_York', null)).toBe('evening') // 21:00 the day before
  })

  it('splits the day at 4, 12 and 15 o’clock', () => {
    const at = (time: string) => dayPhase(new Date(`2026-10-12T${time}:00Z`), 'UTC', null)
    expect(at('03:59')).toBe('beforeDawn')
    expect(at('04:00')).toBe('morning')
    expect(at('11:59')).toBe('morning')
    expect(at('12:00')).toBe('midday')
    expect(at('14:59')).toBe('midday')
    expect(at('15:00')).toBe('evening')
    expect(at('23:59')).toBe('evening')
  })
})

describe('recommendedCollection', () => {
  it('recommends the morning azkar in the morning and the evening azkar from Asr through the night', () => {
    expect(recommendedCollection('morning')).toBe('morning')
    expect(recommendedCollection('midday')).toBeNull()
    expect(recommendedCollection('evening')).toBe('evening')
    expect(recommendedCollection('beforeDawn')).toBe('evening')
  })
})

describe('sessionDateKey', () => {
  it('files night sessions read after midnight under the evening they belong to', () => {
    expect(sessionDateKey('evening', '2026-10-12', 'beforeDawn')).toBe('2026-10-11')
    expect(sessionDateKey('sleep', '2026-11-01', 'beforeDawn')).toBe('2026-10-31')
    expect(sessionDateKey('evening', '2027-01-01', 'beforeDawn')).toBe('2026-12-31')
  })

  it('uses the calendar day from Fajr onwards', () => {
    expect(sessionDateKey('evening', '2026-10-12', 'morning')).toBe('2026-10-12')
    expect(sessionDateKey('evening', '2026-10-12', 'evening')).toBe('2026-10-12')
    expect(sessionDateKey('sleep', '2026-10-12', 'evening')).toBe('2026-10-12')
  })

  it('keeps the morning session on the calendar day at all hours', () => {
    expect(sessionDateKey('morning', '2026-10-12', 'beforeDawn')).toBe('2026-10-12')
    expect(sessionDateKey('morning', '2026-10-12', 'morning')).toBe('2026-10-12')
  })
})
