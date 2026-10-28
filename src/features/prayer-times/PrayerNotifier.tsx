import { useCallback, useMemo } from 'react'
import { isNativeApp } from '../../native'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { usePrayerTimesStore } from './config'
import { useClockFormat } from './format'
import { usePrayerSchedule } from './hooks'
import { useLocationLabel } from './location/useLocationLabel'
import { showNotification } from './notifications'
import { NativeReminders } from './reminders/NativeReminders'
import { reminderEntries, reminderText } from './reminders/plan'
import type { ReminderEntry } from './reminders/plan'
import { useWebReminders } from './reminders/useWebReminders'

const NONE = { prayers: false, morning: false, evening: false } as const

/** The web's reminders, shown from timers while the page is open. */
function WebReminders() {
  const { t, lang, dir } = useI18n()
  const formatTime = useClockFormat()
  const prayersOn = usePrayerTimesStore((state) => state.notifications)
  const azkar = usePrayerTimesStore((state) => state.azkarReminders)
  const schedule = usePrayerSchedule()
  const place = useLocationLabel()
  const name = useSettings((state) => state.name)

  const prayers = useMemo(
    () => (prayersOn && schedule ? reminderEntries(schedule.days, { ...NONE, morningAt: 'fajr', prayers: true }) : null),
    [prayersOn, schedule],
  )
  const { morning, evening, morningAt } = azkar
  const sessions = useMemo(
    () => (schedule && (morning || evening) ? reminderEntries(schedule.days, { ...NONE, morning, evening, morningAt }) : null),
    [schedule, morning, evening, morningAt],
  )

  // Permission is checked again at the moment of showing: it can be granted or revoked while the timers run.
  const notify = useCallback(
    (entry: ReminderEntry) => {
      if (!schedule) return
      const { title, body } = reminderText(entry, { t, formatTime, timeZone: schedule.timeZone, place, name })
      void showNotification(title, {
        body,
        // One per reminder: a second tab replaces the first one's notification instead of stacking.
        tag: entry.kind === 'prayer' ? `azkar-prayer-${entry.key}` : `azkar-reminder-${entry.key}`,
        // Relative, so it resolves under whatever sub-path the app is served from.
        icon: './pwa-192x192.png',
        lang,
        dir,
      })
    },
    [schedule, t, formatTime, place, name, lang, dir],
  )

  useWebReminders(prayers, notify)
  useWebReminders(sessions, notify)
  return null
}

/**
 * Mounted once in the app shell, inside the router. Reminds of the prayer
 * times and, when asked, of the morning and evening azkar: by system
 * notifications in the installed app, from timers while the page is open on
 * the web. Renders nothing.
 */
export function PrayerNotifier() {
  return isNativeApp() ? <NativeReminders /> : <WebReminders />
}
