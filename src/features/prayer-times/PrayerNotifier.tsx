import { useEffect } from 'react'
import { useI18n } from '../../shared/i18n'
import { useLocationStore } from '../../shared/location'
import type { UpcomingPrayer } from '../../shared/types'
import { usePrayerTimesStore } from './config'
import { nextPrayerAt } from './engine/schedule'
import { useClockFormat } from './format'
import { usePrayerSchedule } from './hooks'
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
  const label = useLocationStore((state) => state.location?.label)

  useEffect(() => {
    // Permission is checked again at the moment of showing: it can be granted or revoked while this runs.
    if (!enabled || !schedule || notificationState() === 'unsupported') return

    const notify = (prayer: UpcomingPrayer) => {
      const time = formatTime(prayer.at, schedule.timeZone)
      void showNotification(t('times.notify.message.title', { prayer: t(`prayer.${prayer.prayer}`) }), {
        body: typeof label === 'string' && label !== '' ? t('times.notify.message.body', { time, place: label }) : time,
        // One per prayer: a second tab replaces the first one's notification instead of stacking.
        tag: `azkar-prayer-${prayer.dateKey}-${prayer.prayer}`,
        // Relative, so it resolves under whatever sub-path the app is served from.
        icon: './pwa-192x192.png',
        lang,
        dir,
      })
    }

    let timer: number | undefined
    const arm = () => {
      window.clearTimeout(timer)
      const upcoming = nextPrayerAt(schedule.timeline, new Date())
      if (!upcoming) return
      const due = upcoming.at.getTime()
      timer = window.setTimeout(
        () => {
          const late = Date.now() - due
          if (late >= 0 && late < TOO_LATE_MS) notify(upcoming)
          arm()
        },
        Math.min(Math.max(0, due - Date.now()), HEARTBEAT_MS),
      )
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
  }, [enabled, schedule, label, t, lang, dir, formatTime])

  return null
}
