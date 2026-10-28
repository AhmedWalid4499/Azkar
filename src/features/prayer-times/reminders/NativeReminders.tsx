import { useEffect, useRef } from 'react'
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
import { AZKAR_GROUP, PRAYER_GROUP, reminderId, reminderText, UNLOGGED_GROUP, upcomingReminders } from './plan'
import type { ReminderEntry } from './plan'
import { useLoggedPrayers } from './useLoggedPrayers'

/** Each kind of reminder is replaced in its own group. */
const GROUPS: Record<ReminderEntry['kind'], string> = {
  prayer: PRAYER_GROUP,
  unlogged: UNLOGGED_GROUP,
  azkar: AZKAR_GROUP,
}

function dataOf(entry: ReminderEntry): Record<string, string> {
  return entry.kind === 'azkar' ? { session: entry.session, date: entry.dateKey } : { prayer: entry.prayer, date: entry.dateKey }
}

/**
 * The installed app's reminders: handed to the system for the days ahead, so
 * they arrive with the app closed, and handed over again whenever the app
 * comes back to the foreground or anything they depend on changes, the prayer
 * log among them: a prayer logged loses its "not logged yet" reminder at once,
 * and one cleared gets it back. A tap on one opens the screen it is about.
 * Must be mounted inside the router; renders nothing.
 */
export function NativeReminders() {
  const navigate = useNavigate()
  const { t, tp } = useI18n()
  const formatTime = useClockFormat()
  const place = usePlace()
  const config = useCalculationConfig()
  const prayers = usePrayerTimesStore((state) => state.notifications)
  const azkar = usePrayerTimesStore((state) => state.azkarReminders)
  const unlogged = usePrayerTimesStore((state) => state.unloggedReminders)
  const placeLabel = useLocationLabel()
  const name = useSettings((state) => state.name)
  // While the app stays open across midnight, the week ahead moves on with the day.
  const today = useLocalToday()
  const isLogged = useLoggedPrayers(today)
  // The latest sync to start: an older one stops once a newer one is on its way.
  const latestSync = useRef(0)

  useEffect(() => {
    const stops = [
      onNotificationTap(PRAYER_GROUP, () => navigate('/')),
      onNotificationTap(UNLOGGED_GROUP, () => navigate('/')),
      onNotificationTap(AZKAR_GROUP, ({ data }) => {
        navigate(data.session === 'morning' || data.session === 'evening' ? `/azkar/${data.session}` : '/azkar')
      }),
    ]
    return () => stops.forEach((stop) => stop())
  }, [navigate])

  useEffect(() => {
    let active = true
    const sync = async () => {
      const run = ++latestSync.current
      // Never ask from here (scheduling would ask by itself): that is for the switches
      // in Settings. Without the permission nothing would be shown, so nothing stays scheduled.
      const granted = (await nativeNotificationPermission()) === 'granted'
      // Overtaken while it waited: the newer one does the work, and clearing now could undo it.
      if (!active || run !== latestSync.current) return
      const choices = {
        prayers,
        ...azkar,
        unlogged: unlogged.enabled ? { leadMinutes: unlogged.leadMinutes, ishaEnds: unlogged.ishaEnds, isLogged } : undefined,
      }
      const entries =
        granted && place
          ? upcomingReminders((dateKey) => prayerDayFor(dateKey, place, config), place.timeZone, choices, new Date())
          : []
      const wording = { t, tp, formatTime, timeZone: place?.timeZone ?? 'UTC', place: placeLabel, name }
      const planned: Record<ReminderEntry['kind'], PlannedNotification[]> = { prayer: [], unlogged: [], azkar: [] }
      for (const entry of entries) {
        const { title, body } = reminderText(entry, wording)
        planned[entry.kind].push({ id: reminderId(entry), title, body, at: entry.at, data: dataOf(entry) })
      }
      const kinds = Object.keys(GROUPS) as Array<ReminderEntry['kind']>
      // A failure is tried again at the next start, return to the foreground or change.
      const replaceAll = (items: (kind: ReminderEntry['kind']) => PlannedNotification[]) =>
        Promise.all(kinds.map((kind) => replaceScheduledNotifications(GROUPS[kind], items(kind)).catch(() => {})))
      // Everything is cleared before anything is scheduled: while one group grew
      // and another had not shrunk yet, the app would hold more than iOS keeps.
      await replaceAll(() => [])
      // Unmounted alone, it still finishes: nothing else would put the reminders back.
      if (run !== latestSync.current) return
      await replaceAll((kind) => planned[kind])
    }
    void sync()
    const stopActive = onAppActive(() => void sync())
    return () => {
      active = false
      stopActive()
    }
  }, [place, config, prayers, azkar, unlogged, isLogged, t, tp, formatTime, placeLabel, name, today])

  return null
}
