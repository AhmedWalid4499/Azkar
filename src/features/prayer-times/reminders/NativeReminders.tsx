import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { nativeNotificationPermission, replaceScheduledNotifications } from '../../../native'
import type { PlannedNotification } from '../../../native'
import { onAppActive, onNotificationTap } from '../../../native/notifications'
import { useI18n } from '../../../shared/i18n'
import { useSettings } from '../../../shared/settings'
import { useCalculationConfig, usePrayerTimesStore } from '../config'
import { useClockFormat } from '../format'
import { prayerDayFor, useLocalToday, usePlace } from '../hooks'
import { useLocationLabel } from '../location/useLocationLabel'
import { AZKAR_GROUP, PRAYER_GROUP, reminderId, reminderText, upcomingReminders } from './plan'

/**
 * The installed app's reminders: handed to the system a week ahead, so they
 * arrive with the app closed, and handed over again whenever the app comes
 * back to the foreground or anything they depend on changes. A tap on one opens
 * the screen it is about. Must be mounted inside the router; renders nothing.
 */
export function NativeReminders() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const formatTime = useClockFormat()
  const place = usePlace()
  const config = useCalculationConfig()
  const prayers = usePrayerTimesStore((state) => state.notifications)
  const azkar = usePrayerTimesStore((state) => state.azkarReminders)
  const placeLabel = useLocationLabel()
  const name = useSettings((state) => state.name)
  // While the app stays open across midnight, the week ahead moves on with the day.
  const today = useLocalToday()

  useEffect(() => {
    const stopPrayers = onNotificationTap(PRAYER_GROUP, () => navigate('/'))
    const stopAzkar = onNotificationTap(AZKAR_GROUP, ({ data }) => {
      navigate(data.session === 'morning' || data.session === 'evening' ? `/azkar/${data.session}` : '/azkar')
    })
    return () => {
      stopPrayers()
      stopAzkar()
    }
  }, [navigate])

  useEffect(() => {
    let active = true
    const sync = async () => {
      // Never ask from here (scheduling would ask by itself): that is for the switches
      // in Settings. Without the permission nothing would be shown, so nothing stays scheduled.
      const granted = (await nativeNotificationPermission()) === 'granted'
      if (!active) return
      const entries =
        granted && place
          ? upcomingReminders((dateKey) => prayerDayFor(dateKey, place, config), place.timeZone, { prayers, ...azkar }, new Date())
          : []
      const wording = { t, formatTime, timeZone: place?.timeZone ?? 'UTC', place: placeLabel, name }
      const prayerItems: PlannedNotification[] = []
      const azkarItems: PlannedNotification[] = []
      for (const entry of entries) {
        const { title, body } = reminderText(entry, wording)
        const planned = { id: reminderId(entry), title, body, at: entry.at }
        if (entry.kind === 'prayer') prayerItems.push({ ...planned, data: { prayer: entry.prayer, date: entry.dateKey } })
        else azkarItems.push({ ...planned, data: { session: entry.session, date: entry.dateKey } })
      }
      // A failure is tried again at the next start, return to the foreground or change.
      await Promise.all([
        replaceScheduledNotifications(PRAYER_GROUP, prayerItems).catch(() => {}),
        replaceScheduledNotifications(AZKAR_GROUP, azkarItems).catch(() => {}),
      ])
    }
    void sync()
    const stopActive = onAppActive(() => void sync())
    return () => {
      active = false
      stopActive()
    }
  }, [place, config, prayers, azkar, t, formatTime, placeLabel, name, today])

  return null
}
