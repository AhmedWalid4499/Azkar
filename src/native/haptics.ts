import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativeApp } from './platform'

export type HapticKind = 'tick' | 'done'

/** Browser vibration patterns in milliseconds; the app uses the system's own feedback instead. */
const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  /** One repetition counted, or one prayer logged. */
  tick: 12,
  /** A dhikr or a session reached its count. */
  done: [28, 60, 44],
}

export function canHaptic(): boolean {
  return isNativeApp() || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
}

/** Best effort and never throws: the system or the browser may ignore it (silent mode, no user gesture, setting off). */
export function haptic(kind: HapticKind): void {
  if (isNativeApp()) {
    const feedback =
      kind === 'done' ? Haptics.notification({ type: NotificationType.Success }) : Haptics.impact({ style: ImpactStyle.Light })
    feedback.catch(() => {})
    return
  }
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    const pattern = WEB_PATTERNS[kind]
    navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern])
  } catch {
    // Nothing to fall back to.
  }
}
