import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../../shared/location'
import { useSettings } from '../../../shared/settings'
import type { PrayerName } from '../../../shared/types'
import type { PrayerStatus } from '../../prayer-log'
import { usePrayerLog } from '../../prayer-log/store'
import { DEFAULT_UNLOGGED_REMINDERS, usePrayerTimesStore } from '../config'
import type { AzkarReminderSettings, UnloggedReminderSettings } from '../config'
import { bringToForeground, device, LocalNotifications, pendingOf, resetDevice, tapNotification } from '../native-fakes'
import { PrayerNotifier } from '../PrayerNotifier'
import { CAIRO, resetStores, zonedInstant } from '../test-helpers'
import { AZKAR_GROUP, PRAYER_GROUP, REMINDER_LIMIT, UNLOGGED_GROUP } from './plan'

vi.mock('@capacitor/core', async (original) => (await import('../native-fakes')).mockCore(await original()))
vi.mock('@capacitor/local-notifications', async () => (await import('../native-fakes')).localNotificationsModule)
vi.mock('@capacitor/app', async () => (await import('../native-fakes')).appModule)

// Cairo, 12 October 2026: Asr 15:59, Maghrib 18:28, Isha 19:45. The 13th: Fajr 05:29, sunrise 06:56, Dhuhr 12:42.
const cairo = (clock: string, dateKey = '2026-10-12') => zonedInstant(dateKey, clock, 'Africa/Cairo')

function Path() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

function renderApp(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PrayerNotifier />
      <Path />
    </MemoryRouter>,
  )
}

