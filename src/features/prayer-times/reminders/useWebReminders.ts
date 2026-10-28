import { useEffect, useRef } from 'react'
import { notificationState } from '../notifications'

/**
 * Timers are checked at least this often: a background tab or a sleeping
 * device can stretch a long timeout, and the wall clock is what counts.
 */
const HEARTBEAT_MS = 30_000
/** A reminder this late (the device was asleep) would only confuse. */
const TOO_LATE_MS = 5 * 60_000

export interface TimedReminder {
  /** The same for the same reminder in every rebuild of the timeline, e.g. "2026-10-12-asr". */
  key: string
  at: Date
}

/**
 * The web's reminders: calls `notify` for each entry of `timeline` (in time
 * order) as its time comes, while the page is open. Pass `null` to stop.
 * `notify` should check the permission itself: it can change while this runs.
 */
export function useWebReminders<T extends TimedReminder>(timeline: readonly T[] | null, notify: (entry: T) => void): void {
  // What the effect below is waiting for, for its next run to pick up (see `awaited`).
  const waitingFor = useRef<T | null>(null)

  useEffect(() => {
    if (!timeline || notificationState() === 'unsupported') {
      waitingFor.current = null
      return
    }

    let timer: number | undefined
    // The entry being waited for. A restart of this effect carries on waiting for
    // it only when the timeline still has that entry at that very instant: the
    // day turned over (on waking, often before the timer below has had its turn)
    // or the language changed. A new place or new settings move the instant, so
    // they start afresh and the old place's reminder cannot fire.
    const before = waitingFor.current
    const isSame = (entry: T) => entry.key === before?.key && entry.at.getTime() === before.at.getTime()
    let awaited: T | null = timeline.find(isSame) ?? null
    // The timer and a wake-up both come through here, in either order: whichever
    // arrives first after the time has come shows the reminder, and the other finds nothing left.
    const arm = () => {
      window.clearTimeout(timer)
      const now = Date.now()
      if (awaited && awaited.at.getTime() <= now) {
        const since = awaited.at.getTime()
        // After a long sleep more than one may have passed: only the latest can still be on time.
        const arrived = timeline.findLast((entry) => entry.at.getTime() >= since && entry.at.getTime() <= now)
        if (arrived && now - arrived.at.getTime() < TOO_LATE_MS) notify(arrived)
      }
      // The first one strictly after now; one whose time has just arrived is no longer ahead.
      awaited = timeline.find((entry) => entry.at.getTime() > now) ?? null
      waitingFor.current = awaited
      if (!awaited) return
      timer = window.setTimeout(arm, Math.min(awaited.at.getTime() - now, HEARTBEAT_MS))
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') arm()
    }
    arm()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timeline, notify])
}
