import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatHijri } from './date'
import { DEFAULT_SETTINGS, sanitizeSettings, SETTINGS_STORAGE_KEY, useSettings } from './settings'

function store(state: unknown, version = 1) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ state, version }))
}

const stored = () => (JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!) as { state: unknown }).state

afterEach(() => {
  useSettings.setState(DEFAULT_SETTINGS)
})

describe('sanitizeSettings', () => {
  it('keeps valid settings as they are', () => {
    const settings = { language: 'ar', theme: 'dark', timeFormat: '24h', arabicDigits: false, hijriOffset: -2 }
    expect(sanitizeSettings(settings)).toEqual(settings)
  })

  it('gives the defaults for anything that is not a settings object', () => {
    for (const value of [undefined, null, 'x', 7, [], [1, 2]]) expect(sanitizeSettings(value)).toEqual(DEFAULT_SETTINGS)
  })

  it('replaces each bad field with its default without touching the others', () => {
    for (const language of ['fr', 'AR', 'x', null, 5, {}]) {
      expect(sanitizeSettings({ language, theme: 'dark' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
    }
    expect(sanitizeSettings({ theme: 'sepia', timeFormat: 12, arabicDigits: 'yes', language: 'en' })).toEqual({
      ...DEFAULT_SETTINGS,
      language: 'en',
    })
  })

  it('takes the Hijri offset only as a whole number, within two days either way', () => {
    const offsetOf = (hijriOffset: unknown) => sanitizeSettings({ hijriOffset }).hijriOffset
    expect([-2, -1, 0, 1, 2].map(offsetOf)).toEqual([-2, -1, 0, 1, 2])
    expect([30, 1e9, -30].map(offsetOf)).toEqual([2, 2, -2])
    // Nothing is coerced: "1" would otherwise be glued onto the day of the month.
    for (const bad of ['1', 1.5, Number.NaN, Infinity, {}, null, true]) expect(offsetOf(bad)).toBe(0)
  })

  it('drops everything that is not a setting', () => {
    expect(Object.keys(sanitizeSettings({ ...DEFAULT_SETTINGS, update: 1, extra: 'x' })).sort()).toEqual(
      Object.keys(DEFAULT_SETTINGS).sort(),
    )
  })
})

describe('useSettings', () => {
  it('survives a damaged backup: values that would break every screen fall back to defaults', async () => {
    store({ language: 'fr', theme: 'dark', hijriOffset: 1e9, update: 1 })
    await useSettings.persist.rehydrate()

    const state = useSettings.getState()
    expect(state).toMatchObject({ language: 'system', theme: 'dark', hijriOffset: 2 })
    // The stored "update" did not replace the action.
    expect(typeof state.update).toBe('function')
    expect(() => formatHijri('2026-10-12', 'en', state.hijriOffset)).not.toThrow()
  })

  it('validates what a freshly loaded page reads, whatever version it is stamped with', async () => {
    for (const version of [1, 7]) {
      store({ language: null, timeFormat: '24h', hijriOffset: '1' }, version)
      vi.resetModules()
      const fresh = await import('./settings')
      expect(fresh.useSettings.getState()).toMatchObject({ ...DEFAULT_SETTINGS, timeFormat: '24h' })
    }
  })

  it('goes back to the defaults when the stored settings are gone', async () => {
    useSettings.getState().update({ language: 'ar', hijriOffset: 1 })
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
    await useSettings.persist.rehydrate()
    expect(useSettings.getState()).toMatchObject(DEFAULT_SETTINGS)
  })

  it('checks changes on the way in and writes only the settings', () => {
    useSettings.getState().update({ hijriOffset: 9, language: 'de' as never })
    expect(useSettings.getState()).toMatchObject({ hijriOffset: 2, language: 'system' })

    useSettings.getState().update({ language: 'ar' })
    expect(stored()).toEqual({ ...DEFAULT_SETTINGS, language: 'ar', hijriOffset: 2 })
  })
})
