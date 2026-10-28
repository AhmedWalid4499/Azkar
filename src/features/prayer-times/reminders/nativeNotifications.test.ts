// The parts of src/native/notifications.ts that the reminders rely on, with the plugins faked.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  nativeNotificationPermission,
  onAppActive,
  onNotificationTap,
  replaceScheduledNotifications,
  requestNativeNotificationPermission,
} from '../../../native/notifications'
import type { PlannedNotification } from '../../../native/notifications'
import { bringToForeground, device, LocalNotifications, pendingOf, resetDevice, tapListenerCount, tapNotification } from '../native-fakes'

vi.mock('@capacitor/core', async (original) => (await import('../native-fakes')).mockCore(await original()))
vi.mock('@capacitor/local-notifications', async () => (await import('../native-fakes')).localNotificationsModule)
vi.mock('@capacitor/app', async () => (await import('../native-fakes')).appModule)

const HOUR = 3_600_000
const later = (hours: number) => new Date(Date.now() + hours * HOUR)
const item = (id: number, hours: number, data?: Record<string, string>): PlannedNotification => ({
  id,
  title: `Title ${id}`,
  body: `Body ${id}`,
  at: later(hours),
  ...(data ? { data } : {}),
})
const scheduled = () => LocalNotifications.schedule.mock.calls.map(([options]) => options.notifications)

beforeEach(() => {
  resetDevice('ios')
})

describe('replaceScheduledNotifications', () => {
  it('schedules each item with its group, for the system to deliver while the app is closed', async () => {
    await replaceScheduledNotifications('prayer-times', [item(1, 1, { prayer: 'asr' })])
    expect(scheduled()).toEqual([
      [
        {
          id: 1,
          title: 'Title 1',
          body: 'Body 1',
          schedule: { at: expect.any(Date), allowWhileIdle: true },
          extra: { prayer: 'asr', group: 'prayer-times' },
          // Without one, iOS shows the reminder in silence.
          sound: 'default',
        },
      ],
    ])
  })

  it('replaces what the group had pending and leaves other groups alone', async () => {
    await replaceScheduledNotifications('prayer-times', [item(1, 1), item(2, 2)])
    await replaceScheduledNotifications('azkar-reminders', [item(3, 3)])
    await replaceScheduledNotifications('prayer-times', [item(4, 4)])
    expect(pendingOf('prayer-times').map(({ id }) => id)).toEqual([4])
    expect(pendingOf('azkar-reminders').map(({ id }) => id)).toEqual([3])
  })

  it('skips anything already past and schedules nothing when that leaves nothing', async () => {
    await replaceScheduledNotifications('prayer-times', [item(1, -1), item(2, 0), item(3, 1)])
    expect(pendingOf('prayer-times').map(({ id }) => id)).toEqual([3])
    LocalNotifications.schedule.mockClear()
    await replaceScheduledNotifications('prayer-times', [item(5, -2)])
    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
    expect(pendingOf('prayer-times')).toEqual([])
  })

  it('runs only the newest of calls made together', async () => {
    await Promise.all([
      replaceScheduledNotifications('prayer-times', [item(1, 1)]),
      replaceScheduledNotifications('prayer-times', [item(2, 1)]),
      replaceScheduledNotifications('prayer-times', [item(3, 1)]),
    ])
    expect(scheduled().map((batch) => batch.map(({ id }) => id))).toEqual([[3]])
  })

  it('lets a call in progress finish before the next one starts, and the newest wins over one still waiting', async () => {
    await replaceScheduledNotifications('prayer-times', [item(9, 1)])
    let release = () => {}
    const getPending = LocalNotifications.getPending.getMockImplementation()
    LocalNotifications.getPending.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (release = resolve))
      return getPending!()
    })
    LocalNotifications.schedule.mockClear()
    const first = replaceScheduledNotifications('prayer-times', [item(1, 1)])
    await vi.waitFor(() => expect(LocalNotifications.getPending).toHaveBeenCalledTimes(2))
    const second = replaceScheduledNotifications('prayer-times', [item(2, 1)])
    const third = replaceScheduledNotifications('prayer-times', [])
    // Nothing of the later calls has touched the system while the first is under way.
    await Promise.resolve()
    expect(LocalNotifications.getPending).toHaveBeenCalledTimes(2)
    release()
    await Promise.all([first, second, third])
    // The first went through; the second was overtaken before its turn; the third cleared the group.
    expect(scheduled().map((batch) => batch.map(({ id }) => id))).toEqual([[1]])
    expect(pendingOf('prayer-times')).toEqual([])
  })

  it('keeps working after a call that failed', async () => {
    LocalNotifications.getPending.mockRejectedValueOnce(new Error('busy'))
    await expect(replaceScheduledNotifications('prayer-times', [item(1, 1)])).rejects.toThrow('busy')
    await replaceScheduledNotifications('prayer-times', [item(2, 1)])
    expect(pendingOf('prayer-times').map(({ id }) => id)).toEqual([2])
  })

  describe('on Android', () => {
    beforeEach(() => resetDevice('android'))

    it('asks for exact alarms when the app may set them, with the channel’s own sound', async () => {
      await replaceScheduledNotifications('prayer-times', [item(1, 1)])
      expect(scheduled()[0]?.[0]).toMatchObject({ id: 1, isExactNotification: true })
      expect(scheduled()[0]?.[0]).not.toHaveProperty('sound')
    })

    it('schedules inexact alarms without opening the system screen when exact ones are refused (Android 12+)', async () => {
      device.exactAlarms = 'denied'
      await replaceScheduledNotifications('prayer-times', [item(1, 1), item(2, 2)])
      expect(scheduled()).toHaveLength(1)
      expect(scheduled()[0]?.map((notification) => notification.isExactNotification)).toEqual([false, false])
      expect(pendingOf('prayer-times')).toHaveLength(2)
    })

    it('falls back to inexact alarms when the system refuses exact ones at the last moment', async () => {
      device.refuseExact = true
      await replaceScheduledNotifications('prayer-times', [item(1, 1)])
      expect(scheduled().map((batch) => batch[0]?.isExactNotification)).toEqual([true, false])
      expect(pendingOf('prayer-times').map(({ id }) => id)).toEqual([1])
    })

    it('treats an unreadable exact-alarm setting as a refusal', async () => {
      LocalNotifications.checkExactNotificationSetting.mockRejectedValueOnce(new Error('unavailable'))
      await replaceScheduledNotifications('prayer-times', [item(1, 1)])
      expect(scheduled()[0]?.[0]?.isExactNotification).toBe(false)
    })
  })

  it('does not ask iOS about exact alarms, which it does not have', async () => {
    await replaceScheduledNotifications('prayer-times', [item(1, 1)])
    expect(LocalNotifications.checkExactNotificationSetting).not.toHaveBeenCalled()
    expect(scheduled()[0]?.[0]).not.toHaveProperty('isExactNotification')
  })
})

