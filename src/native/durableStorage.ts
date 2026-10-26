import { Preferences } from '@capacitor/preferences'
import { STORAGE_PREFIX } from '../shared/storage'
import { isNativeApp } from './platform'

/**
 * In the app, localStorage lives in the web view's data, which the system can
 * clear (for example when the device runs low on space). Every app key is
 * therefore also kept in native preferences, and put back from there on launch
 * if the web view lost it. Both functions do nothing in a browser.
 */

let mirroring = false

/** Run before any store module is imported, so the stores hydrate from restored data. */
export async function restoreFromNative(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { keys } = await Preferences.keys()
    for (const key of keys) {
      if (!key.startsWith(STORAGE_PREFIX) || localStorage.getItem(key) !== null) continue
      const { value } = await Preferences.get({ key })
      if (value !== null) localStorage.setItem(key, value)
    }
  } catch {
    // Start from whatever the web view still has.
  }
}

function mirror(task: () => Promise<unknown>): void {
  task().catch(() => {})
}

/**
 * From now on, every write of an app key to localStorage is copied to native
 * preferences. Storage's own methods are wrapped on the prototype because
 * assigning to localStorage.setItem would store an item named "setItem".
 */
export function mirrorToNative(): void {
  if (!isNativeApp() || mirroring) return
  mirroring = true

  const proto = Storage.prototype
  const setItem = proto.setItem
  const removeItem = proto.removeItem
  const clear = proto.clear

  proto.setItem = function (this: Storage, key: string, value: string) {
    setItem.call(this, key, value)
    if (this === localStorage && key.startsWith(STORAGE_PREFIX)) mirror(() => Preferences.set({ key, value }))
  }
  proto.removeItem = function (this: Storage, key: string) {
    removeItem.call(this, key)
    if (this === localStorage && key.startsWith(STORAGE_PREFIX)) mirror(() => Preferences.remove({ key }))
  }
  proto.clear = function (this: Storage) {
    clear.call(this)
    if (this === localStorage) mirror(() => Preferences.clear())
  }

  // Bring the mirror up to date with what the web view already holds.
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(STORAGE_PREFIX)) continue
    const value = localStorage.getItem(key)
    if (value !== null) mirror(() => Preferences.set({ key, value }))
  }
}
