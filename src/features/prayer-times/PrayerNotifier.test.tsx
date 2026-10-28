import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import { useSettings } from '../../shared/settings'
import type { PrayerName } from '../../shared/types'
import type { PrayerStatus } from '../prayer-log'
import { usePrayerLog } from '../prayer-log/store'
import { DEFAULT_UNLOGGED_REMINDERS, usePrayerTimesStore } from './config'
import { PrayerNotifier } from './PrayerNotifier'
import { CAIRO, resetStores, TROMSO, zonedInstant } from './test-helpers'

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

  it('does not remind anyone of an Asr that would fall before sunrise', async () => {
    // 24 November in Tromsø: sunrise 10:32, Dhuhr 11:32, sunset 12:29. adhan alone puts Asr at 08:31.
    vi.setSystemTime(zonedInstant('2026-11-24', '08:30:40', 'Europe/Oslo'))
    resetStores({ location: TROMSO, prayerTimes: { notifications: true } })
    render(<PrayerNotifier />)
    await advance(10 * 60_000)
    expect(shown).toHaveLength(0)

    await advance(3 * 60 * 60_000)
    expect(shown).toEqual([
      { title: 'It’s time for Dhuhr', options: expect.objectContaining({ body: '11:32 · Tromsø, Norway', tag: 'azkar-prayer-2026-11-24-dhuhr' }) },
    ])
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

  describe('waking up', () => {
    const wake = () => act(() => void document.dispatchEvent(new Event('visibilitychange')))
    const titles = () => shown.map((entry) => entry.title)

    it('shows a reminder that came due while the page was suspended, when the wake-up is heard before the timer', async () => {
      render(<PrayerNotifier />)
      // Locked at 15:58:30 with Asr at 15:59, unlocked at 16:00: no timer ran in between, and
      // the page learns it is visible again before its stalled timer gets a turn.
      vi.setSystemTime(cairo('16:00:00'))
      wake()
      await advance(0)
      expect(shown).toEqual([
        { title: 'It’s time for Asr', options: expect.objectContaining({ body: '15:59 · Cairo, Egypt', tag: 'azkar-prayer-2026-10-12-asr' }) },
      ])

      // The timer finds nothing left to do, and Maghrib is next.
      await advance(10 * 60_000)
      expect(titles()).toEqual(['It’s time for Asr'])
      await advance(2.5 * 60 * 60_000)
      expect(titles()).toEqual(['It’s time for Asr', 'It’s time for Maghrib'])
    })

    it('shows it once when the timer got there first', async () => {
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(titles()).toEqual(['It’s time for Asr'])
      wake()
      wake()
      await advance(60_000)
      expect(titles()).toEqual(['It’s time for Asr'])
    })

    it('leaves it to the timer while the page is still hidden', async () => {
      render(<PrayerNotifier />)
      vi.setSystemTime(cairo('16:00:00'))
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      wake()
      await advance(0)
      expect(shown).toHaveLength(0)
      await advance(30_000)
      expect(titles()).toEqual(['It’s time for Asr'])
    })

    it('still skips one that is more than five minutes overdue', async () => {
      render(<PrayerNotifier />)
      vi.setSystemTime(cairo('16:04:30'))
      wake()
      await advance(60_000)
      expect(shown).toHaveLength(0)

      await advance(2.5 * 60 * 60_000)
      expect(titles()).toEqual(['It’s time for Maghrib'])
    })

    it('reminds of the latest prayer only when several passed during a long sleep', async () => {
      render(<PrayerNotifier />)
      // Asleep through Asr (15:59) and woken a minute after Maghrib (18:28).
      vi.setSystemTime(cairo('18:29:00'))
      wake()
      await advance(0)
      expect(titles()).toEqual(['It’s time for Maghrib'])
      await advance(60_000)
      expect(titles()).toEqual(['It’s time for Maghrib'])
    })

    it('does not remind of a prayer that had already begun when the app was opened', async () => {
      vi.setSystemTime(cairo('16:01:00'))
      render(<PrayerNotifier />)
      wake()
      await advance(60_000)
      expect(shown).toHaveLength(0)
    })

    it('shows one that came due in a sleep across midnight, when the new day is noticed before the reminder’s timer runs', async () => {
      vi.setSystemTime(cairo('23:50:00'))
      render(<PrayerNotifier />)
      // Asleep until a minute after Fajr (05:29). The first thing to run is the clock tick that
      // turns the day over, and the timetable is rebuilt around the 13th before the stalled timer has its turn.
      vi.setSystemTime(cairo('05:30:00', '2026-10-13'))
      await advance(15_000)
      expect(shown.map((entry) => entry.options.tag)).toEqual(['azkar-prayer-2026-10-13-fajr'])
      expect(shown[0]?.options.body).toBe('05:29 · Cairo, Egypt')

      wake()
      await advance(10 * 60_000)
      expect(titles()).toEqual(['It’s time for Fajr'])
    })

    it('does not hand a prayer that came due during the sleep on to a place chosen since', async () => {
      render(<PrayerNotifier />)
      // Alexandria's Asr is at 16:03, four minutes after Cairo's: it began twenty seconds before the place changed.
      vi.setSystemTime(cairo('16:03:20'))
      act(() => useLocationStore.getState().setLocation({ ...CAIRO, latitude: 31.2001, longitude: 29.9187, label: 'Alexandria, Egypt' }))
      wake()
      await advance(60_000)
      expect(shown).toHaveLength(0)

      await advance(2.5 * 60 * 60_000)
      expect(shown.map((entry) => entry.options.body)).toEqual(['18:32 · Alexandria, Egypt'])
    })

    it('does not bring back one that came due while reminders were switched off', async () => {
      render(<PrayerNotifier />)
      act(() => usePrayerTimesStore.getState().setNotifications(false))
      vi.setSystemTime(cairo('16:00:00'))
      act(() => usePrayerTimesStore.getState().setNotifications(true))
      wake()
      await advance(60_000)
      expect(shown).toHaveLength(0)
    })
  })

  describe('naming the place', () => {
    const unnamed = { ...CAIRO, label: '', countryCode: null }

    it('gives the coordinates when the place has no name, in the language of the reminder', async () => {
      useLocationStore.setState({ location: unnamed })
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(shown[0]?.options.body).toBe('15:59 · 30.04° N, 31.24° E')
    })

    it('writes them in Arabic when the interface is Arabic, however the location was saved', async () => {
      useLocationStore.setState({ location: unnamed })
      useSettings.setState({ language: 'ar' })
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(shown[0]?.options.body).toBe('١٥:٥٩ · ٣٠٫٠٤° شمالًا، ٣١٫٢٤° شرقًا')
    })
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

  describe('azkar reminders', () => {
    const tags = () => shown.map((entry) => entry.options.tag)

    it('reminds of the evening azkar as Asr begins, on its own switch', async () => {
      usePrayerTimesStore.setState({ notifications: false, azkarReminders: { morning: false, evening: true, morningAt: 'fajr' } })
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(shown).toEqual([
        {
          title: 'Time for the evening azkar',
          options: { body: 'Asr began at 15:59', tag: 'azkar-reminder-2026-10-12-evening', icon: './pwa-192x192.png', lang: 'en', dir: 'ltr' },
        },
      ])
    })

    it('reminds of the morning azkar at Fajr, next to the Fajr reminder', async () => {
      vi.setSystemTime(cairo('05:28:00', '2026-10-13'))
      usePrayerTimesStore.setState({ azkarReminders: { morning: true, evening: false, morningAt: 'fajr' } })
      render(<PrayerNotifier />)
      await advance(90_000)
      expect(tags()).toEqual(['azkar-prayer-2026-10-13-fajr', 'azkar-reminder-2026-10-13-morning'])
      expect(shown[1]).toMatchObject({ title: 'Time for the morning azkar', options: { body: 'Fajr began at 05:29' } })
    })

    it('or after sunrise, when that is the choice', async () => {
      vi.setSystemTime(cairo('05:28:00', '2026-10-13'))
      usePrayerTimesStore.setState({ notifications: false, azkarReminders: { morning: true, evening: false, morningAt: 'sunrise' } })
      render(<PrayerNotifier />)
      await advance(10 * 60_000)
      expect(shown).toHaveLength(0)
      await advance(90 * 60_000)
      expect(shown).toEqual([
        { title: 'Time for the morning azkar', options: expect.objectContaining({ body: 'The sun rose at 06:56', tag: 'azkar-reminder-2026-10-13-morning' }) },
      ])
    })

    it('stops as soon as the reminder is switched off', async () => {
      usePrayerTimesStore.setState({ notifications: false, azkarReminders: { morning: false, evening: true, morningAt: 'fajr' } })
      render(<PrayerNotifier />)
      act(() => usePrayerTimesStore.getState().setAzkarReminder('evening', false))
      await advance(60_000)
      expect(shown).toHaveLength(0)
    })

    it('is written in Arabic when the interface is Arabic', async () => {
      useSettings.setState({ language: 'ar', timeFormat: '12h' })
      usePrayerTimesStore.setState({ notifications: false, azkarReminders: { morning: false, evening: true, morningAt: 'fajr' } })
      render(<PrayerNotifier />)
      await advance(31_000)
      expect(shown[0]).toMatchObject({ title: 'حان وقت أذكار المساء', options: { body: 'دخل وقت العصر الساعة ٣:٥٩ م', lang: 'ar', dir: 'rtl' } })
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

  describe('reminders of prayers not logged yet', () => {
    const titles = () => shown.map((entry) => entry.title)
    const log = (dateKey: string, prayer: PrayerName, status: PrayerStatus | null) =>
      act(() => usePrayerLog.getState().setStatus(dateKey, prayer, status))

    beforeEach(() => {
      usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
      // Only these, so each test hears nothing else.
      usePrayerTimesStore.setState({ notifications: false, unloggedReminders: DEFAULT_UNLOGGED_REMINDERS })
    })

    it('remind of a prayer not logged fifteen minutes before its time ends', async () => {
      render(<PrayerNotifier />)
      // Asr ends at Maghrib, 18:28: the reminder comes at 18:13.
      await advance(2 * 60 * 60_000 + 14 * 60_000)
      expect(shown).toHaveLength(0)
      await advance(30_000)
      expect(shown).toEqual([
        {
          title: 'You haven’t logged Asr yet',
          options: {
            body: 'Asr time ends in 15 minutes, at 18:28',
            tag: 'azkar-unlogged-2026-10-12-asr-unlogged',
            icon: './pwa-192x192.png',
            lang: 'en',
            dir: 'ltr',
          },
        },
      ])
      // Then Maghrib's, before Isha begins at 19:45.
      await advance(80 * 60_000)
      expect(titles()).toEqual(['You haven’t logged Asr yet', 'You haven’t logged Maghrib yet'])
    })

    it('say nothing for a prayer logged in the meantime', async () => {
      render(<PrayerNotifier />)
      await advance(2 * 60 * 60_000)
      log('2026-10-12', 'asr', 'ontime')
      await advance(30 * 60_000)
      expect(shown).toHaveLength(0)
      // The next prayer, not logged, still has its reminder, at 19:30.
      await advance(62 * 60_000)
      expect(titles()).toEqual(['You haven’t logged Maghrib yet'])
    })

    it('speak again once the status is cleared', async () => {
      log('2026-10-12', 'asr', 'missed')
      render(<PrayerNotifier />)
      await advance(60 * 60_000)
      log('2026-10-12', 'asr', null)
      await advance(80 * 60_000)
      expect(titles()).toEqual(['You haven’t logged Asr yet'])
    })

    it('end Isha at the middle of the night by default, or at Fajr when chosen', async () => {
      vi.setSystemTime(cairo('23:40:00'))
      const { unmount } = render(<PrayerNotifier />)
      await advance(4 * 60_000)
      expect(shown).toEqual([
        {
          title: 'You haven’t logged Isha yet',
          options: expect.objectContaining({ body: 'The preferred time for Isha ends in 15 minutes, at 23:58', tag: 'azkar-unlogged-2026-10-12-isha-unlogged' }),
        },
      ])
      unmount()

      shown.length = 0
      act(() => usePrayerTimesStore.getState().setIshaDeadline('fajr'))
      vi.setSystemTime(cairo('05:10:00', '2026-10-13'))
      render(<PrayerNotifier />)
      await advance(5 * 60_000)
      expect(shown).toEqual([
        { title: 'You haven’t logged Isha yet', options: expect.objectContaining({ body: 'Isha time ends in 15 minutes, at 05:29' }) },
      ])
    })

    it('address the user by name, in Arabic too', async () => {
      useSettings.setState({ language: 'ar', timeFormat: '12h', name: 'Ahmed' })
      vi.setSystemTime(cairo('18:12:40'))
      render(<PrayerNotifier />)
      await advance(30_000)
      expect(shown).toEqual([
        {
          title: 'لم تُسجَّل صلاة العصر بعد يا \u2068Ahmed\u2069',
          options: expect.objectContaining({ body: 'يخرج وقت العصر بعد ١٥ دقيقة، الساعة ٦:٢٨ م', lang: 'ar', dir: 'rtl' }),
        },
      ])
    })

    it('stay silent when switched off', async () => {
      act(() => usePrayerTimesStore.getState().setUnloggedReminders(false))
      render(<PrayerNotifier />)
      await advance(4 * 60 * 60_000)
      expect(shown).toHaveLength(0)
    })
  })
})
