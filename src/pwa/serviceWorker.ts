import { create } from 'zustand'
import { isNativeApp } from '../native'

/** An open app asks the server for a new version at most this often, when it returns to the foreground. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000
/** If the new worker has not taken over this long after "Reload" was pressed, reload anyway: that is what was asked for. */
const TAKEOVER_TIMEOUT_MS = 4_000

/**
 * `ready`: a new version is installed and waiting for the user's go-ahead.
 * `applying`: the user pressed Reload and the page is about to be replaced.
 */
export type UpdateStatus = 'idle' | 'ready' | 'applying'

interface UpdateState {
  status: UpdateStatus
  /** The user chose "Not now". Kept for this visit only; the update applies by itself on the next launch. */
  dismissed: boolean
}

export const useUpdateStore = create<UpdateState>(() => ({ status: 'idle', dismissed: false }))

let reloadPage = () => window.location.reload()
/** Tells the waiting worker to take over. Set once registration has started. */
let activateWaiting: (() => Promise<void>) | undefined
/** True from the moment the user presses Reload: the only thing that may reload the page. */
let reloadRequested = false
/** Another tab accepted the update, so the new worker already controls this page. */
let takenOver = false
let reloaded = false

function reloadOnce() {
  if (reloaded) return
  reloaded = true
  reloadPage()
}

function announce() {
  // Once dismissed it stays quiet for this visit, even if a still newer version arrives.
  if (useUpdateStore.getState().status === 'idle') useUpdateStore.setState({ status: 'ready' })
}

function watchForUpdates(registration: ServiceWorkerRegistration) {
  let checkedAt = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    if (Date.now() - checkedAt < UPDATE_CHECK_INTERVAL_MS) return
    checkedAt = Date.now()
    // Rejects when the server cannot be reached; the check after the next interval tries again.
    registration.update().catch(() => {})
  })
}

/**
 * Registers the service worker that makes the app work offline. Call once, in
 * production builds only (see src/app/start.tsx). Never in the iOS and Android
 * apps: they carry their files with them, and a worker there would only serve
 * an old copy over the one an app update installed.
 *
 * The page is never reloaded on its own: someone may be in the middle of
 * reciting. A new version waits, UpdateBanner offers it, and only
 * `applyUpdate()` reloads.
 *
 * @param reload Replaces the page; a parameter so that tests can observe it.
 */
export async function registerServiceWorker(reload: () => void = () => window.location.reload()): Promise<void> {
  if (isNativeApp() || !('serviceWorker' in navigator)) return
  reloadPage = reload

  const container = navigator.serviceWorker
  let controlled = container.controller !== null
  container.addEventListener('controllerchange', () => {
    if (reloadRequested) {
      reloadOnce()
      return
    }
    // The first worker claiming a fresh page is not an update. A change of
    // controller after that means another tab accepted the update: this page
    // keeps running on what it has already loaded, and the banner offers the reload.
    if (controlled) {
      takenOver = true
      announce()
    }
    controlled = true
  })

  try {
    const { registerSW } = await import('virtual:pwa-register')
    activateWaiting = registerSW({
      onNeedRefresh: announce,
      // Without this the plugin reloads every open tab as soon as one of them accepts.
      onNeedReload: () => {},
      onRegisteredSW: (_url, registration) => {
        if (registration) watchForUpdates(registration)
      },
    })
  } catch {
    // The app works without a service worker; it just is not available offline.
  }
}

/** The user pressed Reload. */
export function applyUpdate(): void {
  if (useUpdateStore.getState().status !== 'ready') return
  if (takenOver || !activateWaiting) {
    reloadOnce()
    return
  }
  reloadRequested = true
  useUpdateStore.setState({ status: 'applying' })
  // Normally the `controllerchange` listener reloads first, a moment after the worker is told to take over.
  window.setTimeout(reloadOnce, TAKEOVER_TIMEOUT_MS)
  void activateWaiting()
}

/** The user pressed "Not now". */
export function dismissUpdate(): void {
  useUpdateStore.setState({ dismissed: true })
}
