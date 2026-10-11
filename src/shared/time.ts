import { useEffect, useState } from 'react'
import { dateKeyInZone, deviceTimeZone } from './date'
import { useLocationStore } from './location'
import type { DateKey } from './types'

/** The current time, re-rendering every `intervalMs` and when the tab regains focus. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}

/** The zone the app treats as "here": the saved location's, else the device's. */
export function useActiveTimeZone(): string {
  const timeZone = useLocationStore((state) => state.location?.timeZone)
  return timeZone ?? deviceTimeZone()
}

/** Today's calendar day in the active zone. Rolls over at local midnight. */
export function useTodayKey(): DateKey {
  const timeZone = useActiveTimeZone()
  const now = useNow(15_000)
  return dateKeyInZone(now, timeZone)
}
