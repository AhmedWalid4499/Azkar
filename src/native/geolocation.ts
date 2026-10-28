import type { PermissionState } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import type { PermissionStatus } from '@capacitor/geolocation'

export type NativeGeoErrorCode = 'denied' | 'unavailable' | 'timeout'

export class NativeGeoError extends Error {
  readonly code: NativeGeoErrorCode

  constructor(code: NativeGeoErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'NativeGeoError'
    this.code = code
  }
}

export interface NativePosition {
  latitude: number
  longitude: number
  /** Metres. */
  accuracy: number
}

/**
 * Error codes documented by @capacitor/geolocation 8 on iOS and Android. Only
 * the app's own permission counts as denied: 0003 refused, 0008 restricted
 * (iOS Screen Time). Location services switched off for the whole device (0007,
 * 0016, 0017, and 0009 when the user declines Android's offer to turn them on)
 * is "unavailable", whose message asks to check that they are on.
 */
function mapError(error: unknown): NativeGeoError {
  if (error instanceof NativeGeoError) return error
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : undefined
  if (/GLOC-00(03|08)$/.test(code)) return new NativeGeoError('denied', message)
  if (/GLOC-0010$/.test(code)) return new NativeGeoError('timeout', message)
  return new NativeGeoError('unavailable', message)
}

/**
 * An approximate position is all that is needed. Android 12 and later let the
 * user allow only that, and then report `location` (precise and approximate
 * together) as not granted while `coarseLocation` is.
 */
function isAllowed({ location, coarseLocation }: PermissionStatus): boolean {
  return location === 'granted' || coarseLocation === 'granted'
}

function isUndecided(state: PermissionState): boolean {
  return state === 'prompt' || state === 'prompt-with-rationale'
}

/**
 * The device's position from the system location service, asking for
 * permission first when it has not been decided. Only for the installed app;
 * a browser uses navigator.geolocation.
 */
export async function getNativePosition(timeoutMs = 15_000): Promise<NativePosition> {
  try {
    let permission = await Geolocation.checkPermissions()
    if (!isAllowed(permission) && (isUndecided(permission.location) || isUndecided(permission.coarseLocation))) {
      permission = await Geolocation.requestPermissions({ permissions: ['location'] })
    }
    // Refused at the prompt just now, or before: getCurrentPosition would only ask again.
    if (!isAllowed(permission)) throw new NativeGeoError('denied')
    const { coords } = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 60_000,
    })
    return { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }
  } catch (error) {
    throw mapError(error)
  }
}
