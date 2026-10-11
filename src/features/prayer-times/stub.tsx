// Scaffold placeholder. Replace with the real feature and delete this file.
import type { ReactNode } from 'react'
import type { DateKey, PrayerDay, PrayerName, UpcomingPrayer } from '../../shared/types'
import { Card } from '../../shared/ui'

/** Prayer times for a calendar day at the saved location (today when omitted). `null` until a location is set. */
export function usePrayerDay(_dateKey?: DateKey): PrayerDay | null {
  return null
}

/** The next obligatory prayer from now, rolling over to tomorrow's Fajr after Isha. `null` until a location is set. */
export function useNextPrayer(): UpcomingPrayer | null {
  return null
}

/** Hero card: the next prayer, its time and a live countdown. */
export function NextPrayerCard() {
  return <Card>Next prayer</Card>
}

export interface PrayerTimesListProps {
  dateKey: DateKey
  /** Rendered at the end of each of the five prayer rows (not sunrise), e.g. a log toggle. */
  renderTrailing?: (prayer: PrayerName) => ReactNode
}

/** The day's timetable: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha. */
export function PrayerTimesList({ dateKey }: PrayerTimesListProps) {
  return <Card>Times for {dateKey}</Card>
}

/** Shown on the Today page while no location is saved: asks for GPS or a city. */
export function LocationPrompt() {
  return <Card>Set your location</Card>
}

/** `<Section>`s for the Settings page. */
export function LocationSettingsSection() {
  return null
}

export function CalculationSettingsSection() {
  return null
}

export function NotificationSettingsSection() {
  return null
}

/** Mounted once in the app shell. Schedules prayer-time reminders while the app is open; renders nothing. */
export function PrayerNotifier() {
  return null
}
