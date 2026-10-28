// What the browser offers for reading the compass. Kept apart from the hook so tests can stand in for it.

/**
 * - `none`: no orientation events at all, or a device without a touch screen (a
 *   desktop browser, which never has a compass it would report);
 * - `ask`: Safari (and the iOS app's web view), where access has to be asked for from a button press;
 * - `open`: events arrive without asking (Chrome, Firefox, the Android app).
 */
export type CompassAccess = 'none' | 'ask' | 'open'

interface OrientationEventApi {
  requestPermission?: () => Promise<string>
}

function orientationApi(): OrientationEventApi | undefined {
  return (window as unknown as { DeviceOrientationEvent?: OrientationEventApi }).DeviceOrientationEvent
}

export function compassAccess(): CompassAccess {
  const api = orientationApi()
  if (api === undefined) return 'none'
  if (navigator.maxTouchPoints === 0) return 'none'
  return typeof api.requestPermission === 'function' ? 'ask' : 'open'
}

/**
 * Asks for motion and orientation access where the browser requires it. Must be
 * called from the handler of a button press. A refusal, and a browser that
 * throws (called outside a press, say), both count as refused.
 */
export async function requestCompassAccess(): Promise<'granted' | 'denied'> {
  const api = orientationApi()
  if (typeof api?.requestPermission !== 'function') return 'granted'
  try {
    return (await api.requestPermission()) === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

/** How far the screen is turned from the device's natural orientation, counter-clockwise, in degrees. */
export function screenAngle(): number {
  const angle = window.screen?.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation
  return typeof angle === 'number' && Number.isFinite(angle) ? angle : 0
}

/** Safari sends its compass with `deviceorientation`; Chrome sends an absolute one under its own name. */
export const ORIENTATION_EVENTS = ['deviceorientationabsolute', 'deviceorientation'] as const
