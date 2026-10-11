import { afterEach, describe, expect, it } from 'vitest'
import { dateKeyInZone, deviceTimeZone, shiftDateKey, zonedParts } from '../../../shared/date'
import { PRAYERS, TIME_SLOTS } from '../../../shared/types'
import type { PrayerDay, TimeSlot } from '../../../shared/types'
import {
  clampAdjustment,
  computePrayerDay,
  DEFAULT_CALCULATION,
  hasMissingTimes,
  isUmmAlQuraRamadan,
  isValidTime,
  resolveHighLatitudeRule,
} from './compute'
import type { CalculationConfig, Place } from './compute'
import { setDeviceZone as moveDevice, restoreDeviceZone } from '../test-helpers'

const CAIRO: Place = { latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo', countryCode: 'EG' }
const MAKKAH: Place = { latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh', countryCode: 'SA' }
const NEW_YORK: Place = { latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York', countryCode: 'US' }
const SYDNEY: Place = { latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney', countryCode: 'AU' }
const LONDON: Place = { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London', countryCode: 'GB' }
const KARACHI: Place = { latitude: 24.8607, longitude: 67.0011, timeZone: 'Asia/Karachi', countryCode: 'PK' }
const HONOLULU: Place = { latitude: 21.3069, longitude: -157.8583, timeZone: 'Pacific/Honolulu', countryCode: 'US' }
const KIRITIMATI: Place = { latitude: 1.8721, longitude: -157.4278, timeZone: 'Pacific/Kiritimati', countryCode: 'KI' }
const APIA: Place = { latitude: -13.8333, longitude: -171.7667, timeZone: 'Pacific/Apia', countryCode: 'WS' }
const AUCKLAND: Place = { latitude: -36.8485, longitude: 174.7633, timeZone: 'Pacific/Auckland', countryCode: 'NZ' }
const TROMSO: Place = { latitude: 69.6492, longitude: 18.9553, timeZone: 'Europe/Oslo', countryCode: 'NO' }

const config = (overrides: Partial<CalculationConfig> = {}): CalculationConfig => ({ ...DEFAULT_CALCULATION, ...overrides })

function clock(day: PrayerDay, slot: TimeSlot): string {
  const { hour, minute } = zonedParts(day.times[slot], day.timeZone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function instants(day: PrayerDay): string[] {
  return TIME_SLOTS.map((slot) => day.times[slot].toISOString())
}

/** Device zones chosen to break naive date handling: both sides of the date line, half-hour offsets, odd DST. */
const DEVICE_ZONES = [
  'UTC',
  'Pacific/Kiritimati', // UTC+14
  'Pacific/Pago_Pago', // UTC-11
  'Pacific/Auckland', // UTC+12 / +13
  'America/Los_Angeles',
  'America/St_Johns', // UTC-3:30
  'Asia/Kathmandu', // UTC+5:45
  'Australia/Lord_Howe', // 30-minute DST
  'Africa/Cairo', // DST starts at midnight
  'America/Santiago', // DST starts at midnight, southern hemisphere
]

function setDeviceZone(zone: string) {
  moveDevice(zone)
  // Guards the suite itself: if the runtime ignored the change, every case below would pass vacuously.
  // (Compared by behaviour, since the runtime may report an alias such as Asia/Katmandu.)
  expect(zonedParts(new Date(2026, 0, 15, 12, 0), zone)).toMatchObject({ day: 15, hour: 12, minute: 0 })
  expect(zonedParts(new Date(2026, 6, 15, 12, 0), deviceTimeZone())).toMatchObject({ day: 15, hour: 12, minute: 0 })
}

afterEach(restoreDeviceZone)

describe('calendar day, whatever zone the device is in', () => {
  const cases: Array<[string, Place, string]> = [
    ['Cairo', CAIRO, '2026-07-15'],
    ['Makkah', MAKKAH, '2026-01-01'],
    ['New York', NEW_YORK, '2026-12-31'],
    ['Sydney', SYDNEY, '2026-02-28'],
    ['Honolulu', HONOLULU, '2026-10-12'],
    ['Kiritimati', KIRITIMATI, '2026-10-12'],
    ['Auckland', AUCKLAND, '2026-01-10'],
  ]

  it.each(cases)('%s gives identical instants from every device zone', (_name, place, dateKey) => {
    setDeviceZone('UTC')
    const baseline = instants(computePrayerDay(dateKey, place, config()))
    for (const zone of DEVICE_ZONES) {
      setDeviceZone(zone)
      expect(instants(computePrayerDay(dateKey, place, config())), `device in ${zone}`).toEqual(baseline)
    }
  })

  it.each(cases)('%s: every time falls on the requested day in the location’s zone', (_name, place, dateKey) => {
    for (const zone of DEVICE_ZONES) {
      setDeviceZone(zone)
      const day = computePrayerDay(dateKey, place, config())
      for (const slot of TIME_SLOTS) {
        expect(dateKeyInZone(day.times[slot], place.timeZone), `${slot}, device in ${zone}`).toBe(dateKey)
      }
    }
  })

  it('keeps the times in order through the day', () => {
    for (const place of [CAIRO, MAKKAH, NEW_YORK, SYDNEY, LONDON, KARACHI, KIRITIMATI, APIA]) {
      const times = TIME_SLOTS.map((slot) => computePrayerDay('2026-10-12', place, config()).times[slot].getTime())
      expect(times, place.timeZone).toEqual([...times].sort((a, b) => a - b))
    }
  })
})

describe('daylight saving changes', () => {
  it('shifts the wall clock, not the sun, when New York springs forward', () => {
    setDeviceZone('America/New_York')
    const before = computePrayerDay('2026-03-07', NEW_YORK, config())
    const after = computePrayerDay('2026-03-08', NEW_YORK, config())
    // Fajr reads an hour later on the clock...
    expect(clock(before, 'fajr')).toBe('05:06')
    expect(clock(after, 'fajr')).toBe('06:04')
    // ...but arrives a minute or two earlier than 24 hours on, as it does every day in March.
    const gap = after.times.fajr.getTime() - before.times.fajr.getTime()
    expect(gap).toBeGreaterThan(23 * 3_600_000 + 55 * 60_000)
    expect(gap).toBeLessThan(24 * 3_600_000)
  })

  it('is unaffected by the device changing its own clocks that day', () => {
    setDeviceZone('UTC')
    const baseline = {
      spring: instants(computePrayerDay('2026-03-08', CAIRO, config())),
      autumn: instants(computePrayerDay('2026-11-01', CAIRO, config())),
      cairoSpring: instants(computePrayerDay('2026-04-24', CAIRO, config())),
      sydney: instants(computePrayerDay('2026-10-04', SYDNEY, config())),
    }
    setDeviceZone('America/New_York')
    expect(instants(computePrayerDay('2026-03-08', CAIRO, config()))).toEqual(baseline.spring)
    expect(instants(computePrayerDay('2026-11-01', CAIRO, config()))).toEqual(baseline.autumn)
    // Egypt skips midnight itself on this day; a Date built at local midnight would not exist.
    setDeviceZone('Africa/Cairo')
    expect(instants(computePrayerDay('2026-04-24', CAIRO, config()))).toEqual(baseline.cairoSpring)
    setDeviceZone('Australia/Sydney')
    expect(instants(computePrayerDay('2026-10-04', SYDNEY, config()))).toEqual(baseline.sydney)
  })

  it('gives consecutive days roughly 24 hours apart across both changes', () => {
    for (const [place, dateKey] of [
      [NEW_YORK, '2026-03-08'],
      [NEW_YORK, '2026-11-01'],
      [SYDNEY, '2026-10-04'],
      [SYDNEY, '2026-04-05'],
      [LONDON, '2026-03-29'],
      [CAIRO, '2026-10-29'],
    ] as const) {
      const today = computePrayerDay(dateKey, place, config())
      const tomorrow = computePrayerDay(shiftDateKey(dateKey, 1), place, config())
      for (const prayer of PRAYERS) {
        const gapMinutes = (tomorrow.times[prayer].getTime() - today.times[prayer].getTime()) / 60_000
        expect(Math.abs(gapMinutes - 1440), `${prayer} at ${place.timeZone} on ${dateKey}`).toBeLessThan(5)
      }
    }
  })
})

describe('places either side of the date line', () => {
  it('puts the same calendar day a full day apart at the same longitude', () => {
    // Kiritimati (UTC+14) and Honolulu (UTC-10) see the sun at the same moment but name the day differently.
    const kiritimati = computePrayerDay('2026-10-12', KIRITIMATI, config({ method: 'MuslimWorldLeague' }))
    const honolulu = computePrayerDay('2026-10-12', HONOLULU, config({ method: 'MuslimWorldLeague' }))
    const hoursApart = (honolulu.times.dhuhr.getTime() - kiritimati.times.dhuhr.getTime()) / 3_600_000
    expect(hoursApart).toBeGreaterThan(23.9)
    expect(hoursApart).toBeLessThan(24.1)
  })

  it('anchors Samoa (UTC+13, west of the line) to its own calendar day', () => {
    const day = computePrayerDay('2026-10-12', APIA, config())
    expect(dateKeyInZone(day.times.fajr, APIA.timeZone)).toBe('2026-10-12')
    expect(dateKeyInZone(day.times.isha, APIA.timeZone)).toBe('2026-10-12')
    expect(clock(day, 'dhuhr')).toMatch(/^12:1\d$/)
  })

  it('moves one solar day per calendar day there too', () => {
    const today = computePrayerDay('2026-10-12', KIRITIMATI, config())
    const tomorrow = computePrayerDay('2026-10-13', KIRITIMATI, config())
    const gapMinutes = (tomorrow.times.dhuhr.getTime() - today.times.dhuhr.getTime()) / 60_000
    expect(Math.abs(gapMinutes - 1440)).toBeLessThan(2)
  })
})

describe('settings', () => {
  it('applies each minute adjustment to its own time only', () => {
    const base = computePrayerDay('2026-07-15', CAIRO, config())
    const adjusted = computePrayerDay(
      '2026-07-15',
      CAIRO,
      config({ adjustments: { fajr: -3, sunrise: 2, dhuhr: 5, asr: 0, maghrib: 4, isha: -30 } }),
    )
    const shift = (slot: TimeSlot) => (adjusted.times[slot].getTime() - base.times[slot].getTime()) / 60_000
    expect(TIME_SLOTS.map(shift)).toEqual([-3, 2, 5, 0, 4, -30])
  })

  it('clamps adjustments to thirty minutes and ignores junk', () => {
    expect(clampAdjustment(45)).toBe(30)
    expect(clampAdjustment(-31)).toBe(-30)
    expect(clampAdjustment(2.6)).toBe(3)
    expect(clampAdjustment(Number.NaN)).toBe(0)
    expect(clampAdjustment(Number.POSITIVE_INFINITY)).toBe(0)

    const base = computePrayerDay('2026-07-15', CAIRO, config())
    const wild = computePrayerDay(
      '2026-07-15',
      CAIRO,
      config({ adjustments: { fajr: 500, sunrise: 0, dhuhr: Number.NaN, asr: 0, maghrib: 0, isha: 0 } }),
    )
    expect((wild.times.fajr.getTime() - base.times.fajr.getTime()) / 60_000).toBe(30)
    expect(wild.times.dhuhr.getTime()).toBe(base.times.dhuhr.getTime())
  })

  it('moves only Asr, later, for the Hanafi school', () => {
    const shafi = computePrayerDay('2026-01-05', KARACHI, config({ madhab: 'shafi' }))
    const hanafi = computePrayerDay('2026-01-05', KARACHI, config({ madhab: 'hanafi' }))
    expect(clock(hanafi, 'asr')).toBe('16:21')
    const laterBy = (hanafi.times.asr.getTime() - shafi.times.asr.getTime()) / 60_000
    expect(laterBy).toBeGreaterThan(30)
    expect(laterBy).toBeLessThan(90)
    for (const slot of TIME_SLOTS) {
      if (slot !== 'asr') expect(hanafi.times[slot].getTime()).toBe(shafi.times[slot].getTime())
    }
  })

  it('resolves the automatic method from the country', () => {
    const auto = computePrayerDay('2026-07-15', CAIRO, config({ method: 'auto' }))
    expect(instants(auto)).toEqual(instants(computePrayerDay('2026-07-15', CAIRO, config({ method: 'Egyptian' }))))
    expect(instants(auto)).not.toEqual(
      instants(computePrayerDay('2026-07-15', CAIRO, config({ method: 'MuslimWorldLeague' }))),
    )
  })

  it('picks the one-seventh rule above 48° in either hemisphere, the middle of the night below', () => {
    expect(resolveHighLatitudeRule('auto', 51.5)).toBe('seventhofthenight')
    expect(resolveHighLatitudeRule('auto', -54.8)).toBe('seventhofthenight')
    expect(resolveHighLatitudeRule('auto', 30)).toBe('middleofthenight')
    expect(resolveHighLatitudeRule('auto', -33.9)).toBe('middleofthenight')
    expect(resolveHighLatitudeRule('twilightangle', 60)).toBe('twilightangle')
  })

  it('lets the high-latitude rule bound a London summer night', () => {
    const rule = (highLatitudeRule: CalculationConfig['highLatitudeRule']) =>
      computePrayerDay('2026-06-21', LONDON, config({ method: 'MuslimWorldLeague', highLatitudeRule }))
    expect(clock(rule('auto'), 'fajr')).toBe(clock(rule('seventhofthenight'), 'fajr'))
    expect(clock(rule('seventhofthenight'), 'fajr')).toBe('03:40')
    expect(rule('middleofthenight').times.fajr.getTime()).toBeLessThan(rule('seventhofthenight').times.fajr.getTime())
    expect(rule('middleofthenight').times.isha.getTime()).toBeGreaterThan(rule('seventhofthenight').times.isha.getTime())
  })
})

describe('Umm al-Qura in Ramadan', () => {
  const ishaAfterMaghrib = (dateKey: string, place: Place, overrides: Partial<CalculationConfig> = {}) => {
    const day = computePrayerDay(dateKey, place, config(overrides))
    return (day.times.isha.getTime() - day.times.maghrib.getTime()) / 60_000
  }

  it('knows the month from the Umm al-Qura calendar', () => {
    expect(isUmmAlQuraRamadan('2026-02-17')).toBe(false)
    expect(isUmmAlQuraRamadan('2026-02-18')).toBe(true)
    expect(isUmmAlQuraRamadan('2026-03-19')).toBe(true)
    expect(isUmmAlQuraRamadan('2026-03-20')).toBe(false)
    expect(isUmmAlQuraRamadan('2026-09-09')).toBe(false)
  })

  it('holds Isha two hours after Maghrib during Ramadan and ninety minutes otherwise', () => {
    expect(ishaAfterMaghrib('2026-02-17', MAKKAH)).toBe(90)
    expect(ishaAfterMaghrib('2026-02-18', MAKKAH)).toBe(120)
    expect(ishaAfterMaghrib('2026-03-19', MAKKAH)).toBe(120)
    expect(ishaAfterMaghrib('2026-03-20', MAKKAH)).toBe(90)
  })

  it('adds the user’s own Isha adjustment on top', () => {
    const adjustments = { ...DEFAULT_CALCULATION.adjustments, isha: 5 }
    expect(ishaAfterMaghrib('2026-03-01', MAKKAH, { adjustments })).toBe(125)
  })

  it('leaves other methods alone', () => {
    expect(ishaAfterMaghrib('2026-03-01', MAKKAH, { method: 'Qatar' })).toBe(90)
    const egyptian = (dateKey: string) => clock(computePrayerDay(dateKey, CAIRO, config()), 'isha')
    expect(egyptian('2026-03-01')).toBe(clock(computePrayerDay('2026-03-01', CAIRO, config({ method: 'Egyptian' })), 'isha'))
  })
})

describe('days without a sunrise or sunset', () => {
  it('yields Invalid Dates rather than throwing under the midnight sun', () => {
    const day = computePrayerDay('2026-06-21', TROMSO, config())
    expect(isValidTime(day.times.dhuhr)).toBe(true)
    for (const slot of ['fajr', 'sunrise', 'maghrib', 'isha'] as const) {
      expect(isValidTime(day.times[slot]), slot).toBe(false)
    }
    expect(hasMissingTimes(day)).toBe(true)
  })

  it('does the same in the polar night, for every method and rule', () => {
    for (const method of ['MuslimWorldLeague', 'MoonsightingCommittee', 'UmmAlQura', 'Tehran'] as const) {
      for (const highLatitudeRule of ['auto', 'middleofthenight', 'seventhofthenight', 'twilightangle'] as const) {
        const day = computePrayerDay('2026-12-21', TROMSO, config({ method, highLatitudeRule }))
        expect(isValidTime(day.times.sunrise)).toBe(false)
        expect(hasMissingTimes(day)).toBe(true)
      }
    }
  })

  it('fills every time from the nearest latitude when asked to', () => {
    for (const dateKey of ['2026-06-21', '2026-12-21']) {
      const day = computePrayerDay(dateKey, TROMSO, config({ polar: 'nearestLatitude' }))
      expect(hasMissingTimes(day), dateKey).toBe(false)
    }
  })

  it('reports nothing missing at ordinary latitudes', () => {
    expect(hasMissingTimes(computePrayerDay('2026-06-21', LONDON, config()))).toBe(false)
    expect(hasMissingTimes(computePrayerDay('2026-12-21', CAIRO, config()))).toBe(false)
  })

  it('treats anything that is not a real Date as missing', () => {
    expect(isValidTime(new Date(Number.NaN))).toBe(false)
    expect(isValidTime(null)).toBe(false)
    expect(isValidTime(undefined)).toBe(false)
    expect(isValidTime(new Date(0))).toBe(true)
  })
})
