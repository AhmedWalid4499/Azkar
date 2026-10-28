import { useEffect } from 'react'
import { isNativeApp, setNativeKeepAwake } from '../../native'

/** The Screen Wake Lock API, in a browser. */
export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

/** Whether the screen can be kept on at all: always in the app, through the API in a browser. */
export function keepAwakeSupported(): boolean {
  return isNativeApp() || wakeLockSupported()
}

/**
 * Keeps the screen on while `active`. In the app the system keeps it on until told
 * otherwise. In a browser the lock is dropped whenever the page is hidden, so it is
 * taken again each time the page comes back. Failure (battery saver, no permission)
 * just means the screen follows the system timeout as usual.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    if (isNativeApp()) {
      void setNativeKeepAwake(true)
      return () => {
        void setNativeKeepAwake(false)
      }
    }
    if (!wakeLockSupported()) return

    let sentinel: WakeLockSentinel | null = null
    let requesting = false
    let disposed = false

    const release = (lock: WakeLockSentinel) => {
      lock.release().catch(() => {})
    }

    const acquire = async () => {
      if (requesting || sentinel || document.visibilityState !== 'visible') return
      requesting = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (disposed) {
          release(lock)
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      } catch {
        // Not granted: nothing to do.
      } finally {
        requesting = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (sentinel) release(sentinel)
      sentinel = null
    }
  }, [active])
}
