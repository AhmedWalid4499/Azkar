import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAllData, importBackup, STORE_KEYS } from '../shared/storage'
import { recordStorage } from '../shared/tabSyncTesting'
import { PERSISTED_STORES, startTabSync } from './tabSync'

const stops: Array<() => void> = []

/** One "tab": its own instances of the app's real stores over the shared localStorage, wired as main.tsx wires them. */
async function openTab() {
  vi.resetModules()
  const [wiring, { usePrayerLog }, { useSettings }] = await Promise.all([
    import('./tabSync'),
    import('../features/prayer-log/store'),
    import('../shared/settings'),
  ])
  const reload = vi.fn()
  const stop = wiring.startTabSync({ reload })
  stops.push(stop)
  return { usePrayerLog, useSettings, reload, stop }
}

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
const ALL_ON_TIME = { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime', isha: 'ontime' }

function storedLog(): unknown {
  const raw = localStorage.getItem('azkar:prayer-log')
  return raw === null ? null : (JSON.parse(raw) as { state: { entries: unknown } }).state.entries
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('tab sync wiring', () => {
  it('follows every persisted store, the same six that backup import knows', () => {
    // `persist` is only ever missing where the browser blocks storage.
    const persisted = PERSISTED_STORES.map((store) => store.persist!)
    const keys = persisted.map((persist) => persist.getOptions().name)
    expect([...keys].sort()).toEqual([...STORE_KEYS].sort())

    stops.push(startTabSync({ reload: vi.fn() }))
    for (const persist of persisted) {
      const { name, version } = persist.getOptions()
      const rehydrate = vi.spyOn(persist, 'rehydrate')
      const raw = JSON.stringify({ state: {}, version })
      localStorage.setItem(name!, raw)
      window.dispatchEvent(new StorageEvent('storage', { key: name, oldValue: null, newValue: raw, storageArea: localStorage }))
      expect(rehydrate, name).toHaveBeenCalledTimes(1)
    }
  })

  it('keeps the days logged in another tab when a tab opened earlier logs a prayer', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const b = await openTab()

    for (const prayer of PRAYERS) b.usePrayerLog.getState().setStatus('2026-10-11', prayer, 'ontime')
    for (const prayer of PRAYERS.slice(1)) b.usePrayerLog.getState().setStatus('2026-10-12', prayer, 'ontime')
    await storage.deliver()

    a.usePrayerLog.getState().setStatus('2026-10-12', 'fajr', 'ontime')

    expect(storedLog()).toEqual({ '2026-10-11': ALL_ON_TIME, '2026-10-12': ALL_ON_TIME })
    await storage.deliver()
    expect(b.usePrayerLog.getState().entries).toEqual({ '2026-10-11': ALL_ON_TIME, '2026-10-12': ALL_ON_TIME })
  })

  it('does not let another open tab write erased data back', async () => {
    const storage = recordStorage()
    const a = await openTab()
    const b = await openTab()
    a.usePrayerLog.getState().setStatus('2026-10-11', 'fajr', 'ontime')
    await storage.deliver()
    expect(b.usePrayerLog.getState().entries).toEqual({ '2026-10-11': { fajr: 'ontime' } })

    // "Erase all data" in tab A, which then reloads itself.
    a.stop()
    clearAllData()
    const writes = storage.writes()
    await storage.deliver()

    // Tab B starts over from the empty storage instead of carrying its copy on.
    expect(b.reload).toHaveBeenCalledTimes(1)
    expect(storage.writes()).toBe(writes)
    expect(storedLog()).toBeNull()
  })

  it('does not let a tab that is about to reload add anything to a backup imported elsewhere', async () => {
    const storage = recordStorage()
    // This tab has a setting saved and no location yet.
    const a = await openTab()
    a.useSettings.getState().update({ language: 'ar' })
    await storage.deliver()

    // Another tab imports a backup from before the calculation settings were saved with the first location.
    const cairo = { latitude: 30.044, longitude: 31.236, timeZone: 'Africa/Cairo', label: 'Cairo, Egypt', countryCode: 'EG', source: 'manual', updatedAt: 1 }
    importBackup({
      app: 'azkar',
      version: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      data: {
        'azkar:settings': { state: { language: 'en' }, version: 1 },
        'azkar:location': { state: { location: cairo }, version: 1 },
      },
    })
    const imported = { ...localStorage }
    await storage.deliver()

    expect(a.reload).toHaveBeenCalledTimes(1)
    // Read while on its way out, the location would look like this tab's first one and
    // make it save its own calculation settings into the imported data.
    expect({ ...localStorage }).toEqual(imported)
    expect(Object.keys(imported).sort()).toEqual(['azkar:location', 'azkar:settings'])
  })
})