describe('permission', () => {
  it('reports the system’s answer in three words', async () => {
    for (const [state, expected] of [
      ['granted', 'granted'],
      ['denied', 'denied'],
      ['prompt', 'prompt'],
      ['prompt-with-rationale', 'prompt'],
    ] as const) {
      device.notifications = state
      expect(await nativeNotificationPermission()).toBe(expected)
    }
  })

  it('asks, and takes a failure to ask as a refusal', async () => {
    device.notifications = 'prompt'
    expect(await requestNativeNotificationPermission()).toBe('granted')
    LocalNotifications.requestPermissions.mockRejectedValueOnce(new Error('no'))
    expect(await requestNativeNotificationPermission()).toBe('denied')
  })
})

describe('onNotificationTap', () => {
  const tapped = (group: string, data: Record<string, unknown> = {}) => tapNotification({ id: 1, extra: { ...data, group } })

  it('hands a tap to the handlers of its group only, with the planned data', () => {
    const prayers = vi.fn()
    const azkar = vi.fn()
    const stopPrayers = onNotificationTap('prayer-times', prayers)
    const stopAzkar = onNotificationTap('azkar-reminders', azkar)

    tapped('azkar-reminders', { session: 'evening', count: 3 })
    expect(azkar).toHaveBeenCalledWith({ data: { session: 'evening' } })
    expect(prayers).not.toHaveBeenCalled()
    stopPrayers()
    stopAzkar()
  })

  it('ignores a notification swiped away, and one that is not the app’s', () => {
    const handler = vi.fn()
    const stop = onNotificationTap('prayer-times', handler)
    tapNotification({ id: 1, extra: { group: 'prayer-times' } }, 'dismiss')
    tapNotification({ id: 2, extra: 'not an object' })
    tapNotification({ id: 3 })
    expect(handler).not.toHaveBeenCalled()
    stop()
  })

  it('keeps a tap that came before anyone listened for its group, as when it launched the app', () => {
    const stopOther = onNotificationTap('other', () => {})
    tapped('prayer-times', { prayer: 'fajr' })

    const handler = vi.fn()
    const stop = onNotificationTap('prayer-times', handler)
    expect(handler).toHaveBeenCalledExactlyOnceWith({ data: { prayer: 'fajr' } })
    stop()
    // Handed over once only.
    const again = vi.fn()
    onNotificationTap('prayer-times', again)()
    expect(again).not.toHaveBeenCalled()
    stopOther()
  })

  it('listens to the plugin once, however many handlers come and go', () => {
    for (let i = 0; i < 3; i++) onNotificationTap('prayer-times', () => {})()
    onNotificationTap('azkar-reminders', () => {})()
    expect(tapListenerCount()).toBe(1)
  })
})

describe('onAppActive', () => {
  it('calls back each time the app returns to the foreground, until stopped', () => {
    const listener = vi.fn()
    const stop = onAppActive(listener)
    bringToForeground()
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    bringToForeground()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does nothing in a browser', () => {
    resetDevice('web')
    const listener = vi.fn()
    onAppActive(listener)()
    expect(onNotificationTap('prayer-times', listener)).toBeTypeOf('function')
    bringToForeground()
    expect(listener).not.toHaveBeenCalled()
  })
})
