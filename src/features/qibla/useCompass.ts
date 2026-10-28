import { useCallback, useEffect, useRef, useState } from 'react'
import { readHeading, smoothHeading } from './heading'
import type { OrientationFields } from './heading'
import { compassAccess, ORIENTATION_EVENTS, requestCompassAccess, screenAngle } from './orientation'

/**
 * - `unsupported`: this browser has no compass to offer;
 * - `idle`: access has to be asked for with a button press (Safari, the iOS app);
 * - `starting`: listening, no heading yet;
 * - `live`: the heading follows the phone;
 * - `denied`: access was refused;
 * - `unavailable`: nothing usable arrived in time (no compass, or a simulator).
 *   Listening goes on, and a late heading still turns the compass on.
 */
export type CompassStatus = 'unsupported' | 'idle' | 'starting' | 'live' | 'denied' | 'unavailable'

export interface CompassState {
  status: CompassStatus
  /** Smoothed heading of the top of the screen, degrees clockwise from magnetic north. Null until a reading arrives. */
  heading: number | null
  /** ± degrees when the platform reports it, negative when uncalibrated, otherwise null. */
  accuracy: number | null
  /** Asks for access where needed and starts listening. Call it from a button press. */
  start: () => void
}

/** How long to wait for a first heading before falling back to the fixed dial. */
export const NO_SIGNAL_MS = 4000

function initialStatus(): CompassStatus {
  const access = compassAccess()
  return access === 'none' ? 'unsupported' : access === 'ask' ? 'idle' : 'starting'
}

export function useCompass(): CompassState {
  const [status, setStatus] = useState<CompassStatus>(initialStatus)
  const [reading, setReading] = useState<{ heading: number; accuracy: number | null } | null>(null)
  // Bumped when access is granted, so the listeners are put on again after the grant.
  const [attempt, setAttempt] = useState(0)
  const smoothed = useRef<{ heading: number; at: number } | null>(null)

  // While waiting for a press in Safari, listening costs nothing and picks up an earlier grant.
  const listening = status !== 'unsupported' && status !== 'denied'

  useEffect(() => {
    if (!listening) return
    const onOrientation = (event: Event) => {
      const raw = readHeading(event as unknown as OrientationFields, screenAngle())
      if (!raw) return
      const now = performance.now()
      const previous = smoothed.current
      const heading = smoothHeading(previous?.heading ?? null, raw.heading, previous ? now - previous.at : 0)
      smoothed.current = { heading, at: now }
      setReading((current) =>
        current && Math.abs(current.heading - heading) < 0.05 && current.accuracy === raw.accuracy
          ? current
          : { heading, accuracy: raw.accuracy },
      )
      setStatus('live')
    }
    for (const type of ORIENTATION_EVENTS) window.addEventListener(type, onOrientation)
    return () => {
      for (const type of ORIENTATION_EVENTS) window.removeEventListener(type, onOrientation)
    }
  }, [listening, attempt])

  useEffect(() => {
    if (status !== 'starting') return
    const id = window.setTimeout(() => setStatus('unavailable'), NO_SIGNAL_MS)
    return () => window.clearTimeout(id)
  }, [status, attempt])

  const start = useCallback(() => {
    // requestPermission has to be called inside the press itself, before any await.
    void requestCompassAccess().then((answer) => {
      if (answer === 'denied') {
        setStatus('denied')
        return
      }
      setAttempt((count) => count + 1)
      setStatus((current) => (current === 'live' ? current : 'starting'))
    })
  }, [])

  return { status, heading: reading?.heading ?? null, accuracy: reading?.accuracy ?? null, start }
}
