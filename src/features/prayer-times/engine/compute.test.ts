import { CalculationMethod, Coordinates, PolarCircleResolution, PrayerTimes } from 'adhan'
import { afterEach, describe, expect, it } from 'vitest'
import { dateKeyInZone, deviceTimeZone, partsOfDateKey, shiftDateKey, zonedParts } from '../../../shared/date'
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
import type { MethodId } from './methods'
import { asrInstant, solarAltitude, solarTransit } from './solar'
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
const STOCKHOLM: Place = { latitude: 59.3293, longitude: 18.0686, timeZone: 'Europe/Stockholm', countryCode: 'SE' }
const BERLIN: Place = { latitude: 52.52, longitude: 13.405, timeZone: 'Europe/Berlin', countryCode: 'DE' }
const EDMONTON: Place = { latitude: 53.5461, longitude: -113.4938, timeZone: 'America/Edmonton', countryCode: 'CA' }
const TROMSO: Place = { latitude: 69.6492, longitude: 18.9553, timeZone: 'Europe/Oslo', countryCode: 'NO' }
const MURMANSK: Place = { latitude: 68.9585, longitude: 33.0827, timeZone: 'Europe/Moscow', countryCode: 'RU' }
const ROVANIEMI: Place = { latitude: 66.5039, longitude: 25.7294, timeZone: 'Europe/Helsinki', countryCode: 'FI' }
const KIRUNA: Place = { latitude: 67.8558, longitude: 20.2253, timeZone: 'Europe/Stockholm', countryCode: 'SE' }
const LONGYEARBYEN: Place = { latitude: 78.2232, longitude: 15.6267, timeZone: 'Arctic/Longyearbyen', countryCode: 'NO' }
const MCMURDO: Place = { latitude: -77.8419, longitude: 166.6863, timeZone: 'Antarctica/McMurdo', countryCode: 'AQ' }
const ISTANBUL: Place = { latitude: 41.0082, longitude: 28.9784, timeZone: 'Europe/Istanbul', countryCode: 'TR' }

const config = (overrides: Partial<CalculationConfig> = {}): CalculationConfig => ({ ...DEFAULT_CALCULATION, ...overrides })

