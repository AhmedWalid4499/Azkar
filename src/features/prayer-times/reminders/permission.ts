import { useEffect, useState } from 'react'
import { isNativeApp, nativeNotificationPermission, requestNativeNotificationPermission } from '../../../native'
import type { NativeNotificationPermission } from '../../../native'
import { onAppActive } from '../../../native/notifications'
import { notificationState, requestNotificationPermission } from '../notifications'
import type { NotificationState } from '../notifications'

/** The system's answers in the browser's words: not asked yet is "default". */
const FROM_NATIVE: Record<NativeNotificationPermission, NotificationPermission> = {
  granted: 'granted',
  denied: 'denied',
  prompt: 'default',
}

/** Whether reminders may be shown: the system's permission in the app, the browser's elsewhere. */
export async function reminderPermission(): Promise<NotificationState> {
  return isNativeApp() ? FROM_NATIVE[await nativeNotificationPermission()] : notificationState()
}

/** Asks only when it has not been answered yet; otherwise reports the standing answer. */
export async function requestReminderPermission(): Promise<NotificationState> {
  return isNativeApp() ? FROM_NATIVE[await requestNativeNotificationPermission()] : requestNotificationPermission()
}

/**
 * The permission as it stands, read again whenever the app or page comes back
 * into view: it can be changed in the system or browser settings meanwhile.
 * `null` while the app is still asking the system for the first time.
 * `onRead` hears every answer read that way, changed or not.
 */
export function useReminderPermission(onRead: (permission: NotificationState) => void): {
  permission: NotificationState | null
  setPermission: (permission: NotificationState) => void
} {
  const [permission, setPermission] = useState<NotificationState | null>(() => (isNativeApp() ? null : notificationState()))

  useEffect(() => {
    let active = true
    const apply = (current: NotificationState) => {
      if (!active) return
      setPermission(current)
      onRead(current)
    }
    // The browser answers at once; the system takes a round trip.
    const read = () => {
      if (isNativeApp()) void reminderPermission().then(apply)
      else apply(notificationState())
    }
    if (isNativeApp()) read()
    const onVisible = () => {
      if (document.visibilityState === 'visible') read()
    }
    document.addEventListener('visibilitychange', onVisible)
    const stopActive = onAppActive(read)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      stopActive()
    }
  }, [onRead])

  return { permission, setPermission }
}
