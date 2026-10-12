import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan'
import { describe, expect, it } from 'vitest'
import { asrInstant, solarAltitude, solarTransit } from './solar'

const CAIRO = { latitude: 30.0444, longitude: 31.2357 }
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 }
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 }
const JAKARTA = { latitude: -6.2088, longitude: 106.8456 }
const LONDON = { latitude: 51.5074, longitude: -0.1278 }
const TROMSO = { latitude: 69.6492, longitude: 18.9553 }

const MID_MONTHS = Array.from({ length: 12 }, (_, month) => [2026, month, 15] as const)

/** adhan's transit and Asr, to the minute, for a place whose solar day is the UTC day (none here is near the date line). */
function adhan({ latitude, longitude }: typeof CAIRO, year: number, month: number, day: number, madhab: 'shafi' | 'hanafi' = 'shafi') {
  // A method that adds no minutes of its own, so its Dhuhr is the transit.
  const params = CalculationMethod.Kuwait()
  params.madhab = madhab
  const times = new PrayerTimes(new Coordinates(latitude, longitude), new Date(year, month, day, 12), params)
  return { transit: times.dhuhr.getTime(), asr: times.asr.getTime() }
}

const cot = (degrees: number) => 1 / Math.tan((degrees * Math.PI) / 180)

describe('solarTransit', () => {
  it('finds the transit adhan finds, from an estimate hours away', () => {
    for (const place of [CAIRO, NEW_YORK, SYDNEY, JAKARTA, LONDON, TROMSO]) {
      for (const [year, month, day] of MID_MONTHS) {
        const reference = adhan(place, year, month, day).transit
        for (const hoursOff of [-4, 0, 3]) {
          const found = solarTransit(reference + hoursOff * 3_600_000, place.longitude)
          // adhan's is rounded to the minute.
          expect(Math.abs(found - reference), `${place.latitude} ${month + 1}`).toBeLessThan(35_000)
        }
      }
    }
  })
})

describe('solarAltitude', () => {
  it('puts the noon sun where the latitude and the season say', () => {
    const transit = (place: typeof CAIRO, month: number, day: number) => solarTransit(adhan(place, 2026, month, day).transit, place.longitude)
    // 90° minus the distance between the latitude and the sun's declination (±23.44° at the solstices).
    expect(solarAltitude(transit(CAIRO, 5, 21), CAIRO.latitude, CAIRO.longitude)).toBeCloseTo(90 - 30.0444 + 23.44, 1)
    expect(solarAltitude(transit(CAIRO, 11, 21), CAIRO.latitude, CAIRO.longitude)).toBeCloseTo(90 - 30.0444 - 23.44, 1)
    expect(solarAltitude(transit(SYDNEY, 11, 21), SYDNEY.latitude, SYDNEY.longitude)).toBeCloseTo(90 - 33.8688 + 23.44, 1)
    // In Tromsø's polar night the centre of the sun stays under the horizon all day.
    expect(solarAltitude(transit(TROMSO, 11, 21), TROMSO.latitude, TROMSO.longitude)).toBeCloseTo(90 - 69.6492 - 23.44, 1)
  })
})

describe('asrInstant', () => {
  it('agrees with adhan to the minute wherever the sun is high', () => {
    for (const place of [CAIRO, NEW_YORK, SYDNEY, JAKARTA, LONDON]) {
      for (const [year, month, day] of MID_MONTHS) {
        for (const [madhab, factor] of [['shafi', 1], ['hanafi', 2]] as const) {
          const reference = adhan(place, year, month, day, madhab)
          const found = asrInstant(solarTransit(reference.transit, place.longitude), place.latitude, place.longitude, factor)
          // adhan rounds to the minute and takes its noon shadow from the declination at 0h UT, worth up to a minute at the equinoxes.
          expect(Math.abs(found - reference.asr), `${place.latitude} ${month + 1} ${madhab}`).toBeLessThan(90_000)
        }
      }
    }
  })

  it('lands on the instant the shadow has grown by the factor', () => {
    for (const place of [CAIRO, LONDON, TROMSO]) {
      for (const [month, day] of [[1, 1], [2, 20], [9, 25], [10, 15]] as const) {
        for (const factor of [1, 2]) {
          const transit = solarTransit(adhan(place, 2026, month, day).transit, place.longitude)
          const asr = asrInstant(transit, place.latitude, place.longitude, factor)
          const altitude = (instant: number) => solarAltitude(instant, place.latitude, place.longitude)
          expect(asr).toBeGreaterThan(transit)
          expect(cot(altitude(asr)) - cot(altitude(transit)), `${place.latitude} ${month + 1}`).toBeCloseTo(factor, 2)
        }
      }
    }
  })

  it('still answers with the sun two degrees up at noon', () => {
    // Tromsø, 15 November 2026: adhan says 11:30 local, a minute after the transit; the shadow rule gives 11:46.
    const transit = solarTransit(Date.UTC(2026, 10, 15, 10, 29), TROMSO.longitude)
    expect(solarAltitude(transit, TROMSO.latitude, TROMSO.longitude)).toBeCloseTo(1.8, 1)
    const asr = asrInstant(transit, TROMSO.latitude, TROMSO.longitude, 1)
    expect(new Date(asr).toISOString().slice(0, 16)).toBe('2026-11-15T10:45')
  })

  it('has no answer when the centre of the sun does not clear the horizon at noon', () => {
    for (const [month, day] of [[10, 24], [11, 21], [0, 10]] as const) {
      const transit = solarTransit(Date.UTC(2026, month, day, 10, 30), TROMSO.longitude)
      expect(solarAltitude(transit, TROMSO.latitude, TROMSO.longitude)).toBeLessThan(0)
      expect(asrInstant(transit, TROMSO.latitude, TROMSO.longitude, 1)).toBeNaN()
    }
  })

  it('has no answer where the sun circles too high to cast that shadow', () => {
    // Half a degree from the pole in June the sun stays near 23° all day: the shadow never grows by its object's height.
    const transit = solarTransit(Date.UTC(2026, 5, 21, 12), 0)
    expect(asrInstant(transit, 89.5, 0, 1)).toBeNaN()
  })
})