/** Lets the asynchronous round trips to the plugins finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const at = (date: Date | undefined) => date?.getTime()
const prayers = () => pendingOf(PRAYER_GROUP)
const azkar = () => pendingOf(AZKAR_GROUP)
const setAzkar = (patch: Partial<AzkarReminderSettings>) =>
  act(() => usePrayerTimesStore.setState((state) => ({ azkarReminders: { ...state.azkarReminders, ...patch } })))

beforeEach(() => {
  resetDevice('ios')
  // Only the clock is faked: the plugin round trips need real timers to settle.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(cairo('15:58:30'))
  resetStores({ location: CAIRO, prayerTimes: { notifications: true } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PrayerNotifier in the installed app', () => {
  it('opens the screen of a reminder tapped while the app was closed, once it has started', async () => {
    // The tap comes before anything listens, as when it launches the app.
    tapNotification({ id: 202610126, extra: { group: AZKAR_GROUP, session: 'evening', date: '2026-10-12' } })
    renderApp('/')
    await settle()
    expect(screen.getByTestId('path')).toHaveTextContent('/azkar/evening')
  })

  it('hands the five prayers of the coming week to the system, written out in full', async () => {
    renderApp()
    await settle()
    const pending = prayers()
    // From this Asr to next Monday's, which comes a few minutes earlier: 36 in all.
    expect(pending).toHaveLength(36)
    expect(pending[0]).toEqual({
      id: 202610122,
      title: 'It’s time for Asr',
      body: '15:59 · Cairo, Egypt',
      schedule: { at: cairo('15:59'), allowWhileIdle: true },
      extra: { group: PRAYER_GROUP, prayer: 'asr', date: '2026-10-12' },
      sound: 'default',
    })
    expect(pending.slice(1, 4).map(({ id, body }) => [id, body])).toEqual([
      [202610123, '18:28 · Cairo, Egypt'],
      [202610124, '19:45 · Cairo, Egypt'],
      [202610130, '05:29 · Cairo, Egypt'],
    ])
    expect(pending.map(({ title }) => title)).not.toContain('It’s time for Sunrise')
    expect(azkar()).toEqual([])
  })

  it('leaves the web’s own notifications alone', async () => {
    let asked = false
    vi.stubGlobal(
      'Notification',
      class {
        static get permission() {
          asked = true
          return 'granted'
        }
      },
    )
    renderApp()
    await settle()
    expect(asked).toBe(false)
    expect(prayers()).toHaveLength(36)
  })

  it('schedules the azkar reminders in their own group, each on its own switch', async () => {
    usePrayerTimesStore.setState({ notifications: false, azkarReminders: { morning: true, evening: true, morningAt: 'fajr' } })
    renderApp()
    await settle()
    expect(prayers()).toEqual([])
    const [evening, morning] = azkar()
    expect(evening).toEqual({
      id: 202610126,
      title: 'Time for the evening azkar',
      body: 'Asr began at 15:59',
      schedule: { at: cairo('15:59'), allowWhileIdle: true },
      extra: { group: AZKAR_GROUP, session: 'evening', date: '2026-10-12' },
      sound: 'default',
    })
    expect(morning).toMatchObject({ id: 202610135, title: 'Time for the morning azkar', body: 'Fajr began at 05:29' })
    expect(morning?.schedule?.at).toEqual(cairo('05:29', '2026-10-13'))

    // After sunrise instead: the same reminders, moved.
    setAzkar({ morningAt: 'sunrise' })
    await settle()
    const moved = azkar().find(({ id }) => id === 202610135)
    expect(moved).toMatchObject({ body: 'The sun rose at 06:56', schedule: { at: cairo('06:56', '2026-10-13') } })

    setAzkar({ morning: false })
    await settle()
    expect(azkar().every(({ extra }) => extra.session === 'evening')).toBe(true)
    expect(azkar()).toHaveLength(8)
    setAzkar({ evening: false })
    await settle()
    expect(azkar()).toEqual([])
  })

  it('keeps everything together within the limit, well under the 64 iOS allows', async () => {
    usePrayerTimesStore.setState({ azkarReminders: { morning: true, evening: true, morningAt: 'fajr' } })
    renderApp()
    await settle()
    expect(device.pending.size).toBe(REMINDER_LIMIT)
    expect(prayers()).toHaveLength(36)
    expect(azkar()).toHaveLength(REMINDER_LIMIT - 36)
  })

  it('writes the reminders in the interface language, with the chosen clock', async () => {
    useSettings.setState({ language: 'ar', timeFormat: '12h' })
    usePrayerTimesStore.setState({ azkarReminders: { morning: false, evening: true, morningAt: 'fajr' } })
    renderApp()
    await settle()
    expect(prayers()[0]).toMatchObject({ title: 'حان وقت صلاة العصر', body: '٣:٥٩ م · Cairo, Egypt' })
    expect(azkar()[0]).toMatchObject({ title: 'حان وقت أذكار المساء', body: 'دخل وقت العصر الساعة ٣:٥٩ م' })

    act(() => useSettings.setState({ language: 'en', timeFormat: '24h' }))
    await settle()
    expect(prayers()[0]).toMatchObject({ title: 'It’s time for Asr', body: '15:59 · Cairo, Egypt' })
  })

  describe('scheduling again', () => {
    it('when the app returns to the foreground, from then on', async () => {
      renderApp()
      await settle()
      LocalNotifications.schedule.mockClear()

      vi.setSystemTime(cairo('13:00', '2026-10-13'))
      bringToForeground()
      await settle()
      expect(LocalNotifications.schedule).toHaveBeenCalled()
      const pending = prayers()
      expect(pending[0]).toMatchObject({ id: 202610132, title: 'It’s time for Asr', body: '15:58 · Cairo, Egypt' })
      expect(pending.every(({ schedule }) => at(schedule?.at)! > Date.now())).toBe(true)
      // The week now reaches the 20th.
      expect(pending.at(-1)?.extra.date).toBe('2026-10-20')
    })

    it('when the location changes, in the new place’s zone', async () => {
      renderApp()
      await settle()
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
      await settle()
      // Makkah's Asr has passed; its Maghrib is at 17:59 local time.
      expect(prayers()[0]).toMatchObject({ id: 202610123, title: 'It’s time for Maghrib', body: '17:59 · Makkah' })
    })

    it('when a calculation setting changes', async () => {
      renderApp()
      await settle()
      act(() => usePrayerTimesStore.getState().setAdjustment('asr', 10))
      await settle()
      expect(prayers()[0]).toMatchObject({ id: 202610122, body: '16:09 · Cairo, Egypt' })
    })

    it('leaves a newer schedule alone when an older one hears back about the permission only after it', async () => {
      // The first check is answered only once a second one, from coming back to the foreground, has done its work.
      let answerFirst = () => {}
      LocalNotifications.checkPermissions.mockImplementationOnce(
        () => new Promise((resolve) => (answerFirst = () => resolve({ display: device.notifications }))),
      )
      renderApp()
      await settle()
      bringToForeground()
      await settle()
      expect(prayers()).toHaveLength(36)

      answerFirst()
      await settle()
      expect(prayers()).toHaveLength(36)
    })

    it('when the place gets its name', async () => {
      useLocationStore.setState({ location: { ...CAIRO, label: '', countryCode: null } })
      renderApp()
      await settle()
      expect(prayers()[0]?.body).toBe('15:59 · 30.04° N, 31.24° E')
      act(() => useLocationStore.getState().setLocation({ ...CAIRO }))
      await settle()
      expect(prayers()[0]?.body).toBe('15:59 · Cairo, Egypt')
    })
  })

  describe('clearing', () => {
    it('cancels the prayer reminders when they are switched off, and everything without a location', async () => {
      usePrayerTimesStore.setState({ azkarReminders: { morning: true, evening: true, morningAt: 'fajr' } })
      renderApp()
      await settle()
      act(() => usePrayerTimesStore.getState().setNotifications(false))
      await settle()
      expect(prayers()).toEqual([])
      expect(azkar().length).toBeGreaterThan(0)

      act(() => useLocationStore.getState().clearLocation())
      await settle()
      expect(device.pending.size).toBe(0)
    })

    it('schedules nothing without permission, and never asks for it from here', async () => {
      device.notifications = 'prompt'
      renderApp()
      await settle()
      expect(device.pending.size).toBe(0)
      expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled()
      expect(LocalNotifications.schedule).not.toHaveBeenCalled()
    })

    it('drops what was scheduled once permission is withdrawn in the Settings app, and renews it once given back', async () => {
      renderApp()
      await settle()
      expect(prayers()).toHaveLength(36)

      device.notifications = 'denied'
      bringToForeground()
      await settle()
      expect(device.pending.size).toBe(0)

      device.notifications = 'granted'
      bringToForeground()
      await settle()
      expect(prayers()).toHaveLength(36)
    })

    it('leaves the schedule in place when unmounted', async () => {
      const { unmount } = renderApp()
      await settle()
      unmount()
      bringToForeground()
      await settle()
      expect(prayers()).toHaveLength(36)
    })
  })

  describe('a tap on a reminder', () => {
    it('opens Today for a prayer and the right azkar for an azkar reminder', async () => {
      renderApp('/settings')
      await settle()
      const path = () => screen.getByTestId('path')

      act(() => tapNotification({ id: 202610122, extra: { group: PRAYER_GROUP, prayer: 'asr', date: '2026-10-12' } }))
      expect(path()).toHaveTextContent(/^\/$/)

      act(() => tapNotification({ id: 202610135, extra: { group: AZKAR_GROUP, session: 'morning', date: '2026-10-13' } }))
      expect(path()).toHaveTextContent('/azkar/morning')

      act(() => tapNotification({ id: 202610126, extra: { group: AZKAR_GROUP, session: 'evening', date: '2026-10-12' } }))
      expect(path()).toHaveTextContent('/azkar/evening')

      // A session this build does not know opens the list of them.
      act(() => tapNotification({ id: 1, extra: { group: AZKAR_GROUP, session: 'night' } }))
      expect(path()).toHaveTextContent(/^\/azkar$/)
    })

    it('does nothing when the reminder is swiped away, or belongs to something else', async () => {
      renderApp('/settings')
      await settle()
      act(() => tapNotification({ id: 202610122, extra: { group: PRAYER_GROUP } }, 'dismiss'))
      act(() => tapNotification({ id: 5, extra: { group: 'someone-else' } }))
      expect(screen.getByTestId('path')).toHaveTextContent('/settings')
    })

    it('is kept for the app when it comes while the reminders are not mounted', async () => {
      const { unmount } = renderApp('/settings')
      await settle()
      unmount()
      tapNotification({ id: 202610135, extra: { group: AZKAR_GROUP, session: 'morning' } })
      renderApp('/')
      await settle()
      expect(screen.getByTestId('path')).toHaveTextContent('/azkar/morning')
    })
  })
})

describe('the "not logged yet" reminders in the installed app', () => {
  const unlogged = () => pendingOf(UNLOGGED_GROUP)
  const unloggedIds = () => unlogged().map(({ id }) => id)
  const setUnlogged = (patch: Partial<UnloggedReminderSettings>) =>
    act(() => usePrayerTimesStore.setState((state) => ({ unloggedReminders: { ...state.unloggedReminders, ...patch } })))
  const log = (dateKey: string, prayer: PrayerName, status: PrayerStatus | null) =>
    act(() => usePrayerLog.getState().setStatus(dateKey, prayer, status))

  beforeEach(() => {
    usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
    usePrayerTimesStore.setState({ unloggedReminders: DEFAULT_UNLOGGED_REMINDERS })
  })

  it('are on by default with the prayer reminders, in a group of their own, written out in full', async () => {
    renderApp()
    await settle()
    expect(unlogged()[0]).toEqual({
      id: 1_202_610_122,
      title: 'You haven’t logged Asr yet',
      body: 'Asr time ends in 15 minutes, at 18:28',
      schedule: { at: cairo('18:13'), allowWhileIdle: true },
      extra: { group: UNLOGGED_GROUP, prayer: 'asr', date: '2026-10-12' },
      sound: 'default',
    })
    expect(unlogged().slice(1, 4).map(({ id, body, schedule }) => [id, body, schedule?.at])).toEqual([
      [1_202_610_123, 'Maghrib time ends in 15 minutes, at 19:45', cairo('19:30')],
      [1_202_610_124, 'The preferred time for Isha ends in 15 minutes, at 23:58', cairo('23:43')],
      [1_202_610_130, 'Fajr time ends in 15 minutes, at 06:56', cairo('06:41', '2026-10-13')],
    ])
    // With the prayers, ten a day: the soonest fifty reach the 17th's Dhuhr.
    expect(device.pending.size).toBe(REMINDER_LIMIT)
    expect([prayers().length, unlogged().length]).toEqual([25, 25])
    expect(unlogged().at(-1)?.id).toBe(1_202_610_171)
  })

  it('come on their own too, without the prayer-time reminders', async () => {
    usePrayerTimesStore.setState({ notifications: false })
    renderApp()
    await settle()
    expect(prayers()).toEqual([])
    // Five a day for the week: from this Asr's to the 19th's Dhuhr (15:43), before a week has passed at 15:58:30.
    expect(unlogged()).toHaveLength(35)
    expect(unlogged().at(-1)?.id).toBe(1_202_610_191)
  })

  it('open Today when tapped', async () => {
    renderApp('/settings')
    await settle()
    act(() => tapNotification({ id: 1_202_610_122, extra: { group: UNLOGGED_GROUP, prayer: 'asr', date: '2026-10-12' } }))
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/)
  })

  it('are cancelled the moment the prayer is logged, and come back when its status is cleared', async () => {
    renderApp()
    await settle()
    expect(unloggedIds()).toContain(1_202_610_122)

    log('2026-10-12', 'asr', 'ontime')
    await settle()
    expect(unloggedIds()).not.toContain(1_202_610_122)
    expect(unloggedIds()).toContain(1_202_610_123)
    // The prayer-time reminder is a different matter and stays.
    expect(prayers().map(({ id }) => id)).toContain(202_610_122)

    log('2026-10-12', 'asr', null)
    await settle()
    expect(unlogged()[0]).toMatchObject({ id: 1_202_610_122, schedule: { at: cairo('18:13') } })
  })

  it('are cancelled for every status, missed and excused included', async () => {
    renderApp()
    await settle()
    log('2026-10-12', 'maghrib', 'missed')
    log('2026-10-12', 'isha', 'excused')
    await settle()
    expect(unloggedIds()).not.toContain(1_202_610_123)
    expect(unloggedIds()).not.toContain(1_202_610_124)
  })

  it('are never scheduled for a prayer logged before the app opened', async () => {
    log('2026-10-12', 'asr', 'jamaah')
    renderApp()
    await settle()
    const everScheduled = LocalNotifications.schedule.mock.calls.flatMap(([{ notifications }]) => notifications.map(({ id }) => id))
    expect(everScheduled).not.toContain(1_202_610_122)
    expect(everScheduled).toContain(1_202_610_123)
  })

  it('are not scheduled again when a status only changes into another', async () => {
    renderApp()
    await settle()
    log('2026-10-12', 'asr', 'ontime')
    await settle()
    LocalNotifications.schedule.mockClear()
    LocalNotifications.cancel.mockClear()
    log('2026-10-12', 'asr', 'jamaah')
    await settle()
    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
    expect(LocalNotifications.cancel).not.toHaveBeenCalled()
  })

  it('remind of last night’s Isha after midnight until Fajr, when that is its end, unless it was logged', async () => {
    vi.setSystemTime(cairo('01:00', '2026-10-13'))
    usePrayerTimesStore.setState({ notifications: false })
    setUnlogged({ ishaEnds: 'fajr' })
    renderApp()
    await settle()
    expect(unlogged()[0]).toMatchObject({
      id: 1_202_610_124,
      body: 'Isha time ends in 15 minutes, at 05:29',
      schedule: { at: cairo('05:14', '2026-10-13') },
      extra: { date: '2026-10-12' },
    })
    log('2026-10-12', 'isha', 'late')
    await settle()
    expect(unlogged()[0]?.id).toBe(1_202_610_130)
  })

  it('follow the chosen lead time and end of Isha', async () => {
    renderApp()
    await settle()
    setUnlogged({ leadMinutes: 30 })
    await settle()
    expect(unlogged()[0]).toMatchObject({ id: 1_202_610_122, body: 'Asr time ends in 30 minutes, at 18:28', schedule: { at: cairo('17:58') } })

    setUnlogged({ ishaEnds: 'fajr' })
    await settle()
    const isha = unlogged().find(({ id }) => id === 1_202_610_124)
    expect(isha).toMatchObject({ body: 'Isha time ends in 30 minutes, at 05:29', schedule: { at: cairo('04:59', '2026-10-13') } })
  })

  it('are cleared when switched off, leaving the prayer reminders, and need the permission like them', async () => {
    renderApp()
    await settle()
    setUnlogged({ enabled: false })
    await settle()
    expect(unlogged()).toEqual([])
    expect(prayers()).toHaveLength(36)

    setUnlogged({ enabled: true })
    device.notifications = 'denied'
    bringToForeground()
    await settle()
    expect(device.pending.size).toBe(0)
  })

  it('are written in Arabic and address the user by name', async () => {
    useSettings.setState({ language: 'ar', timeFormat: '12h', name: 'أحمد' })
    renderApp()
    await settle()
    expect(unlogged()[0]).toMatchObject({ title: 'لم تُسجَّل صلاة العصر بعد يا \u2068أحمد\u2069', body: 'يخرج وقت العصر بعد ١٥ دقيقة، الساعة ٦:٢٨ م' })
    act(() => useSettings.setState({ language: 'en', timeFormat: '24h', name: 'Ahmed' }))
    await settle()
    expect(unlogged()[0]?.title).toBe('\u2068Ahmed\u2069, you haven’t logged Asr yet')
  })

  describe('with every kind of reminder on', () => {
    beforeEach(() => {
      usePrayerTimesStore.setState({ azkarReminders: { morning: true, evening: true, morningAt: 'fajr' } })
    })

    it('keeps the soonest within the limit, every kind alike', async () => {
      renderApp()
      await settle()
      expect(device.pending.size).toBe(REMINDER_LIMIT)
      expect([prayers().length, unlogged().length, azkar().length]).toEqual([21, 20, 9])
      // The cut falls after the 16th's Asr (15:56) and its evening azkar at the same minute.
      expect(prayers().at(-1)?.id).toBe(202_610_162)
      expect(azkar().at(-1)?.id).toBe(202_610_166)
      expect(unlogged().at(-1)?.id).toBe(1_202_610_161)
    })

    it('never holds more than the limit at any moment while reminders come and go', async () => {
      const schedule = LocalNotifications.schedule.getMockImplementation()!
      const cancel = LocalNotifications.cancel.getMockImplementation()!
      let peak = 0
      LocalNotifications.schedule.mockImplementation(async (options) => {
        const result = await schedule(options)
        peak = Math.max(peak, device.pending.size)
        return result
      })
      // A cancellation takes a round trip to the system, during which another group can be scheduled.
      LocalNotifications.cancel.mockImplementation(async (options) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return cancel(options)
      })
      const settleSlowly = async () => {
        for (let round = 0; round < 6; round++) await act(() => new Promise((resolve) => setTimeout(resolve, 5)))
      }
      try {
        setUnlogged({ enabled: false })
        renderApp()
        await settleSlowly()
        expect(device.pending.size).toBe(REMINDER_LIMIT)
        // On: the prayers and azkar give up their later days to the newcomers.
        setUnlogged({ enabled: true })
        await settleSlowly()
        expect(unlogged()).toHaveLength(20)
        // Off again: the prayers and azkar take their days back.
        setUnlogged({ enabled: false })
        await settleSlowly()
        expect([prayers().length, azkar().length]).toEqual([36, 14])
        // And everything moves at once with the place.
        setUnlogged({ enabled: true })
        act(() => useLocationStore.getState().setLocation({ ...CAIRO, latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh', label: 'Makkah', countryCode: 'SA' }))
        await settleSlowly()
        expect(device.pending.size).toBe(REMINDER_LIMIT)
        expect(peak).toBe(REMINDER_LIMIT)
      } finally {
        LocalNotifications.schedule.mockImplementation(schedule)
        LocalNotifications.cancel.mockImplementation(cancel)
      }
    })

    it('makes room for later reminders as prayers are logged', async () => {
      renderApp()
      await settle()
      log('2026-10-12', 'asr', 'ontime')
      log('2026-10-12', 'maghrib', 'jamaah')
      await settle()
      expect(device.pending.size).toBe(REMINDER_LIMIT)
      expect(unloggedIds()).not.toContain(1_202_610_122)
      expect(unloggedIds()).not.toContain(1_202_610_123)
      // The two places go to the 16th's Asr reminder (18:08) and Maghrib (18:23).
      expect(unloggedIds()).toContain(1_202_610_162)
      expect(prayers().at(-1)?.id).toBe(202_610_163)
    })
  })
})
