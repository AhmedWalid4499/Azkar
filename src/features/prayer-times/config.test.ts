import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { exportBackup } from '../../shared/storage'
import {
  DEFAULT_PRAYER_TIMES_SETTINGS,
  PRAYER_TIMES_STORAGE_KEY,
  PRAYER_TIMES_VERSION,
  sanitizeSettings,
  selectCalculation,
  usePrayerTimesStore,
} from './config'

const store = usePrayerTimesStore

function settingsOf(state = store.getState()) {
  const { method, madhab, highLatitudeRule, polar, adjustments, notifications } = state
  return { method, madhab, highLatitudeRule, polar, adjustments, notifications }
}

async function rehydrateFrom(stored: unknown) {
  localStorage.setItem(PRAYER_TIMES_STORAGE_KEY, JSON.stringify(stored))
  await store.persist.rehydrate()
  return settingsOf()
}

const KARACHI: SavedLocation = {
  latitude: 24.8607,
  longitude: 67.0011,
  timeZone: 'Asia/Karachi',
  label: 'Karachi, Pakistan',
  countryCode: 'PK',
  source: 'manual',
  updatedAt: Date.UTC(2026, 8, 1),
}

const storedRaw = () => localStorage.getItem(PRAYER_TIMES_STORAGE_KEY)

beforeEach(() => {
  useLocationStore.setState({ location: null })
  store.setState(DEFAULT_PRAYER_TIMES_SETTINGS)
})

describe('sanitizeSettings', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const junk of [undefined, null, 'x', 7, [], true]) {
      expect(sanitizeSettings(junk)).toEqual(DEFAULT_PRAYER_TIMES_SETTINGS)
    }
  })

  it('keeps valid fields and replaces invalid ones one by one', () => {
    expect(
      sanitizeSettings({
        method: 'Turkey',
        madhab: 'hanbali',
        highLatitudeRule: 'twilightangle',
        polar: 'aqrabYaum',
        adjustments: { fajr: 2, sunrise: '3', dhuhr: 99, asr: -99, maghrib: 1.4, isha: null, extra: 5 },
        notifications: 'yes',
      }),
    ).toEqual({
      method: 'Turkey',
      madhab: 'auto',
      highLatitudeRule: 'twilightangle',
      polar: 'unresolved',
      adjustments: { fajr: 2, sunrise: 0, dhuhr: 30, asr: -30, maghrib: 1, isha: 0 },
      notifications: false,
    })
  })

  it('accepts the three Asr schools and nothing else', () => {
    for (const madhab of ['auto', 'shafi', 'hanafi']) expect(sanitizeSettings({ madhab }).madhab).toBe(madhab)
    for (const madhab of ['Auto', 'maliki', '', null, 2, {}]) expect(sanitizeSettings({ madhab }).madhab).toBe('auto')
  })

  it('rejects method names that are not presets, including adhan’s blank one and inherited keys', () => {
    for (const method of ['Other', 'constructor', '__proto__', 'egyptian', 5]) {
      expect(sanitizeSettings({ method }).method).toBe('auto')
    }
    expect(sanitizeSettings({ highLatitudeRule: 'recommended' }).highLatitudeRule).toBe('auto')
  })
})

describe('persisted store', () => {
  it('saves only the settings, under the shared prefix, with a version', () => {
    store.getState().setMethod('Karachi')
    store.getState().setMadhab('hanafi')
    store.getState().setAdjustment('isha', 5)
    const stored = JSON.parse(localStorage.getItem(PRAYER_TIMES_STORAGE_KEY) ?? 'null')
    expect(stored).toEqual({
      version: PRAYER_TIMES_VERSION,
      state: {
        ...DEFAULT_PRAYER_TIMES_SETTINGS,
        method: 'Karachi',
        madhab: 'hanafi',
        adjustments: { ...DEFAULT_PRAYER_TIMES_SETTINGS.adjustments, isha: 5 },
      },
    })
    // The backup export finds it by its prefix.
    expect(exportBackup().data).toHaveProperty([PRAYER_TIMES_STORAGE_KEY])
  })

  it('clamps adjustments as they are set and resets them together', () => {
    store.getState().setAdjustment('fajr', 31)
    store.getState().setAdjustment('asr', -4.4)
    expect(store.getState().adjustments).toMatchObject({ fajr: 30, asr: -4 })
    store.getState().resetAdjustments()
    expect(store.getState().adjustments).toEqual(DEFAULT_PRAYER_TIMES_SETTINGS.adjustments)
  })

  it('reads a good backup back', async () => {
    const state = { ...DEFAULT_PRAYER_TIMES_SETTINGS, method: 'UmmAlQura', polar: 'nearestLatitude', notifications: true }
    expect(await rehydrateFrom({ version: PRAYER_TIMES_VERSION, state })).toEqual(state)
  })

  it('survives a tampered backup of the current version', async () => {
    const restored = await rehydrateFrom({
      version: PRAYER_TIMES_VERSION,
      state: { method: 'Nope', madhab: 'hanafi', adjustments: { fajr: 999, isha: 'x' }, setMethod: 'not a function' },
    })
    expect(restored).toEqual({
      ...DEFAULT_PRAYER_TIMES_SETTINGS,
      madhab: 'hanafi',
      adjustments: { ...DEFAULT_PRAYER_TIMES_SETTINGS.adjustments, fajr: 30 },
    })
    // The actions are still the store's own.
    expect(typeof store.getState().setMethod).toBe('function')
  })

  it('reads data stamped with another version field by field', async () => {
    expect(await rehydrateFrom({ version: 0, state: { method: 'Egyptian', madhab: 7 } })).toEqual({
      ...DEFAULT_PRAYER_TIMES_SETTINGS,
      method: 'Egyptian',
    })
    expect(await rehydrateFrom({ version: 99, state: 'garbage' })).toEqual(DEFAULT_PRAYER_TIMES_SETTINGS)
    expect(await rehydrateFrom({ version: PRAYER_TIMES_VERSION, state: null })).toEqual(DEFAULT_PRAYER_TIMES_SETTINGS)
  })
})