function clock(day: PrayerDay, slot: TimeSlot): string {
  const { hour, minute } = zonedParts(day.times[slot], day.timeZone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function instants(day: PrayerDay): string[] {
  return TIME_SLOTS.map((slot) => day.times[slot].toISOString())
}

/** adhan asked directly, with nothing of the engine's own in between. */
function adhanTimes(
  dateKey: string,
  place: Place,
  method: MethodId = 'MuslimWorldLeague',
  polar: keyof typeof PolarCircleResolution = 'Unresolved',
): PrayerDay['times'] {
  const { year, month, day } = partsOfDateKey(dateKey)
  const params = CalculationMethod[method]()
  params.highLatitudeRule = 'twilightangle'
  params.polarCircleResolution = PolarCircleResolution[polar]
  const times = new PrayerTimes(new Coordinates(place.latitude, place.longitude), new Date(year, month - 1, day, 12), params)
  return { fajr: times.fajr, sunrise: times.sunrise, dhuhr: times.dhuhr, asr: times.asr, maghrib: times.maghrib, isha: times.isha }
}

/** Every day from `from`, `count` of them. */
function days(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftDateKey(from, index))
}

/** Whether a day's Asr, if it has one, sits strictly inside its own afternoon. */
function asrIsInItsAfternoon({ times }: PrayerDay): boolean {
  if (!isValidTime(times.asr)) return true
  return times.asr > times.dhuhr && (!isValidTime(times.maghrib) || times.asr < times.maghrib)
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

  it('follows the country for the automatic Asr school, like the method', () => {
    const asr = (place: Place, overrides: Partial<CalculationConfig> = {}) =>
      computePrayerDay('2026-10-12', place, config(overrides)).times.asr.getTime()
    expect(DEFAULT_CALCULATION.madhab).toBe('auto')
    // Karachi: 15:39 by the first shadow, 16:30 by the Hanafi rule its mosques use.
    expect(clock(computePrayerDay('2026-10-12', KARACHI, config()), 'asr')).toBe('16:30')
    expect(asr(KARACHI)).toBe(asr(KARACHI, { madhab: 'hanafi' }))
    expect(asr(KARACHI, { madhab: 'shafi' })).toBeLessThan(asr(KARACHI))
    // Known only by its time zone, as after a fix taken offline.
    expect(asr({ ...KARACHI, countryCode: null })).toBe(asr(KARACHI, { madhab: 'hanafi' }))
    for (const place of [CAIRO, MAKKAH, LONDON, NEW_YORK, ISTANBUL]) {
      expect(asr(place), place.timeZone).toBe(asr(place, { madhab: 'shafi' }))
    }
  })

  it('resolves the automatic method from the country', () => {
    const auto = computePrayerDay('2026-07-15', CAIRO, config({ method: 'auto' }))
    expect(instants(auto)).toEqual(instants(computePrayerDay('2026-07-15', CAIRO, config({ method: 'Egyptian' }))))
    expect(instants(auto)).not.toEqual(
      instants(computePrayerDay('2026-07-15', CAIRO, config({ method: 'MuslimWorldLeague' }))),
    )
  })

  it('uses the twilight-angle rule for "automatic" at every latitude', () => {
    expect(resolveHighLatitudeRule('auto')).toBe('twilightangle')
    expect(resolveHighLatitudeRule('seventhofthenight')).toBe('seventhofthenight')
    expect(resolveHighLatitudeRule('middleofthenight')).toBe('middleofthenight')
  })

  // The default settings above 48°, on days when the method's own angles exist.
  // adhan's recommended one-seventh rule made Fajr 20 to 54 minutes late on these days.
  it.each([
    // https://api.aladhan.com/v1/timings/12-10-2026?latitude=59.3293&longitude=18.0686&method=3
    { name: 'Stockholm in October', place: STOCKHOLM, dateKey: '2026-10-12', fajr: '05:02', isha: '19:57' },
    // https://api.aladhan.com/v1/timings/15-04-2027?latitude=52.52&longitude=13.405&method=3
    { name: 'Berlin in April', place: BERLIN, dateKey: '2027-04-15', fajr: '03:57', isha: '22:09' },
    // https://api.aladhan.com/v1/timings/10-05-2027?latitude=53.5461&longitude=-113.4938&method=2
    { name: 'Edmonton in May', place: EDMONTON, dateKey: '2027-05-10', fajr: '03:36', isha: '23:25' },
  ])('keeps the true twilight times with default settings: $name', ({ place, dateKey, fajr, isha }) => {
    const day = computePrayerDay(dateKey, place, config())
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
    expect(Math.abs(minutes(clock(day, 'fajr')) - minutes(fajr))).toBeLessThanOrEqual(2)
    expect(Math.abs(minutes(clock(day, 'isha')) - minutes(isha))).toBeLessThanOrEqual(2)
  })

  it('lets the high-latitude rule bound a London summer night', () => {
    const rule = (highLatitudeRule: CalculationConfig['highLatitudeRule']) =>
      computePrayerDay('2026-06-21', LONDON, config({ method: 'MuslimWorldLeague', highLatitudeRule }))
    expect(clock(rule('auto'), 'fajr')).toBe(clock(rule('twilightangle'), 'fajr'))
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

describe('Asr at ordinary latitudes', () => {
  const MID_MONTHS = Array.from({ length: 12 }, (_, month) => `2026-${String(month + 1).padStart(2, '0')}-15`)
  const SOLSTICES = ['2026-06-21', '2026-12-21']

  // Midwinter noon is 14° up in Berlin and 13° in Edmonton: the lowest sun adhan is still left to.
  it.each([
    ['Cairo', CAIRO],
    ['Makkah', MAKKAH],
    ['New York', NEW_YORK],
    ['Sydney', SYDNEY],
    ['London', LONDON],
    ['Karachi', KARACHI],
    ['Honolulu', HONOLULU],
    ['Berlin', BERLIN],
    ['Edmonton', EDMONTON],
  ])('%s gets exactly what adhan computes, all year', (_name, place) => {
    for (const dateKey of [...MID_MONTHS, ...SOLSTICES]) {
      for (const method of ['MuslimWorldLeague', 'Dubai', 'Singapore'] as const) {
        const day = computePrayerDay(dateKey, place, config({ method, madhab: 'shafi' }))
        const direct = adhanTimes(dateKey, place, method)
        expect(instants(day), `${dateKey}, ${method}`).toEqual(TIME_SLOTS.map((slot) => direct[slot].toISOString()))
      }
    }
  })

  it('leaves Stockholm to adhan from February to October, when its noon sun is above ten degrees', () => {
    for (const dateKey of MID_MONTHS.slice(1, 10)) {
      const day = computePrayerDay(dateKey, STOCKHOLM, config({ method: 'MuslimWorldLeague' }))
      expect(day.times.asr.toISOString(), dateKey).toBe(adhanTimes(dateKey, STOCKHOLM).asr.toISOString())
    }
  })

  it('agrees with adhan within a minute where the low sun is not moving, at the winter solstice', () => {
    // Under ten degrees the engine's own solver is in charge; with the declination at a standstill adhan is still right.
    const reykjavik: Place = { latitude: 64.1466, longitude: -21.9426, timeZone: 'Atlantic/Reykjavik', countryCode: 'IS' }
    for (const place of [STOCKHOLM, reykjavik]) {
      const day = computePrayerDay('2026-12-21', place, config({ method: 'MuslimWorldLeague' }))
      const minutesApart = (day.times.asr.getTime() - adhanTimes('2026-12-21', place).asr.getTime()) / 60_000
      expect(Math.abs(minutesApart), place.timeZone).toBeLessThanOrEqual(1)
    }
  })
})

describe('Asr when the noon sun is near the horizon', () => {
  const mwl = (overrides: Partial<CalculationConfig> = {}) => config({ method: 'MuslimWorldLeague', ...overrides })

  // What adhan alone answers on these days, all of them with a sunrise and a sunset.
  it.each([
    { name: 'Tromsø, before sunrise', place: TROMSO, dateKey: '2026-11-24', adhan: '08:31' },
    { name: 'Tromsø, in the small hours', place: TROMSO, dateKey: '2026-11-23', adhan: '01:26' },
    { name: 'Tromsø, after Isha', place: TROMSO, dateKey: '2027-01-19', adhan: '19:13' },
    { name: 'Murmansk, in the small hours', place: MURMANSK, dateKey: '2026-11-27', adhan: '00:50' },
    { name: 'Rovaniemi, before Dhuhr', place: ROVANIEMI, dateKey: '2026-12-18', adhan: '11:40' },
  ])('shows no Asr rather than a wrong one: $name ($dateKey)', ({ place, dateKey, adhan }) => {
    const direct = adhanTimes(dateKey, place)
    expect(clock({ dateKey, timeZone: place.timeZone, times: direct }, 'asr')).toBe(adhan)
    expect(direct.asr > direct.dhuhr && direct.asr < direct.maghrib).toBe(false)

    const day = computePrayerDay(dateKey, place, mwl())
    expect(isValidTime(day.times.asr)).toBe(false)
    expect(hasMissingTimes(day)).toBe(true)
    // The sun does rise and set, and the rest of the day is untouched.
    for (const slot of ['fajr', 'sunrise', 'dhuhr', 'maghrib', 'isha'] as const) {
      expect(day.times[slot].toISOString(), slot).toBe(direct[slot].toISOString())
    }
  })

  /**
   * The weeks either side, when adhan's Asr still looks plausible. Each time
   * below was confirmed during review by two independent solvers (the first
   * instant after culmination at which the shadow has grown by the object's
   * height); `adhan` is how many minutes later adhan puts it.
   */
  it.each([
    { place: TROMSO, dateKey: '2026-11-01', asr: '12:21', adhan: -5 },
    { place: TROMSO, dateKey: '2026-11-10', asr: '11:58', adhan: -10 },
    { place: TROMSO, dateKey: '2026-11-15', asr: '11:46', adhan: -16 },
    { place: TROMSO, dateKey: '2026-11-20', asr: '11:35', adhan: -39 },
    { place: TROMSO, dateKey: '2026-11-22', asr: '11:32', adhan: -104 },
    { place: TROMSO, dateKey: '2027-01-25', asr: '12:10', adhan: 25 },
    { place: TROMSO, dateKey: '2027-02-01', asr: '12:29', adhan: 11 },
    { place: TROMSO, dateKey: '2027-02-10', asr: '12:55', adhan: 6 },
    { place: ROVANIEMI, dateKey: '2026-12-03', asr: '12:19', adhan: -11 },
  ])('corrects the drift around those days: $place.timeZone $dateKey', ({ place, dateKey, asr, adhan }) => {
    const day = computePrayerDay(dateKey, place, mwl())
    expect(clock(day, 'asr')).toBe(asr)
    expect((adhanTimes(dateKey, place).asr.getTime() - day.times.asr.getTime()) / 60_000).toBe(adhan)
    expect(asrIsInItsAfternoon(day)).toBe(true)
    expect(hasMissingTimes(day)).toBe(false)
  })

  it('reports the moment the shadow has grown by the object’s height, or twice that for the Hanafi school', () => {
    const { latitude, longitude } = TROMSO
    const shadow = (instant: number) => 1 / Math.tan((solarAltitude(instant, latitude, longitude) * Math.PI) / 180)
    for (const dateKey of ['2026-11-01', '2026-11-15', '2027-02-01']) {
      for (const [madhab, factor] of [['shafi', 1], ['hanafi', 2]] as const) {
        const day = computePrayerDay(dateKey, TROMSO, mwl({ madhab }))
        // Dhuhr is a minute after the transit in this method; both are rounded to the minute.
        const transit = solarTransit(day.times.dhuhr.getTime() - 60_000, longitude)
        const growth = (instant: number) => shadow(instant) - shadow(transit)
        expect(growth(day.times.asr.getTime() - 60_000), `${dateKey} ${madhab}`).toBeLessThan(factor)
        expect(growth(day.times.asr.getTime() + 60_000), `${dateKey} ${madhab}`).toBeGreaterThan(factor)
      }
    }
  })

  it('applies the method’s minutes, the user’s minutes and the rounding to its own Asr, as adhan does to its', () => {
    const asr = (overrides: Partial<CalculationConfig>) => computePrayerDay('2026-11-15', TROMSO, config(overrides)).times.asr
    const base = asr({ method: 'MuslimWorldLeague' })
    const minutesAfterBase = (overrides: Partial<CalculationConfig>) => (asr(overrides).getTime() - base.getTime()) / 60_000

    expect(base.getUTCSeconds()).toBe(0)
    // Dubai publishes Asr three minutes late and Diyanet four; both use the same angles as the base.
    expect(minutesAfterBase({ method: 'Dubai' })).toBe(3)
    expect(minutesAfterBase({ method: 'Turkey' })).toBe(4)
    expect(minutesAfterBase({ method: 'MuslimWorldLeague', adjustments: { ...DEFAULT_CALCULATION.adjustments, asr: 7 } })).toBe(7)
    expect(minutesAfterBase({ method: 'Turkey', adjustments: { ...DEFAULT_CALCULATION.adjustments, asr: -2 } })).toBe(2)

    // Singapore rounds every time up to the next minute, a whole one when it is already on the minute.
    const { longitude, latitude } = TROMSO
    const exact = asrInstant(solarTransit(base.getTime(), longitude), latitude, longitude, 1)
    const roundedUp = asr({ method: 'Singapore' }).getTime()
    expect(roundedUp).toBeGreaterThan(exact)
    expect(roundedUp - exact).toBeLessThanOrEqual(61_000)
    expect(roundedUp % 60_000).toBe(0)
  })

  it.each([
    ['Tromsø', TROMSO],
    ['Murmansk', MURMANSK],
    ['Rovaniemi', ROVANIEMI],
    ['Kiruna', KIRUNA],
    ['Longyearbyen', LONGYEARBYEN],
    ['McMurdo', MCMURDO],
  ])('never presents an Asr outside Dhuhr..Maghrib on any day of the year: %s', (_name, place) => {
    for (const dateKey of days('2026-07-01', 366)) {
      for (const madhab of ['shafi', 'hanafi'] as const) {
        expect(asrIsInItsAfternoon(computePrayerDay(dateKey, place, mwl({ madhab }))), `${dateKey} ${madhab}`).toBe(true)
      }
    }
  })

  it('holds that for the methods that shift Dhuhr and Asr, and for a user’s own minutes', () => {
    const adjustments = { fajr: 0, sunrise: 0, dhuhr: 30, asr: -30, maghrib: -30, isha: 0 }
    for (const dateKey of days('2026-10-20', 130)) {
      for (const overrides of [{ method: 'Turkey' }, { method: 'MoonsightingCommittee' }, { method: 'Dubai' }, { adjustments }] as const) {
        expect(asrIsInItsAfternoon(computePrayerDay(dateKey, TROMSO, config(overrides))), dateKey).toBe(true)
      }
    }
  })

  it('leaves Asr unshown when the user’s own minutes would put it before Dhuhr', () => {
    // Reykjavik's midwinter Asr is 21 minutes after Dhuhr: half an hour either way swaps them.
    const reykjavik: Place = { latitude: 64.1466, longitude: -21.9426, timeZone: 'Atlantic/Reykjavik', countryCode: 'IS' }
    const adjustments = { fajr: 0, sunrise: 0, dhuhr: 30, asr: -30, maghrib: 0, isha: 0 }
    expect(clock(computePrayerDay('2026-12-21', reykjavik, config()), 'asr')).toBe('13:47')
    const crossed = computePrayerDay('2026-12-21', reykjavik, config({ adjustments }))
    expect(isValidTime(crossed.times.asr)).toBe(false)
    expect(clock(crossed, 'dhuhr')).toBe('13:57')

    // Where there is room for them, the same minutes are simply applied.
    const london = computePrayerDay('2026-12-21', LONDON, config({ adjustments }))
    expect(clock(london, 'dhuhr')).toBe('12:34')
    expect(clock(london, 'asr')).toBe('13:08')
  })

  it('keeps Asr on a day the sun never sets, when there is no Maghrib to precede', () => {
    const day = computePrayerDay('2026-06-21', TROMSO, mwl())
    expect(isValidTime(day.times.maghrib)).toBe(false)
    expect(clock(day, 'asr')).toBe('17:58')
    expect(day.times.asr.toISOString()).toBe(adhanTimes('2026-06-21', TROMSO).asr.toISOString())
  })
})

describe('borrowing the nearest latitude', () => {
  const nearest = (overrides: Partial<CalculationConfig> = {}) =>
    config({ method: 'MuslimWorldLeague', polar: 'nearestLatitude', ...overrides })

  it.each([
    ['Tromsø', TROMSO],
    ['Murmansk', MURMANSK],
    ['Rovaniemi', ROVANIEMI],
    ['Kiruna', KIRUNA],
    ['Longyearbyen', LONGYEARBYEN],
    ['McMurdo', MCMURDO],
  ])('gives every time, in order, on every day of the year: %s', (_name, place) => {
    for (const dateKey of days('2026-07-01', 366)) {
      const day = computePrayerDay(dateKey, place, nearest())
      expect(hasMissingTimes(day), dateKey).toBe(false)
      expect(day.times.asr > day.times.dhuhr && day.times.asr < day.times.maghrib, dateKey).toBe(true)
      expect(day.times.sunrise < day.times.dhuhr, dateKey).toBe(true)
    }
  })

  // adhan's own nearest-latitude answer on these days still had Asr before Dhuhr, or no change at all.
  it.each([
    { place: TROMSO, dateKey: '2026-11-24', dhuhr: '11:32', asr: '11:33' },
    { place: TROMSO, dateKey: '2026-11-28', dhuhr: '11:33', asr: '11:37' },
    { place: MURMANSK, dateKey: '2026-11-27', dhuhr: '12:36', asr: '12:39' },
    { place: ROVANIEMI, dateKey: '2026-12-18', dhuhr: '12:15', asr: '12:19' },
  ])('fills in an Asr after Dhuhr where adhan’s own version does not: $place.timeZone $dateKey', ({ place, dateKey, dhuhr, asr }) => {
    const direct = adhanTimes(dateKey, place, 'MuslimWorldLeague', 'AqrabBalad')
    expect(direct.asr > direct.dhuhr).toBe(false)

    const day = computePrayerDay(dateKey, place, nearest())
    expect(clock(day, 'dhuhr')).toBe(dhuhr)
    expect(clock(day, 'asr')).toBe(asr)
  })

  it('takes the whole day from one latitude, so sunrise and Maghrib move with Asr', () => {
    const own = computePrayerDay('2026-11-24', TROMSO, config({ method: 'MuslimWorldLeague' }))
    const borrowed = computePrayerDay('2026-11-24', TROMSO, nearest())
    // Further south the sun is up for longer; the meridian, and with it Dhuhr, is the same.
    expect(borrowed.times.sunrise.getTime()).toBeLessThan(own.times.sunrise.getTime())
    expect(borrowed.times.maghrib.getTime()).toBeGreaterThan(own.times.maghrib.getTime())
    expect(borrowed.times.dhuhr.getTime()).toBe(own.times.dhuhr.getTime())
  })

  it('changes nothing on a day that is already whole', () => {
    for (const [place, dateKey] of [[TROMSO, '2026-11-15'], [TROMSO, '2026-03-20'], [ROVANIEMI, '2026-12-03'], [LONDON, '2026-12-21'], [CAIRO, '2026-06-21']] as const) {
      expect(instants(computePrayerDay(dateKey, place, nearest())), `${place.timeZone} ${dateKey}`).toEqual(
        instants(computePrayerDay(dateKey, place, config({ method: 'MuslimWorldLeague' }))),
      )
    }
  })

  it('is not steered by the user’s own minutes', () => {
    // Asr is 16 minutes after Dhuhr here: ten minutes each way cross them, and a degree south would uncross them.
    const adjustments = { fajr: 0, sunrise: 0, dhuhr: 10, asr: -10, maghrib: 0, isha: 0 }
    const plain = computePrayerDay('2026-11-15', TROMSO, nearest())
    const tuned = computePrayerDay('2026-11-15', TROMSO, nearest({ adjustments }))
    expect(tuned.times.sunrise.getTime()).toBe(plain.times.sunrise.getTime())
    expect(tuned.times.maghrib.getTime()).toBe(plain.times.maghrib.getTime())
    expect(isValidTime(tuned.times.asr)).toBe(false)
  })

  it('matches adhan’s own answer under the midnight sun, where that was already right', () => {
    for (const dateKey of ['2026-05-25', '2026-06-21', '2026-07-20']) {
      const direct = adhanTimes(dateKey, TROMSO, 'MuslimWorldLeague', 'AqrabBalad')
      expect(instants(computePrayerDay(dateKey, TROMSO, nearest())), dateKey).toEqual(TIME_SLOTS.map((slot) => direct[slot].toISOString()))
    }
  })

  it('does not borrow from a latitude where the night never ends, though a method may still answer there', () => {
    // The Moonsighting Committee's Fajr and Isha are not measured from the night. At the latitude that used to be
    // borrowed for 20 May the sun does not rise again on the 21st, and every time still came out: Fajr 23:01 for a
    // sunrise at 01:03.
    const day = computePrayerDay('2026-05-20', TROMSO, nearest({ method: 'MoonsightingCommittee' }))
    expect(TIME_SLOTS.map((slot) => clock(day, slot))).toEqual(['01:24', '01:37', '12:46', '17:30', '23:57', '00:07'])

    // From before the midnight sun to after it, and whatever the method, the day is the one adhan's own version borrows.
    for (const method of ['MuslimWorldLeague', 'MoonsightingCommittee', 'Turkey'] as const) {
      for (const dateKey of days('2026-05-10', 85)) {
        const direct = adhanTimes(dateKey, TROMSO, method, 'AqrabBalad')
        expect(instants(computePrayerDay(dateKey, TROMSO, nearest({ method }))), `${method} ${dateKey}`).toEqual(
          TIME_SLOTS.map((slot) => direct[slot].toISOString()),
        )
      }
    }
  })
})
