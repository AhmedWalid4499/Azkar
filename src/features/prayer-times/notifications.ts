export type NotificationState = NotificationPermission | 'unsupported'

/** iOS Safari only has the Notification API once the app is added to the Home Screen. */
export function notificationState(): NotificationState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Asks only when the browser has not been answered yet; otherwise reports the standing answer. */
export async function requestNotificationPermission(): Promise<NotificationState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await new Promise<NotificationPermission>((resolve, reject) => {
      // Older Safari takes a callback and returns nothing; everything else returns a promise.
      const pending = Notification.requestPermission(resolve) as Promise<NotificationPermission> | undefined
      pending?.then(resolve, reject)
    })
  } catch {
    return Notification.permission
  }
}

/**
 * Shows a notification through the service worker when one is active (the only
 * way that works on Android), otherwise straight from the page. Resolves to
 * whether anything was shown; never throws.
 */
export async function showNotification(title: string, options: NotificationOptions): Promise<boolean> {
  if (notificationState() !== 'granted') return false
  try {
    // getRegistration() answers "none" at once; `ready` would wait forever without a worker.
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration?.active) {
      await registration.showNotification(title, options)
      return true
    }
  } catch {
    // Fall through to the page-level API.
  }
  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}
