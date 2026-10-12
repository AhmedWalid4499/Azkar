/**
 * Where the sun is, for the one job adhan does badly: Asr on days when the
 * noon sun is close to the horizon. adhan measures the noon shadow with the
 * declination of 0h UT and takes a single correction step, which drifts by
 * minutes below about ten degrees of noon altitude and falls apart near zero.
 *
 * These are the Astronomical Almanac's low-precision formulas. Between 1950
 * and 2050 they stay within 0.01° of adhan's own solar position, a few seconds
 * of time.
 */

const DEGREES = Math.PI / 180
const DAY_MS = 86_400_000
const J2000 = Date.UTC(2000, 0, 1, 12)
/** Bisection stops here; times are rounded to the minute afterwards. */
const PRECISION_MS = 500

const sin = (degrees: number) => Math.sin(degrees * DEGREES)
const cos = (degrees: number) => Math.cos(degrees * DEGREES)

/** The sun's declination and its hour angle at `longitude`, both in degrees, at an instant in epoch milliseconds. */
function sunAt(instant: number, longitude: number): { declination: number; hourAngle: number } {
  const days = (instant - J2000) / DAY_MS
  const anomaly = 357.528 + 0.9856003 * days
  const eclipticLongitude = 280.46 + 0.9856474 * days + 1.915 * sin(anomaly) + 0.02 * sin(2 * anomaly)
  const obliquity = 23.439 - 0.0000004 * days
  const rightAscension = Math.atan2(cos(obliquity) * sin(eclipticLongitude), cos(eclipticLongitude)) / DEGREES
  const siderealTime = 280.46061837 + 360.98564736629 * days
  return {
    declination: Math.asin(sin(obliquity) * sin(eclipticLongitude)) / DEGREES,
    hourAngle: siderealTime + longitude - rightAscension,
  }
}

/**
 * Altitude of the sun's centre in degrees. Geometric, without refraction: that
 * is how the length of a shadow, and with it Asr, is defined.
 */
export function solarAltitude(instant: number, latitude: number, longitude: number): number {
  const { declination, hourAngle } = sunAt(instant, longitude)
  return Math.asin(sin(latitude) * sin(declination) + cos(latitude) * cos(declination) * cos(hourAngle)) / DEGREES
}

/** The instant the sun crosses the meridian of `longitude`, from an estimate within a few hours of it. */
export function solarTransit(estimate: number, longitude: number): number {
  let instant = estimate
  // The hour angle turns once a day, so each pass leaves a few hundredths of the error before it.
  for (let pass = 0; pass < 3; pass++) {
    const { hourAngle } = sunAt(instant, longitude)
    const offset = ((((hourAngle + 180) % 360) + 360) % 360) - 180
    instant -= (offset / 360) * DAY_MS
  }
  return instant
}

/**
 * Asr: the first instant after `transit` at which a shadow is `shadowFactor`
 * times the height of its object longer than it was at noon (1, or 2 for the
 * Hanafi school). NaN when there is no such instant: the sun's centre does not
 * clear the horizon at noon, so there is no noon shadow to measure from.
 */
export function asrInstant(transit: number, latitude: number, longitude: number, shadowFactor: number): number {
  const noon = solarAltitude(transit, latitude, longitude)
  if (!(noon > 0)) return Number.NaN
  const target = Math.atan(1 / (shadowFactor + 1 / Math.tan(noon * DEGREES))) / DEGREES

  // From its highest point the sun only sinks until the middle of the night.
  let above = transit
  let below = transit + DAY_MS / 2
  if (solarAltitude(below, latitude, longitude) > target) return Number.NaN
  while (below - above > PRECISION_MS) {
    const middle = (above + below) / 2
    if (solarAltitude(middle, latitude, longitude) > target) above = middle
    else below = middle
  }
  return below
}
