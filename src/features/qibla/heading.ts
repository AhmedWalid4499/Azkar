// Pure maths for the live compass: readings from orientation events, smoothing and alignment.

/** An angle brought into 0 ≤ angle < 360. */
export function normalizeDegrees(angle: number): number {
  const turned = angle % 360
  // `+ 0` turns a -0 into 0.
  return (turned < 0 ? turned + 360 : turned) + 0
}

/** The shortest turn from `from` to `to`, in degrees: positive is clockwise, -180 < turn ≤ 180. */
export function signedDelta(from: number, to: number): number {
  const turn = normalizeDegrees(to - from)
  return turn > 180 ? turn - 360 : turn
}

/** The fields of a DeviceOrientationEvent this feature reads, including Safari's own. */
export interface OrientationFields {
  type: string
  absolute?: boolean | null
  alpha?: number | null
  /** Safari: degrees clockwise from magnetic north of the top of the device. */
  webkitCompassHeading?: number | null
  /** Safari: ± degrees; negative when the compass is not calibrated. */
  webkitCompassAccuracy?: number | null
}

export interface HeadingReading {
  /** Degrees clockwise from north of the top of the screen as it is being looked at. */
  heading: number
  /**
   * Which north. Safari fills webkitCompassHeading from Core Location's magnetic heading,
   * and Chrome's absolute alpha comes from Android's rotation vector, which is magnetic too.
   */
  north: 'magnetic'
  /** ± degrees when the platform reports it (Safari), negative when uncalibrated, else null. */
  accuracy: number | null
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * Turns one orientation event into a compass reading, or null when the event
 * carries no heading: an orientation relative to wherever the device happened to
 * be facing, or a sensor that is missing or still waking up.
 *
 * Both sources describe the device's own top edge, so the angle of the screen's
 * rotation (`screen.orientation.angle`, counter-clockwise from portrait) is added
 * to get the heading of the top of what is on the screen.
 */
export function readHeading(event: OrientationFields, screenAngle: number): HeadingReading | null {
  if (finite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0) {
    const accuracy = finite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : null
    return { heading: normalizeDegrees(event.webkitCompassHeading + screenAngle), north: 'magnetic', accuracy }
  }
  const absolute = event.type === 'deviceorientationabsolute' || event.absolute === true
  if (absolute && finite(event.alpha)) {
    // alpha turns counter-clockwise from north; a compass heading turns clockwise.
    return { heading: normalizeDegrees(360 - event.alpha + screenAngle), north: 'magnetic', accuracy: null }
  }
  return null
}

/** Beyond this many degrees of uncertainty the platform's compass needs calibrating. */
export const POOR_ACCURACY_DEGREES = 25

export function isPoorAccuracy(accuracy: number | null): boolean {
  return accuracy !== null && (accuracy < 0 || accuracy > POOR_ACCURACY_DEGREES)
}

/** How quickly small movements are followed, in milliseconds: long enough to still the sensor's tremor. */
const SETTLE_MS = 150
/** A change this large is followed at once, so a real turn does not lag. */
const FOLLOW_DEGREES = 24

/**
 * Exponential smoothing along the shortest arc, so 359° and 1° average to 0°
 * rather than 180°. Small changes (jitter) are damped over about SETTLE_MS;
 * the larger a change, the more of it is taken at once, up to all of it at
 * FOLLOW_DEGREES, so turning the phone is followed without lag.
 */
export function smoothHeading(previous: number | null, next: number, elapsedMs: number): number {
  if (previous === null) return normalizeDegrees(next)
  const delta = signedDelta(previous, next)
  const byTime = 1 - Math.exp(-Math.max(0, elapsedMs) / SETTLE_MS)
  const bySize = Math.min(1, Math.abs(delta) / FOLLOW_DEGREES)
  return normalizeDegrees(previous + delta * Math.max(byTime, bySize))
}

/** Within this many degrees of the Qibla the phone counts as facing it. */
export const ALIGN_ENTER_DEGREES = 3
/** Once facing it, the phone has to turn this far away before it no longer counts, so the state does not flicker. */
export const ALIGN_LEAVE_DEGREES = 5

/** Alignment with hysteresis: `turn` is how far the phone still has to turn, in degrees either way. */
export function nextAligned(wasAligned: boolean, turn: number): boolean {
  return Math.abs(turn) <= (wasAligned ? ALIGN_LEAVE_DEGREES : ALIGN_ENTER_DEGREES)
}
