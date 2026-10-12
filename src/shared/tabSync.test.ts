import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedLocation } from './location'
import { clearAllData, exportBackup, importBackup, storageKey } from './storage'
import { syncStoresAcrossTabs } from './tabSync'
import { recordStorage } from './tabSyncTesting'

const SETTINGS_KEY = storageKey('settings')
const LOCATION_KEY = storageKey('location')

const CAIRO: SavedLocation = {
  latitude: 30.044,
  longitude: 31.236,
  timeZone: 'Africa/Cairo',
  label: 'Cairo, Egypt',
  countryCode: 'EG',
  source: 'manual',
  updatedAt: 1,
}
const MAKKAH: SavedLocation = { ...CAIRO, latitude: 21.423, longitude: 39.826, timeZone: 'Asia/Riyadh', label: 'Makkah', countryCode: 'SA' }

const stops: Array<() => void> = []

/**
 * One "tab": its own instances of two real stores, hydrated from the shared
 * localStorage as a freshly loaded page would be, and followed by the sync.
 */
async function openTab() {
  vi.resetModules()
  const [{ useSettings }, { useLocationStore }] = await Promise.all([import('./settings'), import('./location')])
  const reload = vi.fn()
  const stop = syncStoresAcrossTabs([useSettings, useLocationStore], { reload })
  stops.push(stop)
  return { useSettings, useLocationStore, reload, stop }
}

function becomeVisible() {
  document.dispatchEvent(new Event('visibilitychange'))
}

function stored(key: string): unknown {
  const raw = localStorage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as { state: unknown }).state
}

