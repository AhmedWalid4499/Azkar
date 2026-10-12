import { useAzkarProgress } from '../features/azkar/progressStore'
import { useAzkarSettings } from '../features/azkar/settingsStore'
import { usePrayerLog } from '../features/prayer-log/store'
import { usePrayerTimesStore } from '../features/prayer-times/config'
import { useLocationStore } from '../shared/location'
import { useSettings } from '../shared/settings'
import { syncStoresAcrossTabs } from '../shared/tabSync'
import type { PersistedStore, TabSyncOptions } from '../shared/tabSync'

/** Every store that is saved on the device. Each key is also listed in `STORE_KEYS` (shared/storage). */
export const PERSISTED_STORES: readonly PersistedStore[] = [
  useSettings,
  useLocationStore,
  usePrayerTimesStore,
  usePrayerLog,
  useAzkarProgress,
  useAzkarSettings,
]

/**
 * Keeps this tab's data in step with the app's other open tabs and windows.
 * Call once at startup. Returns a function that stops it.
 */
export function startTabSync(options?: TabSyncOptions): () => void {
  return syncStoresAcrossTabs(PERSISTED_STORES, options)
}
