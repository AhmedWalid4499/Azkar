import { beforeEach, describe, expect, it } from 'vitest'
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

beforeEach(() => {
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
      madhab: 'shafi',
      highLatitudeRule: 'twilightangle',
      polar: 'unresolved',
      adjustments: { fajr: 2, sunrise: 0, dhuhr: 30, asr: -30, maghrib: 1, isha: 0 },
      notifications: false,
    })
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
