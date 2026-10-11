export type GeoErrorCode = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout'

export class GeoError extends Error {
  readonly code: GeoErrorCode

  constructor(code: GeoErrorCode) {
    super(`Geolocation failed: ${code}`)
    this.name = 'GeoError'
    this.code = code
  }
}

export interface Position {
  latitude: number
  longitude: number
}

/** How long the device may take to find a position once it starts looking. */
const POSITION_TIMEOUT_MS = 15_000
/**
 * Backstop for browsers that never call back when the permission prompt is
 * dismissed. Longer than the device timeout so a slow answer to the prompt
 * still counts.
 */
const GIVE_UP_MS = 45_000
/** A fix this recent is good enough: prayer times barely move within a city. */
const MAXIMUM_AGE_MS = 10 * 60_000

// GeolocationPositionError codes; the constants are missing from some mocks and old engines.
const PERMISSION_DENIED = 1
const TIMEOUT = 3

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  )
}

/** One reading from the device. Rejects with a `GeoError` that says what to tell the user. */
export function requestPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator) || !navigator.geolocation) {
      // Browsers hide or disable the API on plain-http pages.
      reject(new GeoError(window.isSecureContext === false ? 'insecure' : 'unsupported'))
      return
    }

    let settled = false
    const finish = (run: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(backstop)
      run()
    }
    const backstop = window.setTimeout(() => finish(() => reject(new GeoError('timeout'))), GIVE_UP_MS)

    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          finish(() => {
            const { latitude, longitude } = position.coords
            if (isValidCoordinate(latitude, longitude)) resolve({ latitude, longitude })
            else reject(new GeoError('unavailable'))
          }),
        (error) =>
          finish(() => {
            if (error.code === PERMISSION_DENIED) {
              reject(new GeoError(window.isSecureContext === false ? 'insecure' : 'denied'))
            } else {
              reject(new GeoError(error.code === TIMEOUT ? 'timeout' : 'unavailable'))
            }
          }),
        { enableHighAccuracy: false, timeout: POSITION_TIMEOUT_MS, maximumAge: MAXIMUM_AGE_MS },
      )
    } catch {
      finish(() => reject(new GeoError('unavailable')))
    }
  })
}
