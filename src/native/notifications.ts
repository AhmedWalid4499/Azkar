import { LocalNotifications } from '@capacitor/local-notifications'

export type NativeNotificationPermission = 'granted' | 'denied' | 'prompt'

export interface PlannedNotification {
  /** Unique across all groups: 32-bit signed integer. */
  id: number
  title: string
  body: string
  at: Date
}

function normalise(state: string): NativeNotificationPermission {
  return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt'
}

export async function nativeNotificationPermission(): Promise<NativeNotificationPermission> {
  try {
    return normalise((await LocalNotifications.checkPermissions()).display)
  } catch {
    return 'denied'
  }
}

export async function requestNativeNotificationPermission(): Promise<NativeNotificationPermission> {
  try {
    return normalise((await LocalNotifications.requestPermissions()).display)
  } catch {
    return 'denied'
  }
}

/**
 * Replaces every pending notification of `group` with `items`, scheduled by the
 * system so they arrive even when the app is closed. Groups keep features from
 * cancelling each other's notifications. iOS keeps at most 64 pending
 * notifications for the whole app, so callers schedule a rolling window and
 * call this again whenever the app opens or their inputs change.
 */
export async function replaceScheduledNotifications(group: string, items: PlannedNotification[]): Promise<void> {
  const { notifications: pending } = await LocalNotifications.getPending()
  const stale = pending.filter((notification) => notification.extra?.group === group)
  if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale.map(({ id }) => ({ id })) })
  const now = Date.now()
  const upcoming = items.filter((item) => item.at.getTime() > now)
  if (upcoming.length === 0) return
  await LocalNotifications.schedule({
    notifications: upcoming.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at, allowWhileIdle: true },
      extra: { group },
    })),
  })
}
