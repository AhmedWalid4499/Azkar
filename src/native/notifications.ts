import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { LocalNotificationSchema } from '@capacitor/local-notifications'
import { appPlatform, isNativeApp } from './platform'

export type NativeNotificationPermission = 'granted' | 'denied' | 'prompt'

export interface PlannedNotification {
  /** Unique across all groups: 32-bit signed integer. */
  id: number
  title: string
  body: string
  at: Date
  /** Handed back when the notification is tapped (see `onNotificationTap`). */
  data?: Record<string, string>
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
 * Android 12 and later let the user (and, from Android 14, the system by
 * default) refuse exact alarms. Asking for one anyway would open the system's
 * "Alarms & reminders" screen on every call, so it is only asked for when it
 * is allowed. iOS has no such setting.
 */
async function canScheduleExact(): Promise<boolean> {
  if (appPlatform() !== 'android') return true
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return false
  }
}

async function replaceNow(group: string, items: PlannedNotification[]): Promise<void> {
  const { notifications: pending } = await LocalNotifications.getPending()
  const stale = pending.filter((notification) => notification.extra?.group === group)
  if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale.map(({ id }) => ({ id })) })
  const now = Date.now()
  const upcoming = items.filter((item) => item.at.getTime() > now)
  if (upcoming.length === 0) return
  const android = appPlatform() === 'android'
  const exact = await canScheduleExact()
  const build = (asExact: boolean): LocalNotificationSchema[] =>
    upcoming.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at, allowWhileIdle: true },
      extra: { ...item.data, group },
      // Android sounds the default channel's tone; iOS stays silent without a sound,
      // and plays the system's own for a name it has no file for.
      ...(android ? { isExactNotification: asExact } : { sound: 'default' }),
    }))
  try {
    await LocalNotifications.schedule({ notifications: build(exact) })
  } catch (error) {
    if (!android || !exact) throw error
    // The exact alarm was refused after all (the setting changed in between, or a
    // device's own rules). An inexact one can come some minutes late, which a reminder can bear.
    await LocalNotifications.schedule({ notifications: build(false) })
  }
}

/** Per group: the number of the latest call, and the work queued so far. */
const latestCall = new Map<string, number>()
const queues = new Map<string, Promise<void>>()

/**
 * Replaces every pending notification of `group` with `items`, scheduled by the
 * system so they arrive even when the app is closed. Groups keep features from
 * cancelling each other's notifications. iOS keeps at most 64 pending
 * notifications for the whole app, so callers schedule a rolling window and
 * call this again whenever the app opens or their inputs change.
 *
 * Calls for one group run one after the other, and a call that a newer one has
 * overtaken while it waited is skipped: the newest items always win.
 */
export function replaceScheduledNotifications(group: string, items: PlannedNotification[]): Promise<void> {
  const call = (latestCall.get(group) ?? 0) + 1
  latestCall.set(group, call)
  const run = (queues.get(group) ?? Promise.resolve())
    .catch(() => {})
    .then(() => (latestCall.get(group) === call ? replaceNow(group, items) : undefined))
  queues.set(group, run)
  return run
}

export interface NotificationTap {
  /** The `data` the notification was planned with. */
  data: Record<string, string>
}

type TapHandler = (tap: NotificationTap) => void

const tapHandlers = new Map<string, Set<TapHandler>>()
/** A tap that came before anyone listened for its group, as when it launched the app. */
const unclaimedTaps = new Map<string, NotificationTap>()
let tapListener: Promise<unknown> | null = null

function stringsOf(value: Record<string, unknown>): Record<string, string> {
  const strings: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) if (typeof entry === 'string') strings[key] = entry
  return strings
}

function listenForTaps(): void {
  tapListener ??= LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    // Swiping a notification away is reported here too, as "dismiss".
    if (actionId !== 'tap') return
    const extra: unknown = notification.extra
    if (typeof extra !== 'object' || extra === null) return
    const { group, ...data } = extra as Record<string, unknown>
    if (typeof group !== 'string') return
    const tap = { data: stringsOf(data) }
    const handlers = tapHandlers.get(group)
    if (handlers && handlers.size > 0) for (const handler of handlers) handler(tap)
    else unclaimedTaps.set(group, tap)
  }).catch(() => {
    tapListener = null
  })
}

/**
 * Calls `handler` whenever the user taps a notification of `group`, including
 * the tap that opened the app before anything listened for it. Returns a
 * function that stops it. Does nothing in a browser.
 */
export function onNotificationTap(group: string, handler: TapHandler): () => void {
  if (!isNativeApp()) return () => {}
  listenForTaps()
  let handlers = tapHandlers.get(group)
  if (!handlers) tapHandlers.set(group, (handlers = new Set()))
  handlers.add(handler)
  const waiting = unclaimedTaps.get(group)
  if (waiting) {
    unclaimedTaps.delete(group)
    handler(waiting)
  }
  return () => {
    handlers.delete(handler)
  }
}

/**
 * Calls `listener` each time the app comes back to the foreground, so that
 * scheduled notifications can be renewed and a permission changed in the
 * system Settings app noticed. Returns a function that stops it. Does nothing
 * in a browser, where `visibilitychange` does this job.
 */
export function onAppActive(listener: () => void): () => void {
  if (!isNativeApp()) return () => {}
  let stopped = false
  const handle = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && !stopped) listener()
  }).catch(() => null)
  return () => {
    stopped = true
    void handle.then((listening) => listening?.remove()).catch(() => {})
  }
}
