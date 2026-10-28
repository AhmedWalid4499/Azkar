// Shared by this feature's tests only; nothing in the app imports it.
// Stand-ins for the Capacitor plugins, wired in by each test file with:
//
//   vi.mock('@capacitor/core', async (original) => (await import('./native-fakes')).mockCore(await original()))
//   vi.mock('@capacitor/local-notifications', async () => (await import('./native-fakes')).localNotificationsModule)
//   vi.mock('@capacitor/app', async () => (await import('./native-fakes')).appModule)
//   vi.mock('@capacitor/geolocation', async () => (await import('./native-fakes')).geolocationModule)
//
// Nothing here may import a Capacitor module at run time: it is loaded from inside those mocks.
import { vi } from 'vitest'
import type { PermissionState } from '@capacitor/core'
import type { ActionPerformed, LocalNotificationSchema } from '@capacitor/local-notifications'

type Listener<T> = (event: T) => void

/** The pretend device. Reset with `resetDevice` before each test. */
export const device = {
  platform: 'web' as 'ios' | 'android' | 'web',
  notifications: 'granted' as PermissionState,
  /** How a notification permission prompt is answered. */
  notificationAnswer: 'granted' as PermissionState,
  exactAlarms: 'granted' as PermissionState,
  /** The system refuses exact alarms at schedule time even though the setting said yes. */
  refuseExact: false,
  pending: new Map<number, LocalNotificationSchema>(),
  /** The approximate-location permission, which is all the app needs. */
  location: 'granted' as PermissionState,
  /** How a location permission prompt is answered. */
  locationAnswer: 'granted' as PermissionState,
  /**
   * Android 12+: the user allowed only an approximate position, and the precise
   * one stands at this. The plugin's `location` then reads it, while
   * `coarseLocation` reads granted.
   */
  preciseRefused: null as PermissionState | null,
  /** What getCurrentPosition gives: coordinates, or an error object to reject with. */
  position: { latitude: 30.0444196, longitude: 31.2357116 } as { latitude: number; longitude: number } | { code: string; message: string },
  /** When set, checkPermissions rejects with this (location services off for the whole device). */
  locationCheckError: null as { code: string; message: string } | null,
}

const tapListeners = new Set<Listener<ActionPerformed>>()
/** Like Capacitor, the plugin keeps a tap that came before any listener and hands it to the first one. */
const retainedTaps: ActionPerformed[] = []
const appStateListeners = new Set<Listener<{ isActive: boolean }>>()

export function resetDevice(platform: typeof device.platform = 'ios') {
  Object.assign(device, {
    platform,
    notifications: 'granted',
    notificationAnswer: 'granted',
    exactAlarms: 'granted',
    refuseExact: false,
    location: 'granted',
    locationAnswer: 'granted',
    preciseRefused: null,
    position: { latitude: 30.0444196, longitude: 31.2357116 },
    locationCheckError: null,
  })
  device.pending.clear()
  for (const fake of [...Object.values(LocalNotifications), ...Object.values(App), ...Object.values(Geolocation)]) fake.mockClear()
}

function handle<T>(listeners: Set<Listener<T>>, listener: Listener<T>) {
  listeners.add(listener)
  return { remove: vi.fn(async () => void listeners.delete(listener)) }
}

export const LocalNotifications = {
  checkPermissions: vi.fn(async () => ({ display: device.notifications })),
  requestPermissions: vi.fn(async () => {
    if (device.notifications === 'prompt' || device.notifications === 'prompt-with-rationale') device.notifications = device.notificationAnswer
    return { display: device.notifications }
  }),
  checkExactNotificationSetting: vi.fn(async () => {
    if (device.platform !== 'android') throw new Error('Not implemented on iOS.')
    return { exact_alarm: device.exactAlarms }
  }),
  getPending: vi.fn(async () => ({
    notifications: [...device.pending.values()].map(({ id, title, body, schedule, extra }) => ({ id, title, body, schedule, extra })),
  })),
  cancel: vi.fn(async ({ notifications }: { notifications: Array<{ id: number }> }) => {
    for (const { id } of notifications) device.pending.delete(id)
  }),
  schedule: vi.fn(async ({ notifications }: { notifications: LocalNotificationSchema[] }) => {
    if (device.refuseExact && notifications.some((notification) => notification.isExactNotification !== false)) {
      throw Object.assign(new Error('Exact alarms are not allowed.'), { code: 'OS-PLUG-LNOT-0013' })
    }
    for (const notification of notifications) device.pending.set(notification.id, notification)
    return { notifications: notifications.map(({ id }) => ({ id })) }
  }),
  addListener: vi.fn(async (_event: 'localNotificationActionPerformed', listener: Listener<ActionPerformed>) => {
    const listening = handle(tapListeners, listener)
    const retained = retainedTaps.splice(0)
    if (retained.length > 0) queueMicrotask(() => retained.forEach(listener))
    return listening
  }),
}

export const App = {
  addListener: vi.fn(async (_event: 'appStateChange', listener: Listener<{ isActive: boolean }>) => handle(appStateListeners, listener)),
}

/** As the plugin reports it: `location` is the precise and approximate permissions together. */
function locationStatus() {
  const coarse = device.location
  return { location: coarse === 'granted' && device.preciseRefused ? device.preciseRefused : coarse, coarseLocation: coarse }
}

export const Geolocation = {
  checkPermissions: vi.fn(async () => {
    if (device.locationCheckError) throw device.locationCheckError
    return locationStatus()
  }),
  requestPermissions: vi.fn(async (_options?: unknown) => {
    if (device.location === 'prompt' || device.location === 'prompt-with-rationale') device.location = device.locationAnswer
    return locationStatus()
  }),
  getCurrentPosition: vi.fn(async (_options?: unknown) => {
    // Without permission the plugin asks once more, and fails as refused.
    if (device.location !== 'granted') throw Object.assign(new Error('Location permission request was denied.'), { code: 'OS-PLUG-GLOC-0003' })
    const position = device.position
    if ('code' in position) throw Object.assign(new Error(position.message), { code: position.code })
    return { timestamp: Date.now(), coords: { ...position, accuracy: 20, altitude: null, altitudeAccuracy: null, speed: null, heading: null } }
  }),
}

export const localNotificationsModule = { LocalNotifications }
export const appModule = { App }
export const geolocationModule = { Geolocation }

/** @capacitor/core as it is, except for the platform, which `device.platform` decides. */
export function mockCore<T extends { Capacitor: object }>(actual: T): T {
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      getPlatform: () => device.platform,
      isNativePlatform: () => device.platform !== 'web',
    },
  }
}

/** The user taps (or, with `actionId: 'dismiss'`, swipes away) a delivered notification. */
export function tapNotification(notification: Pick<LocalNotificationSchema, 'id' | 'extra'>, actionId = 'tap') {
  const event = { actionId, notification: { title: '', body: '', ...notification } }
  if (tapListeners.size === 0) retainedTaps.push(event)
  for (const listener of tapListeners) listener(event)
}

/** How many listeners the app has put on notification taps. */
export function tapListenerCount(): number {
  return tapListeners.size
}

/** The app comes back to the foreground. */
export function bringToForeground() {
  for (const listener of appStateListeners) listener({ isActive: true })
}

/** Pending notifications of one group, soonest first. */
export function pendingOf(group: string): LocalNotificationSchema[] {
  return [...device.pending.values()]
    .filter((notification) => notification.extra?.group === group)
    .sort((a, b) => (a.schedule?.at?.getTime() ?? 0) - (b.schedule?.at?.getTime() ?? 0))
}
