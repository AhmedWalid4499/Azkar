import { Coordinates, Qibla } from 'adhan'

/** The Kaaba, as adhan places it. */
export const KAABA = { latitude: 21.4225241, longitude: 39.8261818 } as const

/** Mean radius of the Earth (IUGG), in kilometres. */
const EARTH_RADIUS_KM = 6371.0088

/**
 * Closer than this, a bearing says little: a saved location is rounded to about
 * 100 m (or is a city's centre), which at this range swings the direction by
 * tens of degrees, and the Kaaba is a short walk away.
 */
export const NEAR_KAABA_KM = 1

export const CARDINALS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
export type Cardinal = (typeof CARDINALS)[number]

export interface QiblaDirection {
  /** Great-circle bearing to the Kaaba, in degrees clockwise from true north, 0 ≤ bearing < 360. */
  bearing: number
  /** Great-circle distance to the Kaaba, in kilometres. */
  distanceKm: number
  /** Too close for a bearing to be useful (see NEAR_KAABA_KM). */
  near: boolean
}

const radians = (degrees: number) => (degrees * Math.PI) / 180

/** Haversine distance on a sphere of the Earth's mean radius: within 0.5% of the ellipsoid everywhere. */
export function distanceToKaabaKm(latitude: number, longitude: number): number {
  const dLat = radians(KAABA.latitude - latitude)
  const dLon = radians(KAABA.longitude - longitude)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(KAABA.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function qiblaDirection(latitude: number, longitude: number): QiblaDirection {
  const distanceKm = distanceToKaabaKm(latitude, longitude)
  // adhan already returns 0 ≤ bearing < 360; the modulo only turns a 360 from rounding into 0.
  const bearing = Qibla(new Coordinates(latitude, longitude)) % 360
  return { bearing, distanceKm, near: distanceKm < NEAR_KAABA_KM }
}

/** The nearest of the eight compass points to a bearing. */
export function cardinalOf(bearing: number): Cardinal {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8
  return CARDINALS[index] ?? 'n'
}
