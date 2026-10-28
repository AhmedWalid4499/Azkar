import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import {
  AZKAR_SETTINGS_STORAGE_KEY,
  DEFAULT_AZKAR_SETTINGS,
  MAX_TASBIH_TARGET,
  arabicFontSize,
  resolveAid,
  sanitizeAzkarSettings,
  useAzkarSettings,
  useReaderPrefs,
} from './settingsStore'

beforeEach(() => {
  useAzkarSettings.setState({ ...DEFAULT_AZKAR_SETTINGS })
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
})

describe('sanitizeAzkarSettings', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const value of [undefined, null, 'x', 3, []]) {
      expect(sanitizeAzkarSettings(value)).toEqual(DEFAULT_AZKAR_SETTINGS)
    }
  })

  it('keeps valid fields and replaces invalid ones with their defaults', () => {
    expect(
      sanitizeAzkarSettings({
        arabicScale: 9,
        showTransliteration: 'yes',
        showTranslation: false,
        haptics: 0,
        keepAwake: false,
        autoAdvance: null,
        unknown: true,
      }),
    ).toEqual({ ...DEFAULT_AZKAR_SETTINGS, showTranslation: false, keepAwake: false })
  })

  it('accepts every text size step and nothing in between', () => {
    for (const scale of [1, 2, 3, 4, 5]) expect(sanitizeAzkarSettings({ arabicScale: scale }).arabicScale).toBe(scale)
    for (const scale of [0, 6, 2.5, '3', null]) expect(sanitizeAzkarSettings({ arabicScale: scale }).arabicScale).toBe(3)
  })
})

describe('tasbih choices', () => {
  it('start on the first preset with a target of 33', () => {
    expect(DEFAULT_AZKAR_SETTINGS).toMatchObject({ tasbihPreset: null, tasbihFree: false, tasbihTarget: 33 })
  })

  it('keep a preset id, the free count and any whole target up to the maximum, or no target', () => {
    expect(sanitizeAzkarSettings({ tasbihPreset: 'preset-two', tasbihFree: true, tasbihTarget: 7 })).toMatchObject({
      tasbihPreset: 'preset-two',
      tasbihFree: true,
      tasbihTarget: 7,
    })
    expect(sanitizeAzkarSettings({ tasbihTarget: null }).tasbihTarget).toBeNull()
    expect(sanitizeAzkarSettings({ tasbihTarget: MAX_TASBIH_TARGET }).tasbihTarget).toBe(MAX_TASBIH_TARGET)
  })

  it('fall back to the defaults for anything else', () => {
    for (const tasbihTarget of [0, -3, 2.5, '33', MAX_TASBIH_TARGET + 1, true]) {
      expect(sanitizeAzkarSettings({ tasbihTarget }).tasbihTarget).toBe(33)
    }
    for (const tasbihPreset of ['', 7, 'x'.repeat(101), {}]) {
      expect(sanitizeAzkarSettings({ tasbihPreset }).tasbihPreset).toBeNull()
    }
    expect(sanitizeAzkarSettings({ tasbihFree: 'yes' }).tasbihFree).toBe(false)
  })

  it('are kept with the other settings, and read back from what an older build saved without them', async () => {
    useAzkarSettings.getState().update({ tasbihPreset: 'preset-two', tasbihTarget: 100 })
    expect(JSON.parse(localStorage.getItem(AZKAR_SETTINGS_STORAGE_KEY)!).state).toMatchObject({
      tasbihPreset: 'preset-two',
      tasbihTarget: 100,
    })
    localStorage.setItem(
      AZKAR_SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { arabicScale: 2, showTransliteration: null, showTranslation: null, haptics: true, keepAwake: true, autoAdvance: false }, version: 1 }),
    )
    await useAzkarSettings.persist.rehydrate()
    expect(useAzkarSettings.getState()).toMatchObject({ arabicScale: 2, autoAdvance: false, tasbihPreset: null, tasbihTarget: 33 })
  })
})

describe('text size', () => {
  it('is about 1.75rem at the middle step and grows with each step', () => {
    expect(arabicFontSize(3)).toBe('1.75rem')
    const sizes = ([1, 2, 3, 4, 5] as const).map((scale) => Number.parseFloat(arabicFontSize(scale)))
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
    expect(new Set(sizes).size).toBe(5)
  })
})

describe('reading aids', () => {
  it('default to on in English and off in Arabic until the user chooses', () => {
    expect(resolveAid(null, 'en')).toBe(true)
    expect(resolveAid(null, 'ar')).toBe(false)
    expect(resolveAid(false, 'en')).toBe(false)
    expect(resolveAid(true, 'ar')).toBe(true)
  })

  it('follow a language switch only while no choice has been made', () => {
    const { result, rerender } = renderHook(() => useReaderPrefs())
    expect(result.current).toMatchObject({ showTranslation: true, showTransliteration: true })

    useAzkarSettings.getState().update({ showTranslation: true })
    useSettings.setState({ language: 'ar' })
    rerender()
    expect(result.current).toMatchObject({ showTranslation: true, showTransliteration: false })
  })
})

describe('persistence', () => {
  it('stores the settings without the store’s functions', () => {
    useAzkarSettings.getState().update({ arabicScale: 5, autoAdvance: false })
    expect(JSON.parse(localStorage.getItem(AZKAR_SETTINGS_STORAGE_KEY)!)).toEqual({
      state: { ...DEFAULT_AZKAR_SETTINGS, arabicScale: 5, autoAdvance: false },
      version: 1,
    })
  })

  it('refuses an invalid update', () => {
    useAzkarSettings.getState().update({ arabicScale: 42 as never, haptics: 'on' as never })
    expect(useAzkarSettings.getState()).toMatchObject(DEFAULT_AZKAR_SETTINGS)
  })

  it('validates what it loads, as after importing a backup', async () => {
    localStorage.setItem(
      AZKAR_SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { arabicScale: 1, haptics: 'no', showTranslation: true, update: 1 }, version: 1 }),
    )
    await useAzkarSettings.persist.rehydrate()
    const state = useAzkarSettings.getState()
    expect(state).toMatchObject({ ...DEFAULT_AZKAR_SETTINGS, arabicScale: 1, showTranslation: true })
    expect(typeof state.update).toBe('function')
  })
})