beforeEach(() => {
  expect(document.visibilityState).toBe('visible')
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('syncStoresAcrossTabs', () => {
  it('keeps a change made in another tab when this tab writes next', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const b = await openTab()

    b.useSettings.getState().update({ language: 'ar' })
    b.useLocationStore.getState().setLocation(CAIRO)
    await storage.deliver()

    expect(a.useSettings.getState().language).toBe('ar')
    expect(a.useLocationStore.getState().location).toEqual(CAIRO)

    a.useSettings.getState().update({ theme: 'dark' })
    expect(stored(SETTINGS_KEY)).toMatchObject({ language: 'ar', theme: 'dark' })
    await storage.deliver()
    expect(b.useSettings.getState()).toMatchObject({ language: 'ar', theme: 'dark' })
  })

  it('never writes in answer to another tab, so two tabs cannot ping-pong', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const b = await openTab()
    const rehydrateA = vi.spyOn(a.useLocationStore.persist, 'rehydrate')
    const rehydrateB = vi.spyOn(b.useLocationStore.persist, 'rehydrate')

    b.useLocationStore.getState().setLocation(CAIRO)
    await storage.deliver()

    expect(storage.writes()).toBe(1)
    expect(rehydrateA).toHaveBeenCalledTimes(1)
    // The writing tab hears about its own write here and has nothing to catch up on.
    expect(rehydrateB).not.toHaveBeenCalled()
  })

  it('reads a key again only when its stored string has changed', async () => {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: { location: CAIRO }, version: 1 }))
    const a = await openTab()
    const rehydrate = vi.spyOn(a.useLocationStore.persist, 'rehydrate')
    const location = a.useLocationStore.getState().location

    becomeVisible()
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    const raw = localStorage.getItem(LOCATION_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: LOCATION_KEY, oldValue: raw, newValue: raw, storageArea: localStorage }))

    expect(rehydrate).not.toHaveBeenCalled()
    // The same object, so nothing computed from it is thrown away.
    expect(a.useLocationStore.getState().location).toBe(location)
  })

  it('does not read back what this tab wrote itself', async () => {
    const a = await openTab()
    const rehydrate = vi.spyOn(a.useLocationStore.persist, 'rehydrate')

    a.useLocationStore.getState().setLocation(CAIRO)
    const location = a.useLocationStore.getState().location
    await Promise.resolve()
    becomeVisible()

    expect(rehydrate).not.toHaveBeenCalled()
    expect(a.useLocationStore.getState().location).toBe(location)
  })

  it('does not read back a save that changed nothing, which its listeners never heard of', async () => {
    const a = await openTab()
    const rehydrate = vi.spyOn(a.useSettings.persist, 'rehydrate')
    const state = a.useSettings.getState()
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull()

    // As the prayer-times store does when the first location is saved: its
    // settings, unchanged, written down for the first time.
    a.useSettings.setState((current) => current)
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull()
    await Promise.resolve()
    becomeVisible()

    expect(rehydrate).not.toHaveBeenCalled()
    expect(a.useSettings.getState()).toBe(state)

    // A real change from elsewhere is still picked up afterwards.
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: { language: 'ar' }, version: 1 }))
    becomeVisible()
    expect(a.useSettings.getState().language).toBe('ar')
  })

  it('catches up when the tab is shown again or restored from the back/forward cache', async () => {
    const a = await openTab()
    const write = (location: SavedLocation) =>
      localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: { location }, version: 1 }))

    // Written while this tab was frozen: no storage event reached it.
    write(CAIRO)
    becomeVisible()
    expect(a.useLocationStore.getState().location).toEqual(CAIRO)

    write(MAKKAH)
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    expect(a.useLocationStore.getState().location).toEqual(CAIRO)
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(a.useLocationStore.getState().location).toEqual(MAKKAH)
  })

  it('stays as it is while hidden, until a storage event or the next showing', async () => {
    const a = await openTab()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: { location: CAIRO }, version: 1 }))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(a.useLocationStore.getState().location).toBeNull()
  })

  it('reloads once, without writing, when another tab erases the data', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const b = await openTab()
    b.useSettings.getState().update({ language: 'ar' })
    b.useLocationStore.getState().setLocation(CAIRO)
    await storage.deliver()
    const writes = storage.writes()
    b.stop()

    clearAllData()
    await storage.deliver()

    expect(a.reload).toHaveBeenCalledTimes(1)
    // Nothing was written back over the erased keys.
    expect(storage.writes()).toBe(writes)
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull()
    expect(localStorage.getItem(LOCATION_KEY)).toBeNull()
  })

  it('reloads when another tab erases data that only this tab had saved', async () => {
    // Nothing was stored when this tab opened; what it holds, it wrote itself.
    const a = await openTab()
    a.useLocationStore.getState().setLocation(CAIRO)
    await Promise.resolve()

    // A browser tells a tab only about the other tabs' changes, here the erase.
    const raw = localStorage.getItem(LOCATION_KEY)
    localStorage.removeItem(LOCATION_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: LOCATION_KEY, oldValue: raw, newValue: null, storageArea: localStorage }))

    // Otherwise its next change would write the erased location back.
    expect(a.reload).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(LOCATION_KEY)).toBeNull()
  })

  it('reloads without touching a backup another tab has just imported', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const b = await openTab()
    b.useLocationStore.getState().setLocation(CAIRO)
    await storage.deliver()
    const backup = exportBackup()
    b.useLocationStore.getState().setLocation(MAKKAH)
    await storage.deliver()
    b.stop()

    // Removes every key, then writes the backup's: the other tab hears "removed" first.
    importBackup(backup)
    await storage.deliver()

    expect(a.reload).toHaveBeenCalledTimes(1)
    expect(stored(LOCATION_KEY)).toEqual({ location: CAIRO })
  })

  it('reads nothing more once it has asked for a reload', async () => {
    const storage = recordStorage()
    const a = await openTab()
    a.useSettings.getState().update({ language: 'ar' })
    await storage.deliver()
    const rehydrateSettings = vi.spyOn(a.useSettings.persist, 'rehydrate')
    const rehydrateLocation = vi.spyOn(a.useLocationStore.persist, 'rehydrate')

    // Another tab imports a backup: this tab's key is removed first, and the backup's keys follow
    // while the page is still on its way out.
    importBackup({ ...exportBackup(), data: { [SETTINGS_KEY]: { state: { theme: 'dark' }, version: 1 }, [LOCATION_KEY]: { state: { location: CAIRO }, version: 1 } } })
    await storage.deliver()

    expect(a.reload).toHaveBeenCalledTimes(1)
    // Reading them now could set off whatever the app does when a location first appears, and that may write.
    expect(rehydrateSettings).not.toHaveBeenCalled()
    expect(rehydrateLocation).not.toHaveBeenCalled()
    expect(a.useLocationStore.getState().location).toBeNull()
  })

  it('looks for an erased key before it reads any other, when catching up', async () => {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: { location: CAIRO }, version: 1 }))
    const a = await openTab()
    const rehydrateSettings = vi.spyOn(a.useSettings.persist, 'rehydrate')

    // Imported elsewhere while this tab was frozen: settings arrived, the location went.
    importBackup({ ...exportBackup(), data: { [SETTINGS_KEY]: { state: { language: 'ar' }, version: 1 } } })
    becomeVisible()

    expect(a.reload).toHaveBeenCalledTimes(1)
    expect(rehydrateSettings).not.toHaveBeenCalled()
    expect(a.useSettings.getState().language).toBe('system')
  })

  it('notices an erase that happened while the tab was frozen', async () => {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: { location: CAIRO }, version: 1 }))
    const a = await openTab()

    localStorage.removeItem(LOCATION_KEY)
    becomeVisible()

    expect(a.reload).toHaveBeenCalledTimes(1)
  })

  it('reloads after localStorage.clear() only if its own keys were among those cleared', async () => {
    const a = await openTab()
    localStorage.setItem('someone-else', '1')
    localStorage.removeItem('someone-else')
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
    expect(a.reload).not.toHaveBeenCalled()

    a.useSettings.getState().update({ theme: 'dark' })
    await Promise.resolve()
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
    expect(a.reload).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys and other storage areas', async () => {
    const a = await openTab()
    const rehydrate = vi.spyOn(a.useSettings.persist, 'rehydrate')
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: { language: 'ar' }, version: 1 }))

    window.dispatchEvent(new StorageEvent('storage', { key: 'someone-else', newValue: '1', storageArea: localStorage }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'someone-else', newValue: null, storageArea: localStorage }))
    window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_KEY, newValue: null, storageArea: sessionStorage }))

    expect(rehydrate).not.toHaveBeenCalled()
    expect(a.reload).not.toHaveBeenCalled()
  })

  it('leaves data stamped by a different build alone instead of migrating it back and forth', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const rehydrate = vi.spyOn(a.useSettings.persist, 'rehydrate')

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: { language: 'ar' }, version: 2 }))
    const writes = storage.writes()
    await storage.deliver()
    becomeVisible()

    expect(rehydrate).not.toHaveBeenCalled()
    expect(storage.writes()).toBe(writes)
  })

  it('has nothing to do, and does not fail, where the browser blocks storage', () => {
    // zustand leaves `persist` off a store it could not give a storage to.
    const unsaved = { getState: () => ({}), subscribe: () => () => {} }
    expect(() => stops.push(syncStoresAcrossTabs([unsaved]))).not.toThrow()

    const blocked = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    const addListener = vi.spyOn(window, 'addEventListener')
    try {
      expect(() => stops.push(syncStoresAcrossTabs([unsaved]))).not.toThrow()
      expect(addListener).not.toHaveBeenCalled()
    } finally {
      // Before the shared cleanup, which clears localStorage.
      blocked.mockRestore()
    }
  })

  it('stops following when asked', async () => {
    const a = await openTab()
    a.stop()

    localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: { location: CAIRO }, version: 1 }))
    becomeVisible()
    window.dispatchEvent(new StorageEvent('storage', { key: LOCATION_KEY, newValue: localStorage.getItem(LOCATION_KEY), storageArea: localStorage }))

    expect(a.useLocationStore.getState().location).toBeNull()
  })
})
