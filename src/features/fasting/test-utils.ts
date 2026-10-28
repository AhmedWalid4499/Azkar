// Shared by this feature's tests only; nothing in the app imports it.
import { vi } from 'vitest'
import { partsOfDateKey, zonedParts } from '../../shared/date'
import { useLocationStore } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/settings'
import type { DateKey, PrayerDay, TimeSlot } from '../../shared/types'
import { useFasting } from './store'
import type { FastingDays } from './types'

/**
 * Freezes the clock at `iso` (an instant) and puts the saved location in
 * `timeZone`, so "today" is the day it is there. Only `Date` is faked, so
 * user-event keeps working; with `ticking`, intervals are faked too, so
 * `vi.advanceTimersByTime` moves a live countdown on.
 */
export function setClock(iso: string, timeZone = 'UTC', { ticking = false } = {}) {
  vi.useFakeTimers({ toFake: ticking ? ['Date', 'setInterval', 'clearInterval'] : ['Date'] })
  vi.setSystemTime(new Date(iso))
  useLocationStore.setState({
    location: { latitude: 0, longitude: 0, timeZone, label: 'Test', countryCode: null, source: 'manual', updatedAt: 0 },
  })
}

/** Noon UTC on `dateKey`, in UTC. */
export function freezeToday(dateKey: DateKey, timeZone = 'UTC') {
  setClock(`${dateKey}T12:00:00Z`, timeZone)
}

export function setSettings(settings: Partial<AppSettings> = {}) {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', timeFormat: '24h', ...settings })
}

export function seedFasts(days: FastingDays, owedBefore = 0) {
  useFasting.setState({ days, owedBefore })
}

/** Puts every store these tests touch back to its defaults. Call from `afterEach`. */
export function resetFasting() {
  vi.useRealTimers()
  useFasting.setState({ days: {}, owedBefore: 0 })
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
  useLocationStore.setState({ location: null })
}

/** The instant at which clocks in `timeZone` read `clock` ("HH:MM") on `dateKey`. */
export function zonedInstant(dateKey: DateKey, clock: string, timeZone: string): Date {
  const { year, month, day } = partsOfDateKey(dateKey)
  const [hour = 0, minute = 0] = clock.split(':').map(Number)
  const wanted = Date.UTC(year, month - 1, day, hour, minute)
  let guess = wanted
  // Two passes settle on the right offset even next to a DST change.
  for (let pass = 0; pass < 2; pass++) {
    const seen = zonedParts(new Date(guess), timeZone)
    guess += wanted - Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second)
  }
  return new Date(guess)
}

/**
 * A day's prayer times as `usePrayerDay` gives them, from wall-clock times in
 * `timeZone`. A time given as `null` does not exist that day (polar day or night).
 */
export function fakePrayerDay(
  dateKey: DateKey,
  times: Partial<Record<TimeSlot, string | null>>,
  timeZone: string,
): PrayerDay {
  const defaults: Record<TimeSlot, string> = {
    fajr: '05:00',
    sunrise: '06:15',
    dhuhr: '12:20',
    asr: '15:40',
    maghrib: '18:00',
    isha: '19:30',
  }
  const at = (slot: TimeSlot) => {
    const clock = times[slot] === undefined ? defaults[slot] : times[slot]
    return clock === null ? new Date(Number.NaN) : zonedInstant(dateKey, clock, timeZone)
  }
  return {
    dateKey,
    timeZone,
    times: {
      fajr: at('fajr'),
      sunrise: at('sunrise'),
      dhuhr: at('dhuhr'),
      asr: at('asr'),
      maghrib: at('maghrib'),
      isha: at('isha'),
    },
  }
}
