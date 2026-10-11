/** Vibration patterns in milliseconds. */
const PATTERNS = {
  /** One repetition counted. */
  tick: 12,
  /** A dhikr reached its count. */
  done: [28, 60, 44],
} as const

export type Haptic = keyof typeof PATTERNS

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Best effort: browsers ignore or reject vibration freely (no user gesture, system setting off). */
export function haptic(kind: Haptic): void {
  if (!canVibrate()) return
  try {
    const pattern = PATTERNS[kind]
    navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern])
  } catch {
    // Nothing to fall back to.
  }
}
