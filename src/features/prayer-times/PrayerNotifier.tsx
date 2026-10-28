import { useCallback, useMemo } from 'react'
import { isNativeApp } from '../../native'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { usePrayerTimesStore } from './config'
import { useClockFormat } from './format'
import { useLocalToday, usePrayerSchedule } from './hooks'
import { useLocationLabel } from './location/useLocationLabel'
import { showNotification } from './notifications'
import { NativeReminders } from './reminders/NativeReminders'
import { reminderEntries, reminderText } from './reminders/plan'
import type { ReminderEntry } from './reminders/plan'
import { useLoggedPrayers } from './reminders/useLoggedPrayers'
import { useWebReminders } from './reminders/useWebReminders'

const NONE = { prayers: false, morning: false, evening: false } as const

/** Each kind's tag: one notification per reminder, so a second tab replaces the first one's instead of stacking. */
const TAG_PREFIX: Record<ReminderEntry['kind'], string> = {
  prayer: 'azkar-prayer',
  unlogged: 'azkar-unlogged',
  azkar: 'azkar-reminder',
}

/** The web's reminders, shown from timers while the page is open. */
function WebReminders() {
  const { t, tp, lang, dir } = useI18n()
  const formatTime = useClockFormat()
  const prayersOn = usePrayerTimesStore((state) => state.notifications)
  const azkar = usePrayerTimesStore((state) => state.azkarReminders)
  const { enabled: unloggedOn, leadMinutes, ishaEnds } = usePrayerTimesStore((state) => state.unloggedReminders)
  const schedule = usePrayerSchedule()
  const place = useLocationLabel()
  const name = useSettings((state) => state.name)
  // Rebuilt the moment a prayer is logged or cleared, so its reminder goes or comes back.
  const isLogged = useLoggedPrayers(useLocalToday())

  const prayers = useMemo(
    () => (prayersOn && schedule ? reminderEntries(schedule.days, { ...NONE, morningAt: 'fajr', prayers: true }) : null),
    [prayersOn, schedule],
  )
  const { morning, evening, morningAt } = azkar
  const sessions = useMemo(
    () => (schedule && (morning || evening) ? reminderEntries(schedule.days, { ...NONE, morning, evening, morningAt }) : null),
    [schedule, morning, evening, morningAt],
  )
  const unlogged = useMemo(
    () =>
      schedule && unloggedOn
        ? reminderEntries(schedule.days, { ...NONE, morningAt: 'fajr', unlogged: { leadMinutes, ishaEnds, isLogged } })
        : null,
    [schedule, unloggedOn, leadMinutes, ishaEnds, isLogged],
  )

  // Permission is checked again at the moment of showing: it can be granted or revoked while the timers run.
  const notify = useCallback(
    (entry: ReminderEntry) => {
      if (!schedule) return
      const { title, body } = reminderText(entry, { t, tp, formatTime, timeZone: schedule.timeZone, place, name })
      void showNotification(title, {
        body,
        tag: `${TAG_PREFIX[entry.kind]}-${entry.key}`,
        // Relative, so it resolves under whatever sub-path the app is served from.
        icon: './pwa-192x192.png',
        lang,
        dir,
      })
    },
    [schedule, t, tp, formatTime, place, name, lang, dir],
  )

  useWebReminders(prayers, notify)
  useWebReminders(unlogged, notify)
  useWebReminders(sessions, notify)
  return null
}

/**
 * Mounted once in the app shell, inside the router. Reminds of the prayer
 * times, of prayers not logged shortly before their time ends and, when
 * asked, of the morning and evening azkar: by system
 * notifications in the installed app, from timers while the page is open on
 * the web. Renders nothing.
 */
export function PrayerNotifier() {
  return isNativeApp() ? <NativeReminders /> : <WebReminders />
}
