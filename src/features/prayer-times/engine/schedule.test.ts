import { describe, expect, it } from 'vitest'
import { shiftDateKey } from '../../../shared/date'
import type { DateKey, PrayerDay, UpcomingPrayer } from '../../../shared/types'
import { CAIRO, REYKJAVIK, TROMSO, zonedInstant } from '../test-helpers'
import { computePrayerDay, DEFAULT_CALCULATION } from './compute'
import type { Place } from './compute'
import { buildTimeline, currentPrayerAt, nextPrayerAt } from './schedule'

const TODAY: DateKey = '2026-10-12'

function around(place: Place, today: DateKey, overrides = {}): PrayerDay[] {
  const config = { ...DEFAULT_CALCULATION, ...overrides }
  return [-1, 0, 1].map((offset) => computePrayerDay(shiftDateKey(today, offset), place, config))
}

const days = around(CAIRO, TODAY)
const timeline = buildTimeline(days)
const today = days[1] as PrayerDay

const at = (clock: string, dateKey: DateKey = TODAY) => zonedInstant(dateKey, clock, 'Africa/Cairo')
const next = (now: Date) => nextPrayerAt(timeline, now)
const current = (now: Date) => currentPrayerAt(timeline, days, now)
const brief = (entry: UpcomingPrayer | null) => entry && `${entry.prayer} ${entry.dateKey}`

describe('next prayer', () => {
  it('is today’s Fajr in the small hours', () => {
    expect(brief(next(at('00:00')))).toBe('fajr 2026-10-12')
    expect(brief(next(at('03:30')))).toBe('fajr 2026-10-12')
    expect(next(at('03:30'))?.at).toBe(today.times.fajr)
  })

  it('never offers sunrise', () => {
    const afterFajr = new Date(today.times.fajr.getTime() + 60_000)
    const afterSunrise = new Date(today.times.sunrise.getTime() + 60_000)
    expect(brief(next(afterFajr))).toBe('dhuhr 2026-10-12')
    expect(brief(next(afterSunrise))).toBe('dhuhr 2026-10-12')
    expect(timeline.every((entry) => (entry.prayer as string) !== 'sunrise')).toBe(true)
  })

  it('moves on at the very instant a prayer begins', () => {
    const maghrib = today.times.maghrib.getTime()
    expect(brief(next(new Date(maghrib - 1)))).toBe('maghrib 2026-10-12')
    expect(brief(next(new Date(maghrib)))).toBe('isha 2026-10-12')
  })

  it('rolls over to tomorrow’s Fajr after Isha, and keeps it across midnight', () => {
    const isha = today.times.isha.getTime()
    const tomorrowFajr = (days[2] as PrayerDay).times.fajr
    expect(brief(next(new Date(isha - 1)))).toBe('isha 2026-10-12')
    for (const now of [new Date(isha), at('23:59:59'), at('00:00', '2026-10-13'), at('02:00', '2026-10-13')]) {
      const upcoming = next(now)
      expect(brief(upcoming)).toBe('fajr 2026-10-13')
      expect(upcoming?.at).toBe(tomorrowFajr)
    }
  })

  it('is null once the known days are used up', () => {
    expect(next(at('23:00', '2026-10-13'))).toBeNull()
    expect(nextPrayerAt([], at('12:00'))).toBeNull()
  })
})

describe('current prayer', () => {
  it('is last night’s Isha until Fajr', () => {
    expect(brief(current(at('02:00')))).toBe('isha 2026-10-11')
  })

  it('is Fajr only until sunrise, then nothing until Dhuhr', () => {
    expect(brief(current(new Date(today.times.fajr.getTime())))).toBe('fajr 2026-10-12')
    expect(brief(current(new Date(today.times.sunrise.getTime() - 1)))).toBe('fajr 2026-10-12')
    expect(current(new Date(today.times.sunrise.getTime()))).toBeNull()
    expect(current(at('09:00'))).toBeNull()
    expect(brief(current(new Date(today.times.dhuhr.getTime())))).toBe('dhuhr 2026-10-12')
  })

  it('follows the afternoon and evening', () => {
    expect(brief(current(at('15:00')))).toBe('dhuhr 2026-10-12')
    expect(brief(current(new Date(today.times.asr.getTime() + 1)))).toBe('asr 2026-10-12')
    expect(brief(current(new Date(today.times.maghrib.getTime() + 1)))).toBe('maghrib 2026-10-12')
    expect(brief(current(at('23:30')))).toBe('isha 2026-10-12')
  })

  it('is null before the first known time', () => {
    expect(current(at('00:30', '2026-10-11'))).toBeNull()
  })
})

describe('timeline', () => {
  it('is chronological whatever order the days arrive in', () => {
    const shuffled = buildTimeline([days[2] as PrayerDay, days[0] as PrayerDay, days[1] as PrayerDay])
    expect(shuffled.map(brief)).toEqual(timeline.map(brief))
    expect(timeline).toHaveLength(15)
    const instants = timeline.map((entry) => entry.at.getTime())
    expect(instants).toEqual([...instants].sort((a, b) => a - b))
  })

  it('still finds yesterday’s Isha when it falls after midnight', () => {
    // Reykjavík at the solstice: the 21st's Maghrib and Isha arrive in the first half-hour of the 22nd.
    const zone = REYKJAVIK.timeZone
    const north = around(REYKJAVIK, '2026-06-22', { method: 'MuslimWorldLeague', highLatitudeRule: 'seventhofthenight' })
    const northTimeline = buildTimeline(north)
    const now = zonedInstant('2026-06-22', '00:10', zone)
    expect(brief(nextPrayerAt(northTimeline, now))).toBe('isha 2026-06-21')
    expect(brief(currentPrayerAt(northTimeline, north, now))).toBe('maghrib 2026-06-21')
    expect(brief(nextPrayerAt(northTimeline, zonedInstant('2026-06-22', '01:30', zone)))).toBe('fajr 2026-06-22')
  })

  it('skips times that do not exist and claims no current prayer on such a day', () => {
    const polar = around(TROMSO, '2026-06-21', { method: 'MuslimWorldLeague' })
    const polarTimeline = buildTimeline(polar)
    expect(polarTimeline.every((entry) => !Number.isNaN(entry.at.getTime()))).toBe(true)
    expect(new Set(polarTimeline.map((entry) => entry.prayer))).toEqual(new Set(['dhuhr', 'asr']))
    const evening = zonedInstant('2026-06-21', '22:00', 'Europe/Oslo')
    expect(brief(nextPrayerAt(polarTimeline, evening))).toBe('dhuhr 2026-06-22')
    expect(currentPrayerAt(polarTimeline, polar, evening)).toBeNull()
  })
})
