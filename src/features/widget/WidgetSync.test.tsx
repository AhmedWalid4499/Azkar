import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetAction } from '../../native'
import type { AppPlatform } from '../../native/platform'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import { usePrayerLog } from '../prayer-log'
import type { WidgetSnapshot } from './snapshot'
import { WidgetSync } from './WidgetSync'

type AppStateListener = (state: { isActive: boolean }) => void

/** The pretend phone: its platform, and the widget plugin's App Group. */
const phone = vi.hoisted(() => ({
  platform: 'ios' as AppPlatform,
  published: [] as string[],
  pending: [] as WidgetAction[],
  appListeners: new Set<AppStateListener>(),
}))

const plugin = vi.hoisted(() => ({
  publish: vi.fn(async ({ json }: { json: string }) => {
    phone.published.push(json)
  }),
  takePendingActions: vi.fn(async () => ({ actions: phone.pending.splice(0) })),
}))

vi.mock('../../native/platform', () => ({
  appPlatform: () => phone.platform,
  isNativeApp: () => phone.platform !== 'web',
}))
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...actual,
    registerPlugin: (name: string, ...rest: unknown[]) =>
      name === 'AzkarWidget' ? plugin : (actual.registerPlugin as (...args: unknown[]) => unknown)(name, ...rest),
  }
})
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: 'appStateChange', listener: AppStateListener) => {
      phone.appListeners.add(listener)
      return { remove: vi.fn(async () => void phone.appListeners.delete(listener)) }
    }),
  },
}))

const CAIRO: SavedLocation = {
  latitude: 30.0444,
  longitude: 31.2357,
  timeZone: 'Africa/Cairo',
  label: 'Cairo, Egypt',
  countryCode: 'EG',
  source: 'manual',
  updatedAt: Date.UTC(2026, 9, 1, 9, 30),
}

/** 10:00 in Cairo (UTC+3) on Monday 12 October 2026. Asr is at 15:59 that day. */
const NOW = Date.parse('2026-10-12T07:00:00Z')
const ASR_TAPPED = Date.parse('2026-10-12T13:05:00Z')

