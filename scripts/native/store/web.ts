// Loads the website's real persisted stores, fresh, from whatever localStorage holds,
// exactly as a page load does, and reads back what each store would save.
import { vi } from 'vitest'

/** The six keys the website reads (src/shared/storage.ts STORE_KEYS), in the order a page creates the stores. */
export const STORE_NAMES = ['location', 'settings', 'prayer-times', 'prayer-log', 'azkar-progress', 'azkar-settings'] as const
export type StoreName = (typeof STORE_NAMES)[number]

export async function loadStores() {
  vi.resetModules()
  // config.ts imports location.ts, so the location store is always created (and hydrated) first.
  const { useLocationStore } = await import('../../../src/shared/location')
  const { useSettings } = await import('../../../src/shared/settings')
  const { usePrayerTimesStore } = await import('../../../src/features/prayer-times/config')
  const { usePrayerLog } = await import('../../../src/features/prayer-log/store')
  const { useAzkarProgress } = await import('../../../src/features/azkar/progressStore')
  const { useAzkarSettings } = await import('../../../src/features/azkar/settingsStore')
  const storage = await import('../../../src/shared/storage')
  const data = await import('../../../src/features/azkar/data')
  const session = await import('../../../src/features/azkar/session')
  return {
    stores: {
      location: useLocationStore,
      settings: useSettings,
      'prayer-times': usePrayerTimesStore,
      'prayer-log': usePrayerLog,
      'azkar-progress': useAzkarProgress,
      'azkar-settings': useAzkarSettings,
    } as Record<StoreName, PersistedStore>,
    storage,
    data,
    session,
  }
}

interface PersistedStore {
  getState: () => Record<string, unknown>
  persist: { getOptions: () => { partialize?: (state: Record<string, unknown>) => unknown } }
}

/** What the store saves right now: its `partialize`, through JSON as localStorage keeps it. */
export function persistedState(store: PersistedStore): unknown {
  const partialize = store.persist.getOptions().partialize ?? ((state: unknown) => state)
  return JSON.parse(JSON.stringify(partialize(store.getState())))
}

/** Puts exactly `raw` in localStorage (a `null` value is no key), loads the stores and returns what each holds. */
export async function hydrate(raw: Record<string, string | null>): Promise<Record<StoreName, unknown>> {
  localStorage.clear()
  for (const [key, value] of Object.entries(raw)) if (value !== null) localStorage.setItem(key, value)
  const { stores } = await loadStores()
  return Object.fromEntries(STORE_NAMES.map((name) => [name, persistedState(stores[name])])) as Record<StoreName, unknown>
}

/** Everything under the app's prefix, as the strings the Capacitor build mirrored into native preferences. */
export function localStorageSnapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('azkar:')) out[key] = localStorage.getItem(key) as string
  }
  return out
}
