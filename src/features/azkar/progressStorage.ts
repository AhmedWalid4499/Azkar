import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { storageKey } from '../../shared/storage'
import { emptyAfterPrayer } from './afterPrayerData'
import { isRecord } from './progressData'
import { emptyTasbih } from './tasbihData'

/**
 * A second copy of what only version 3 of the store holds: the after-prayer and tasbih records.
 *
 * A build of version 2 (a tab left open across an update, a rolled-back deploy) reads the
 * store's key as far as it understands it and saves back only that, so these records would be
 * gone. It never touches this key, though, and when version 3 next finds its data saved without
 * them, it takes them from here. Like every `azkar:` key it goes with "Erase all data", and
 * importing a backup removes it (only the store's own key is written back).
 */
export const AZKAR_PROGRESS_SPARE_KEY = storageKey('azkar-progress-spare')

const SPARE_FIELDS = ['afterPrayer', 'tasbih'] as const
const NOTHING_TO_SPARE = JSON.stringify({ afterPrayer: emptyAfterPrayer(), tasbih: emptyTasbih() })

function spareOf(state: unknown): string {
  const fields = isRecord(state) ? state : {}
  return JSON.stringify(Object.fromEntries(SPARE_FIELDS.map((field) => [field, fields[field]])))
}

function readSpare(storage: Storage): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(AZKAR_PROGRESS_SPARE_KEY)
    const spare: unknown = raw === null ? null : JSON.parse(raw)
    return isRecord(spare) ? spare : null
  } catch {
    return null
  }
}

/**
 * localStorage as zustand's default JSON storage uses it, plus the spare copy. `undefined`
 * when the browser denies access to storage: the store then works unsaved, as by default.
 */
export function progressStorage<S>(): PersistStorage<S> | undefined {
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    return undefined
  }

  return {
    getItem: (name) => {
      const raw = storage.getItem(name)
      if (raw === null) return null
      const value: unknown = JSON.parse(raw)
      if (!isRecord(value) || !isRecord(value.state)) return value as StorageValue<S>
      const stored = value.state
      // Data saved by version 3 always has both, empty or not.
      const missing = SPARE_FIELDS.filter((field) => !Object.hasOwn(stored, field))
      const spare = missing.length > 0 ? readSpare(storage) : null
      if (!spare) return value as StorageValue<S>
      const state = { ...stored }
      for (const field of missing) {
        if (Object.hasOwn(spare, field)) state[field] = spare[field]
      }
      return { ...value, state } as StorageValue<S>
    },
    setItem: (name, value) => {
      storage.setItem(name, JSON.stringify(value))
      try {
        const spare = spareOf(value.state)
        const kept = storage.getItem(AZKAR_PROGRESS_SPARE_KEY)
        if (kept === spare || (kept === null && spare === NOTHING_TO_SPARE)) return
        storage.setItem(AZKAR_PROGRESS_SPARE_KEY, spare)
      } catch {
        // The store itself is saved; the spare is only a safeguard.
      }
    },
    removeItem: (name) => {
      storage.removeItem(name)
      storage.removeItem(AZKAR_PROGRESS_SPARE_KEY)
    },
  }
}
