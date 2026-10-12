import { useEffect, useRef } from 'react'
import { useI18n } from '../../shared/i18n'
import type { UpcomingPrayer } from '../../shared/types'
import { usePrayerTimesStore } from './config'
import { nextPrayerAt } from './engine/schedule'
import { useClockFormat } from './format'
import { usePrayerSchedule } from './hooks'
import { useLocationLabel } from './location/useLocationLabel'
import { notificationState, showNotification } from './notifications'

/**
 * Timers are checked at least this often: a background tab or a sleeping
 * device can stretch a long timeout, and the wall clock is what counts.
 */
const HEARTBEAT_MS = 30_000
/** A reminder this late (the device was asleep) would only confuse. */
const TOO_LATE_MS = 5 * 60_000

/** Mounted once in the app shell. Schedules prayer-time reminders while the app is open; renders nothing. */
export function PrayerNotifier() {
  const { t, lang, dir } = useI18n()
  const formatTime = useClockFormat()
  const enabled = usePrayerTimesStore((state) => state.notifications)
  const schedule = usePrayerSchedule()
  const place = useLocationLabel()
  // What the effect below is waiting for, for its next run to pick up (see `awaited`).
  const waitingFor = useRef<UpcomingPrayer | null>(null)

  useEffect(() => {
    // Permission is checked again at the moment of showing: it can be granted or revoked while this runs.
    if (!enabled || !schedule || notificationState() === 'unsupported') {
      waitingFor.current = null
      return
    }

    const notify = (prayer: UpcomingPrayer) => {
      const time = formatTime(prayer.at, schedule.timeZone)
      void showNotification(t('times.notify.message.title', { prayer: t(`prayer.${prayer.prayer}`) }), {
        body: place ? t('times.notify.message.body', { time, place }) : time,
        // One per prayer: a second tab replaces the first one's notification instead of stacking.
        tag: `azkar-prayer-${prayer.dateKey}-${prayer.prayer}`,
        // Relative, so it resolves under whatever sub-path the app is served from.
        icon: './pwa-192x192.png',
        lang,
        dir,
      })
    }

    let timer: number | undefined
    // The prayer being waited for. A restart of this effect carries on waiting for
    // it only when the timetable still has that prayer at that very instant: the
    // day turned over (on waking, often before the timer below has had its turn)
    // or the language changed. A new place or new settings move the instant, so
    // they start afresh and the old place's prayer cannot fire.
    const before = waitingFor.current
    const isSame = (entry: UpcomingPrayer) =>
      entry.prayer === before?.prayer && entry.dateKey === before.dateKey && entry.at.getTime() === before.at.getTime()
    let awaited: UpcomingPrayer | null = schedule.timeline.find(isSame) ?? null
    // The timer and a wake-up both come through here, in either order: whichever
    // arrives first after the time has come shows the reminder, and the other finds nothing left.
    const arm = () => {
      window.clearTimeout(timer)
      const now = Date.now()
      if (awaited && awaited.at.getTime() <= now) {
        const since = awaited.at.getTime()
        // After a long sleep more than one may have passed: only the latest can still be on time.
        const arrived = schedule.timeline.findLast((entry) => entry.at.getTime() >= since && entry.at.getTime() <= now)
        if (arrived && now - arrived.at.getTime() < TOO_LATE_MS) notify(arrived)
      }
      awaited = nextPrayerAt(schedule.timeline, new Date(now))
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
  }, [enabled, schedule, place, t, lang, dir, formatTime])

  return null
}
