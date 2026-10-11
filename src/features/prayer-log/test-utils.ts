import { vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { DateKey, Lang } from '../../shared/types'
import { usePrayerLog } from './store'
import type { LogEntries } from './types'

/**
 * Pins "today" for components that read it through `useTodayKey`: the clock is
 * frozen at noon UTC on `dateKey` and the saved location puts the app in
 * `timeZone`. Only `Date` is faked, so timers and user-event keep working.
 */
export function freezeToday(dateKey: DateKey, timeZone = 'UTC') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${dateKey}T12:00:00Z`))
  useLocationStore.setState({
    location: { latitude: 0, longitude: 0, timeZone, label: 'Test', countryCode: null, source: 'manual', updatedAt: 0 },
  })
}

export function setLanguage(language: Lang) {
  useSettings.setState({ language })
}

export function seedLog(entries: LogEntries) {
  usePrayerLog.setState({ entries })
}

/** Puts every store these tests touch back to its defaults. Call from `afterEach`. */
export function resetApp() {
  vi.useRealTimers()
  usePrayerLog.setState({ entries: {} })
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
  useLocationStore.setState({ location: null })
}
