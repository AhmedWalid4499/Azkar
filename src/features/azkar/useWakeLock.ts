import { useEffect } from 'react'

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

/**
 * Keeps the screen on while `active`. The browser drops the lock whenever the
 * page is hidden, so it is taken again each time the page comes back. Failure
 * (battery saver, no permission) just means the screen follows the system
 * timeout as usual.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !wakeLockSupported()) return

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
