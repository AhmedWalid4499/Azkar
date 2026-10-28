import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_TODAY_LAYOUT,
  sanitizeTodayLayout,
  TODAY_LAYOUT_STORAGE_KEY,
  TODAY_LAYOUT_VERSION,
  useTodayLayout,
} from './layoutStore'

const stored = () => JSON.parse(localStorage.getItem(TODAY_LAYOUT_STORAGE_KEY) ?? 'null') as unknown

afterEach(() => {
  useTodayLayout.setState(DEFAULT_TODAY_LAYOUT)
})

describe('the Today layout', () => {
  it('starts with every card open', () => {
    expect(useTodayLayout.getState().sunnahCollapsed).toBe(false)
  })

  it('saves the choice under the app prefix, versioned', () => {
    useTodayLayout.getState().setSunnahCollapsed(true)
    expect(TODAY_LAYOUT_STORAGE_KEY).toBe('azkar:today-layout')
    expect(stored()).toEqual({ state: { sunnahCollapsed: true }, version: TODAY_LAYOUT_VERSION })
  })

  it('restores the choice', async () => {
    localStorage.setItem(TODAY_LAYOUT_STORAGE_KEY, JSON.stringify({ state: { sunnahCollapsed: true }, version: 1 }))
    await useTodayLayout.persist.rehydrate()
    expect(useTodayLayout.getState().sunnahCollapsed).toBe(true)
    // The action survives a rehydrate.
    useTodayLayout.getState().setSunnahCollapsed(false)
    expect(useTodayLayout.getState().sunnahCollapsed).toBe(false)
  })

  it.each([
    ['a string', { state: { sunnahCollapsed: 'true' }, version: 1 }],
    ['a number', { state: { sunnahCollapsed: 1 }, version: 1 }],
    ['a state that is not an object', { state: 'collapsed', version: 1 }],
    ['another version with nothing usable', { state: [], version: 7 }],
  ])('falls back to the default for %s', async (_name, value) => {
    useTodayLayout.setState({ sunnahCollapsed: true })
    localStorage.setItem(TODAY_LAYOUT_STORAGE_KEY, JSON.stringify(value))
    await useTodayLayout.persist.rehydrate()
    expect(useTodayLayout.getState().sunnahCollapsed).toBe(false)
  })

  it('reads data stamped with another version field by field', async () => {
    localStorage.setItem(TODAY_LAYOUT_STORAGE_KEY, JSON.stringify({ state: { sunnahCollapsed: true, extra: 1 }, version: 9 }))
    await useTodayLayout.persist.rehydrate()
    expect(useTodayLayout.getState().sunnahCollapsed).toBe(true)
    expect(stored()).toEqual({ state: { sunnahCollapsed: true }, version: TODAY_LAYOUT_VERSION })
  })

  it('keeps nothing but its own field', () => {
    expect(sanitizeTodayLayout({ sunnahCollapsed: true, setSunnahCollapsed: 'x' })).toEqual({ sunnahCollapsed: true })
    expect(sanitizeTodayLayout(null)).toEqual(DEFAULT_TODAY_LAYOUT)
  })
})