/** Lets the round trips to the plugin finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const lastPublished = (): WidgetSnapshot => JSON.parse(phone.published.at(-1) ?? 'null')

function bringToForeground() {
  for (const listener of phone.appListeners) listener({ isActive: true })
}

beforeEach(() => {
  phone.platform = 'ios'
  phone.published = []
  phone.pending = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', timeFormat: '24h' })
  useLocationStore.setState({ location: CAIRO })
  usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('WidgetSync outside the iOS app', () => {
  it.each(['web', 'android'] as const)('does nothing on %s', async (platform) => {
    phone.platform = platform
    phone.pending = [{ id: 'a', date: '2026-10-12', prayer: 'fajr', status: 'ontime', at: NOW }]
    const { container } = render(<WidgetSync />)
    await settle()
    expect(container).toBeEmptyDOMElement()
    expect(plugin.publish).not.toHaveBeenCalled()
    expect(plugin.takePendingActions).not.toHaveBeenCalled()
    expect(phone.appListeners.size).toBe(0)
  })
})

describe('WidgetSync in the iOS app', () => {
  it('publishes the times of yesterday and the week ahead as soon as it starts', async () => {
    render(<WidgetSync />)
    await settle()
    expect(phone.published).toHaveLength(1)
    const snapshot = lastPublished()
    expect(snapshot).toMatchObject({ version: 1, lang: 'en', arabicDigits: false, timeZone: 'Africa/Cairo', name: '' })
    expect(snapshot.days.map(({ date }) => date)).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
    ])
    const today = snapshot.days[1]
    expect(today?.prayers.map(({ prayer, time }) => `${prayer} ${time}`)).toEqual([
      'fajr 05:28',
      'dhuhr 12:43',
      'asr 15:59',
      'maghrib 18:28',
      'isha 19:45',
    ])
    // An absolute instant, whatever the zone the phone is in.
    expect(new Date(today?.prayers[2]?.at ?? 0).toISOString()).toBe('2026-10-12T12:59:00.000Z')
    expect(snapshot.labels.nextPrayer).toBe('Next prayer')
  })

  it('publishes nothing to show before a location is set', async () => {
    useLocationStore.setState({ location: null })
    render(<WidgetSync />)
    await settle()
    expect(lastPublished()).toMatchObject({ timeZone: null, days: [] })
  })

  it('publishes again whenever the log, the language, the digits, the clock or the name change, and only then', async () => {
    const { rerender } = render(<WidgetSync />)
    await settle()

    rerender(<WidgetSync />)
    await settle()
    expect(phone.published).toHaveLength(1)

    act(() => usePrayerLog.getState().setStatus('2026-10-12', 'fajr', 'jamaah'))
    await settle()
    expect(phone.published).toHaveLength(2)
    expect(lastPublished().days[1]?.log).toEqual({ fajr: 'jamaah' })

    act(() => useSettings.getState().update({ language: 'ar' }))
    await settle()
    expect(lastPublished()).toMatchObject({ lang: 'ar', arabicDigits: true })
    expect(lastPublished().days[1]?.prayers[2]?.time).toBe('١٥:٥٩')
    expect(lastPublished().labels['prayer.asr']).toBe('العصر')

    act(() => useSettings.getState().update({ arabicDigits: false }))
    await settle()
    expect(lastPublished().arabicDigits).toBe(false)
    expect(lastPublished().days[1]?.prayers[2]?.time).toBe('15:59')

    act(() => useSettings.getState().update({ timeFormat: '12h' }))
    await settle()
    expect(lastPublished().days[1]?.prayers[2]?.time).toBe('3:59 م')

    act(() => useSettings.getState().update({ name: 'Ahmed' }))
    await settle()
    expect(lastPublished().name).toBe('Ahmed')
    expect(lastPublished().labels.greeting).toBe('السلام عليكم يا ⁨Ahmed⁩')
    expect(phone.published).toHaveLength(6)

    // A setting the widgets do not show.
    act(() => useSettings.getState().update({ theme: 'dark' }))
    await settle()
    expect(phone.published).toHaveLength(6)
  })

  it('records the prayers marked on a widget while the app was closed, at the time of the tap', async () => {
    phone.pending = [{ id: 'a', date: '2026-10-11', prayer: 'isha', status: 'ontime', at: Date.parse('2026-10-11T17:30:00Z') }]
    render(<WidgetSync />)
    await settle()
    expect(usePrayerLog.getState().entries).toEqual({ '2026-10-11': { isha: 'ontime' } })
    expect(usePrayerLog.getState().loggedAt).toEqual({ '2026-10-11': { isha: Date.parse('2026-10-11T17:30:00Z') } })
    // And the widgets are told, so they and the app agree.
    expect(lastPublished().days[0]?.log).toEqual({ isha: 'ontime' })
  })

  it('collects new taps and publishes each time the app comes back to the foreground', async () => {
    render(<WidgetSync />)
    await settle()
    expect(plugin.takePendingActions).toHaveBeenCalledTimes(1)
    const published = phone.published.length

    // Marked on the widget while the app was in the background.
    vi.setSystemTime(Date.parse('2026-10-12T13:10:00Z'))
    phone.pending = [{ id: 'b', date: '2026-10-12', prayer: 'asr', status: 'ontime', at: ASR_TAPPED }]
    act(() => bringToForeground())
    await settle()

    expect(plugin.takePendingActions).toHaveBeenCalledTimes(2)
    expect(usePrayerLog.getState().entries['2026-10-12']).toEqual({ asr: 'ontime' })
    expect(usePrayerLog.getState().loggedAt['2026-10-12']).toEqual({ asr: ASR_TAPPED })
    expect(phone.published.length).toBeGreaterThan(published)
    expect(lastPublished().days[1]?.log).toEqual({ asr: 'ontime' })
  })

  it('publishes on returning to the foreground even when nothing changed', async () => {
    render(<WidgetSync />)
    await settle()
    act(() => bringToForeground())
    await settle()
    expect(phone.published).toHaveLength(2)
    expect(phone.published[1]).toBe(phone.published[0])
  })

  it('stops listening once unmounted', async () => {
    const { unmount } = render(<WidgetSync />)
    await settle()
    unmount()
    await settle()
    expect(phone.appListeners.size).toBe(0)
  })
})
