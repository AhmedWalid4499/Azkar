import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import { useSettings } from '../../shared/settings'
import { usePrayerTimesStore } from './config'
import { PrayerNotifier } from './PrayerNotifier'
import { CAIRO, resetStores, zonedInstant } from './test-helpers'

const TODAY = '2026-10-12'
const cairo = (clock: string, dateKey = TODAY) => zonedInstant(dateKey, clock, 'Africa/Cairo')

const shown: Array<{ title: string; options: NotificationOptions }> = []

/** Installs a stand-in Notification API with the given permission. */
function stubNotification(permission: NotificationPermission) {
  class FakeNotification {
    static permission = permission
    static requestPermission = vi.fn(async () => permission)
    constructor(title: string, options: NotificationOptions = {}) {
      shown.push({ title, options })
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  return FakeNotification
}

/** Lets timers run and the async show() settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  shown.length = 0
  vi.useFakeTimers()
  // Cairo that day: Asr 15:59, Maghrib 18:28, Isha 19:45; Fajr on the 13th at 05:29.
  vi.setSystemTime(cairo('15:58:30'))
  resetStores({ location: CAIRO, prayerTimes: { notifications: true } })
  stubNotification('granted')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PrayerNotifier', () => {
  it('renders nothing', () => {
    const { container } = render(<PrayerNotifier />)
    expect(container).toBeEmptyDOMElement()
  })

  it('notifies at the prayer time, not before, then waits for the following one', async () => {
    render(<PrayerNotifier />)
    await advance(29_000)
    expect(shown).toHaveLength(0)

    await advance(1_500)
    expect(shown).toEqual([
      {
        title: 'It’s time for Asr',
        options: { body: '15:59 · Cairo, Egypt', tag: 'azkar-prayer-2026-10-12-asr', icon: './pwa-192x192.png', lang: 'en', dir: 'ltr' },
      },
    ])

    // Two and a half hours of heartbeats bring Maghrib, once.
    await advance(2.5 * 60 * 60_000)
    expect(shown.map((entry) => entry.title)).toEqual(['It’s time for Asr', 'It’s time for Maghrib'])
    expect(shown[1]?.options.tag).toBe('azkar-prayer-2026-10-12-maghrib')
  })

  it('carries on past midnight to tomorrow’s Fajr', async () => {
    vi.setSystemTime(cairo('19:44:50'))
    render(<PrayerNotifier />)
    await advance(10 * 60 * 60_000)
    expect(shown.map((entry) => entry.options.tag)).toEqual(['azkar-prayer-2026-10-12-isha', 'azkar-prayer-2026-10-13-fajr'])
  })

  it('does not announce sunrise', async () => {
    vi.setSystemTime(cairo('05:00:00'))
    render(<PrayerNotifier />)
    await advance(4 * 60 * 60_000)
    expect(shown.map((entry) => entry.title)).toEqual(['It’s time for Fajr'])
  })

  it('stays silent when reminders are off, permission is missing or no location is set', async () => {
    usePrayerTimesStore.setState({ notifications: false })
    const off = render(<PrayerNotifier />)
    await advance(60_000)
    off.unmount()

    usePrayerTimesStore.setState({ notifications: true })
    stubNotification('denied')
    const denied = render(<PrayerNotifier />)
    await advance(60_000)
    denied.unmount()

    stubNotification('granted')
    useLocationStore.setState({ location: null })
    render(<PrayerNotifier />)
    await advance(60_000)

    expect(shown).toHaveLength(0)
  })

  it('does nothing, and does not throw, where notifications do not exist', async () => {
    vi.stubGlobal('Notification', undefined)
    render(<PrayerNotifier />)
    await advance(60_000)
    expect(shown).toHaveLength(0)
    expect(vi.getTimerCount()).toBeLessThanOrEqual(2)
  })

  it('starts as soon as reminders are switched on', async () => {
    usePrayerTimesStore.setState({ notifications: false })
    render(<PrayerNotifier />)
    await advance(5_000)
    act(() => usePrayerTimesStore.getState().setNotifications(true))
    await advance(30_000)
    expect(shown.map((entry) => entry.title)).toEqual(['It’s time for Asr'])
  })

  it('reschedules when the location changes', async () => {
    render(<PrayerNotifier />)
    // Cairo's Asr is thirty seconds away; in Makkah Asr has already passed and Maghrib is two hours off.
    act(() =>
      useLocationStore.getState().setLocation({
        ...CAIRO,
        latitude: 21.4225,
        longitude: 39.8262,
        timeZone: 'Asia/Riyadh',
        label: 'Makkah',
        countryCode: 'SA',
      }),
    )
    await advance(60_000)
    expect(shown).toHaveLength(0)

    await advance(3 * 60 * 60_000)
    expect(shown).toEqual([
      { title: 'It’s time for Maghrib', options: expect.objectContaining({ body: '17:59 · Makkah', tag: 'azkar-prayer-2026-10-12-maghrib' }) },
    ])
  })

  it('reschedules when a calculation setting changes', async () => {
    render(<PrayerNotifier />)
    act(() => usePrayerTimesStore.getState().setAdjustment('asr', 10))
    await advance(5 * 60_000)
    expect(shown).toHaveLength(0)
    await advance(6 * 60_000)
    expect(shown).toEqual([expect.objectContaining({ options: expect.objectContaining({ body: '16:09 · Cairo, Egypt' }) })])
  })

  it('skips a reminder that is badly overdue after the device slept', async () => {
    render(<PrayerNotifier />)
    // The clock jumps forty minutes without any timer having run, as after a suspend.
    vi.setSystemTime(cairo('16:40:00'))
    await advance(60_000)
    expect(shown).toHaveLength(0)

    // Life goes on with the next one.
    await advance(2 * 60 * 60_000)
    expect(shown.map((entry) => entry.title)).toEqual(['It’s time for Maghrib'])
  })

  it('re-checks when the page becomes visible again', async () => {
    render(<PrayerNotifier />)
    vi.setSystemTime(cairo('15:59:20'))
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    // Asr began twenty seconds ago while the tab was frozen; the next one to wait for is Maghrib.
    await advance(60_000)
    expect(shown).toHaveLength(0)
  })

  it('uses the service worker when one is active', async () => {
    const showNotification = vi.fn(async () => {})
    const getRegistration = vi.fn(async () => ({ active: {}, showNotification }))
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration } })
    try {
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(showNotification).toHaveBeenCalledWith('It’s time for Asr', expect.objectContaining({ tag: 'azkar-prayer-2026-10-12-asr' }))
      expect(shown).toHaveLength(0)
    } finally {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker
    }
  })

  it('falls back to the page when there is no active worker or it fails', async () => {
    const getRegistration = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration } })
    try {
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(getRegistration).toHaveBeenCalled()
      expect(shown).toHaveLength(1)
    } finally {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker
    }
  })

  it('survives a browser that refuses page-level notifications', async () => {
    class Throwing {
      static permission: NotificationPermission = 'granted'
      constructor() {
        throw new TypeError('Illegal constructor')
      }
    }
    vi.stubGlobal('Notification', Throwing)
    render(<PrayerNotifier />)
    await expect(advance(31_000)).resolves.toBeUndefined()
  })

  it('writes the reminder in Arabic, right-to-left', async () => {
    useSettings.setState({ language: 'ar', timeFormat: '12h' })
    render(<PrayerNotifier />)
    await advance(31_000)
    expect(shown[0]).toEqual({
      title: 'حان وقت صلاة العصر',
      options: { body: '٣:٥٩ م · Cairo, Egypt', tag: 'azkar-prayer-2026-10-12-asr', icon: './pwa-192x192.png', lang: 'ar', dir: 'rtl' },
    })
  })

  it('leaves no timers behind when unmounted', async () => {
    const { unmount } = render(<PrayerNotifier />)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    await advance(60 * 60_000)
    expect(shown).toHaveLength(0)
  })
})