describe('the Asr school across an update', () => {
  /** What the previous build stored once any setting had been changed: every field, with its Asr school spelt out. */
  const stored = (madhab: 'shafi' | 'hanafi') => ({
    version: 1,
    state: { method: 'auto', madhab, highLatitudeRule: 'auto', polar: 'unresolved', adjustments: DEFAULT_PRAYER_TIMES_SETTINGS.adjustments, notifications: false },
  })

  it('is automatic on a new install', async () => {
    expect(DEFAULT_PRAYER_TIMES_SETTINGS.madhab).toBe('auto')
    localStorage.removeItem(PRAYER_TIMES_STORAGE_KEY)
    await store.persist.rehydrate()
    expect(store.getState().madhab).toBe('auto')
  })

  it.each(['shafi', 'hanafi'] as const)('keeps a stored "%s" exactly as stored, in a country where Automatic would differ', async (madhab) => {
    useLocationStore.setState({ location: madhab === 'shafi' ? KARACHI : { ...KARACHI, countryCode: 'EG', timeZone: 'Africa/Cairo' } })
    const raw = JSON.stringify(stored(madhab))
    localStorage.setItem(PRAYER_TIMES_STORAGE_KEY, raw)
    await store.persist.rehydrate()
    expect(store.getState().madhab).toBe(madhab)
    // Read, not migrated: what is in storage has not been touched.
    expect(storedRaw()).toBe(raw)
    expect(PRAYER_TIMES_VERSION).toBe(1)
  })

  it('keeps the standard Asr for an install that predates the choice and never saved a setting', async () => {
    // The previous build wrote nothing here until a setting was changed: all it left behind is the location.
    useLocationStore.setState({ location: KARACHI })
    localStorage.removeItem(PRAYER_TIMES_STORAGE_KEY)

    await store.persist.rehydrate()
    expect(settingsOf()).toEqual({ ...DEFAULT_PRAYER_TIMES_SETTINGS, madhab: 'shafi' })
    // Reading decides it the same way every time and writes nothing.
    expect(storedRaw()).toBeNull()
    await store.persist.rehydrate()
    expect(store.getState().madhab).toBe('shafi')

    // The first setting that person changes saves the school along with it.
    store.getState().setNotifications(true)
    expect(JSON.parse(storedRaw() ?? 'null').state.madhab).toBe('shafi')
    store.getState().setMadhab('auto')
    await store.persist.rehydrate()
    expect(store.getState().madhab).toBe('auto')
  })

  it('writes a new install’s settings down when it saves its first location, so it is not taken for an older one', async () => {
    localStorage.removeItem(PRAYER_TIMES_STORAGE_KEY)
    await store.persist.rehydrate()
    expect(store.getState().madhab).toBe('auto')
    expect(storedRaw()).toBeNull()

    const before = settingsOf()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    useLocationStore.getState().setLocation(KARACHI)
    unsubscribe()
    expect(JSON.parse(storedRaw() ?? 'null')).toEqual({ version: PRAYER_TIMES_VERSION, state: DEFAULT_PRAYER_TIMES_SETTINGS })
    // Saved like any other change, so whatever follows the store's writes (the tab sync) hears of this one; no setting moved.
    expect(listener).toHaveBeenCalledOnce()
    expect(settingsOf()).toEqual(before)
    expect(settingsOf().adjustments).toBe(before.adjustments)

    // The next start finds a location and its own saved settings: still automatic.
    await store.persist.rehydrate()
    expect(store.getState().madhab).toBe('auto')
  })

  it('does that once: a later change of location rewrites nothing and notifies nobody', () => {
    useLocationStore.getState().setLocation(KARACHI)
    store.getState().setMadhab('hanafi')
    const raw = storedRaw()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    useLocationStore.getState().setLocation({ ...KARACHI, latitude: 31.5204, longitude: 74.3587, label: 'Lahore, Pakistan' })
    useLocationStore.getState().clearLocation()
    useLocationStore.getState().setLocation(KARACHI)
    unsubscribe()

    expect(storedRaw()).toBe(raw)
    expect(listener).not.toHaveBeenCalled()
  })

  it('still saves the location when the settings cannot be written', () => {
    localStorage.removeItem(PRAYER_TIMES_STORAGE_KEY)
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === PRAYER_TIMES_STORAGE_KEY) throw new DOMException('full', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    expect(() => useLocationStore.getState().setLocation(KARACHI)).not.toThrow()
    expect(useLocationStore.getState().location).toBe(KARACHI)
    expect(JSON.parse(localStorage.getItem(useLocationStore.persist.getOptions().name ?? '') ?? 'null').state.location).toEqual(KARACHI)
  })
})

describe('selectCalculation', () => {
  it('hands every caller the same object until a calculation setting changes', () => {
    const first = selectCalculation(store.getState())
    expect(selectCalculation(store.getState())).toBe(first)

    store.getState().setNotifications(true)
    expect(selectCalculation(store.getState())).toBe(first)

    store.getState().setAdjustment('fajr', 1)
    const second = selectCalculation(store.getState())
    expect(second).not.toBe(first)
    expect(second.adjustments.fajr).toBe(1)
    expect(second).not.toHaveProperty('notifications')
  })
})
