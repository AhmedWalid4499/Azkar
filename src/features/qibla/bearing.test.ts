import { describe, expect, it } from 'vitest'
import { cardinalOf, KAABA, NEAR_KAABA_KM, qiblaDirection } from './bearing'

// References, worked out apart from the app and from adhan:
// - `sphere`: the standard forward-azimuth formula, θ = atan2(sin Δλ cos φ₂, cos φ₁ sin φ₂ − sin φ₁ cos φ₂ cos Δλ),
//   which is not the tangent form adhan uses. These are also the figures common Qibla calculators publish
//   (Cairo 136°, London 119°, New York 58.5°, Jakarta 295°, Sydney 277.5°).
// - `geodesic`: Vincenty's inverse solution on the WGS 84 ellipsoid, bearing and distance. A sphere is
//   within a fifth of a degree of it, which is the tolerance below.
const CITIES = [
  { name: 'Cairo', latitude: 30.0444, longitude: 31.2357, sphere: 136.137, geodesic: 135.982, km: 1285.6, cardinal: 'se' },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, sphere: 118.987, geodesic: 118.868, km: 4794.8, cardinal: 'se' },
  { name: 'New York', latitude: 40.7128, longitude: -74.006, sphere: 58.482, geodesic: 58.396, km: 10323.9, cardinal: 'ne' },
  { name: 'Jakarta', latitude: -6.2088, longitude: 106.8456, sphere: 295.152, geodesic: 295.025, km: 7922.2, cardinal: 'nw' },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, sphere: 277.5, geodesic: 277.319, km: 13237.0, cardinal: 'w' },
  { name: 'Madinah', latitude: 24.4672, longitude: 39.6111, sphere: 176.236, geodesic: 176.214, km: 337.9, cardinal: 's' },
  { name: 'Anchorage', latitude: 61.2181, longitude: -149.9003, sphere: 350.883, geodesic: 350.899, km: 10802.8, cardinal: 'n' },
] as const

describe('qiblaDirection', () => {
  it.each(CITIES)('points from $name to the Kaaba', ({ latitude, longitude, sphere, geodesic, km, cardinal }) => {
    const qibla = qiblaDirection(latitude, longitude)
    expect(qibla.bearing).toBeCloseTo(sphere, 2)
    expect(Math.abs(qibla.bearing - geodesic)).toBeLessThan(0.2)
    // A sphere is within 0.5% of the ellipsoid's distances.
    expect(Math.abs(qibla.distanceKm - km) / km).toBeLessThan(0.005)
    expect(qibla.near).toBe(false)
    expect(cardinalOf(qibla.bearing)).toBe(cardinal)
  })

  it('keeps every bearing in 0 ≤ bearing < 360', () => {
    for (let latitude = -80; latitude <= 80; latitude += 20) {
      for (let longitude = -180; longitude < 180; longitude += 30) {
        const { bearing } = qiblaDirection(latitude, longitude)
        expect(bearing).toBeGreaterThanOrEqual(0)
        expect(bearing).toBeLessThan(360)
      }
    }
  })

  describe('in Makkah itself', () => {
    it('is at no distance at the Kaaba, where no bearing is shown', () => {
      const qibla = qiblaDirection(KAABA.latitude, KAABA.longitude)
      expect(qibla.distanceKm).toBeLessThan(0.001)
      expect(qibla.near).toBe(true)
    })

    it('treats the city centre a city search gives as too close for a bearing', () => {
      // Open-Meteo's "Mecca", 0.46 km from the Kaaba: anywhere in the Haram the direction is a matter of where one stands.
      const qibla = qiblaDirection(21.42664, 39.82563)
      expect(qibla.distanceKm).toBeCloseTo(0.46, 1)
      expect(qibla.near).toBe(true)
    })

    it('gives a bearing a few kilometres out, in Mina', () => {
      // Sphere 278.410°, WGS 84 geodesic 278.362° and 7.0 km.
      const qibla = qiblaDirection(21.4133, 39.8933)
      expect(qibla.bearing).toBeCloseTo(278.41, 1)
      expect(qibla.distanceKm).toBeCloseTo(7.0, 1)
      expect(qibla.near).toBe(false)
      expect(cardinalOf(qibla.bearing)).toBe('w')
    })

    it('draws the line at a kilometre', () => {
      // Due south of the Kaaba, just inside and just outside NEAR_KAABA_KM (one degree of latitude is 111.2 km).
      expect(qiblaDirection(KAABA.latitude - 0.0089, KAABA.longitude).near).toBe(true)
      const outside = qiblaDirection(KAABA.latitude - 0.0091, KAABA.longitude)
      expect(outside.distanceKm).toBeGreaterThan(NEAR_KAABA_KM)
      expect(outside.near).toBe(false)
      // From due south, the Kaaba is due north.
      expect(Math.min(outside.bearing, 360 - outside.bearing)).toBeLessThan(0.01)
    })
  })
})

describe('cardinalOf', () => {
  it.each([
    [0, 'n'],
    [22.49, 'n'],
    [22.5, 'ne'],
    [67.5, 'e'],
    [112.49, 'e'],
    [112.5, 'se'],
    [180, 's'],
    [225, 'sw'],
    [270, 'w'],
    [315, 'nw'],
    [337.49, 'nw'],
    [337.5, 'n'],
    [359.99, 'n'],
    [360, 'n'],
    [-45, 'nw'],
  ] as const)('names %f° %s', (bearing, cardinal) => {
    expect(cardinalOf(bearing)).toBe(cardinal)
  })
})
