// Shared by the tab-sync tests only; nothing in the app imports it.
import { vi } from 'vitest'

/**
 * A browser tells the other tabs about each change to localStorage; jsdom has
 * only this one window. Changes are recorded here and announced by `deliver`,
 * to every "tab" in the test including the one that wrote, which must then
 * find it has nothing to catch up on.
 */
export function recordStorage() {
  const pending: StorageEventInit[] = []
  let writes = 0
  const { setItem, removeItem } = Storage.prototype
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    const oldValue = this.getItem(key)
    setItem.call(this, key, value)
    writes += 1
    if (oldValue !== value) pending.push({ key, oldValue, newValue: value, storageArea: this })
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
    const oldValue = this.getItem(key)
    removeItem.call(this, key)
    if (oldValue !== null) pending.push({ key, oldValue, newValue: null, storageArea: this })
  })
  return {
    /** How many times anything was written, whether or not the value changed. */
    writes: () => writes,
    /** Events are tasks: they arrive after the writing tab's own microtasks, and keep coming until nobody answers. */
    deliver: async () => {
      for (let round = 0; round < 10; round++) {
        await Promise.resolve()
        if (pending.length === 0) return
        for (const init of pending.splice(0)) window.dispatchEvent(new StorageEvent('storage', init))
      }
      throw new Error('The tabs keep answering each other')
    },
  }
}
