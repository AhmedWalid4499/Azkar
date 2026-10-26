import { Geolocation } from '@capacitor/geolocation'

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

/** Error codes documented by @capacitor/geolocation 8 on iOS and Android. */
function mapError(error: unknown): NativeGeoError {
  if (error instanceof NativeGeoError) return error
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : undefined
  if (/GLOC-00(03|08|09)$/.test(code)) return new NativeGeoError('denied', message)
  if (/GLOC-0010$/.test(code)) return new NativeGeoError('timeout', message)
  return new NativeGeoError('unavailable', message)
}

/**
 * The device's position from the system location service, asking for
 * permission first when it has not been decided. Only for the installed app;
 * a browser uses navigator.geolocation.
 */
export async function getNativePosition(timeoutMs = 15_000): Promise<NativePosition> {
  try {
    let permission = (await Geolocation.checkPermissions()).location
    if (permission === 'prompt' || permission === 'prompt-with-rationale') {
      permission = (await Geolocation.requestPermissions({ permissions: ['location'] })).location
    }
    if (permission === 'denied') throw new NativeGeoError('denied')
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
