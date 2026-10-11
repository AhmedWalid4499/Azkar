// Shared by this feature's tests only; nothing in the app imports it.
import { partsOfDateKey, zonedParts } from '../../shared/date'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/settings'
import type { DateKey } from '../../shared/types'
import { DEFAULT_PRAYER_TIMES_SETTINGS, usePrayerTimesStore } from './config'
import type { PrayerTimesSettings } from './config'

export const CAIRO: SavedLocation = {
  latitude: 30.0444,
  longitude: 31.2357,
  timeZone: 'Africa/Cairo',
  label: 'Cairo, Egypt',
  countryCode: 'EG',
  source: 'manual',
  updatedAt: Date.UTC(2026, 9, 1, 9, 30),
}

export const TROMSO: SavedLocation = {
  latitude: 69.6492,
  longitude: 18.9553,
  timeZone: 'Europe/Oslo',
  label: 'Tromsø, Norway',
  countryCode: 'NO',
  source: 'manual',
  updatedAt: Date.UTC(2026, 5, 1),
}

export const REYKJAVIK: SavedLocation = {
  latitude: 64.1466,
  longitude: -21.9426,
  timeZone: 'Atlantic/Reykjavik',
  label: 'Reykjavík, Iceland',
  countryCode: 'IS',
  source: 'manual',
  updatedAt: Date.UTC(2026, 5, 1),
}

/** The instant at which clocks in `timeZone` read `clock` ("HH:MM" or "HH:MM:SS") on `dateKey`. */
export function zonedInstant(dateKey: DateKey, clock: string, timeZone: string): Date {
  const { year, month, day } = partsOfDateKey(dateKey)
  const [hour = 0, minute = 0, second = 0] = clock.split(':').map(Number)
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second)
  let guess = wanted
  // Two passes settle on the right offset even next to a DST change.
  for (let pass = 0; pass < 2; pass++) {
    const seen = zonedParts(new Date(guess), timeZone)
    guess += wanted - Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second)
  }
  return new Date(guess)
}

/** Puts the three stores this feature reads into a known state. English, 24-hour unless overridden. */
export function resetStores(
  options: { location?: SavedLocation | null; settings?: Partial<AppSettings>; prayerTimes?: Partial<PrayerTimesSettings> } = {},
) {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', timeFormat: '24h', ...options.settings })
  useLocationStore.setState({ location: options.location ?? null })
  usePrayerTimesStore.setState({ ...DEFAULT_PRAYER_TIMES_SETTINGS, ...options.prayerTimes })
}

// The app's tsconfig carries no Node types, so the runner's environment is reached by hand.
const runtime = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process
const ORIGINAL_TZ = runtime.env.TZ

/** Moves the "device" (the test process) to another time zone. Undo with `restoreDeviceZone` after each test. */
export function setDeviceZone(zone: string) {
  runtime.env.TZ = zone
}

export function restoreDeviceZone() {
  if (ORIGINAL_TZ === undefined) delete runtime.env.TZ
  else runtime.env.TZ = ORIGINAL_TZ
}
