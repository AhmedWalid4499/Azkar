/**
 * Keeps persisted stores in step when the app is open more than once on the
 * same device: two tabs, or the installed app next to a browser tab.
 *
 * Each store writes its whole state on every change, so a tab still holding an
 * older copy would write that copy back over what another tab has stored since.
 * Here a tab reads a key again as soon as another tab has changed it.
 */

/** The part of a zustand store with the `persist` middleware that is used here. */
export interface PersistedStore {
  getState: () => unknown
  subscribe: (listener: () => void) => () => void
  /** Missing at run time when the browser denies access to storage: the store then works unsaved. */
  persist?: {
    getOptions: () => { name?: string; version?: number; partialize?: (state: never) => unknown }
    rehydrate: () => Promise<void> | void
  }
}

export interface TabSyncOptions {
  /** What to do when another tab erased or replaced the stored data. Reloads the page by default. */
  reload?: () => void
}

function versionOf(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as { version?: unknown }).version : undefined
  } catch {
    return undefined
  }
}

type Persist = NonNullable<PersistedStore['persist']>

/** What the checks below need of a store that is saved. */
interface Followed {
  getState: () => unknown
  persist: Persist
}

/** The string the store would save for the state it holds now, or `null` if that cannot be told. */
function ownString({ getState, persist }: Followed): string | null {
  const { partialize, version } = persist.getOptions()
  if (!partialize) return null
  try {
    return JSON.stringify({ state: partialize(getState() as never), version })
  } catch {
    return null
  }
}

/**
 * Starts following other tabs' changes to `stores`. Call once at startup, after
 * the stores have been created. Returns a function that stops it.
 *
 * It only ever reads storage. Rehydrating a store does not write, so two tabs
 * cannot answer each other's changes in a loop.
 */
export function syncStoresAcrossTabs(stores: readonly PersistedStore[], options: TabSyncOptions = {}): () => void {
  const reload = options.reload ?? (() => window.location.reload())
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    // Storage is blocked, so nothing is saved and there is nothing to follow.
    return () => {}
  }
  const byKey = new Map<string, Followed>()
  /** The stored string each store's state was last known to match. */
  const seen = new Map<string, string | null>()
  const cleanups: Array<() => void> = []
  let rehydrating = false
  let reloading = false

  const read = (key: string) => {
    try {
      return storage.getItem(key)
    } catch {
      return null
    }
  }

  const reloadOnce = () => {
    if (reloading) return
    reloading = true
    reload()
  }

  for (const store of stores) {
    const key = store.persist?.getOptions().name
    if (!store.persist || key === undefined) continue
    byKey.set(key, { getState: store.getState, persist: store.persist })
    seen.set(key, read(key))
    cleanups.push(
      store.subscribe(() => {
        if (rehydrating) return
        // The store writes right after notifying its listeners, so its own write is read back a moment later.
        queueMicrotask(() => seen.set(key, read(key)))
      }),
    )
  }

  /** Brings one store up to date if its key no longer holds what the store last read or wrote. */
  const check = (key: string, store: Followed) => {
    // The page is on its way out and will read everything afresh. Until it goes, the rest of
    // an import still arrives here, and a store read now could set off the app's own
    // reactions to it (the first location saving the calculation settings), which write.
    if (reloading) return
    const raw = read(key)
    // Rehydrating gives the state fresh objects, and everything keyed on them
    // (the timetable, reminder scheduling) would recompute, so it has to be earned.
    if (raw === seen.get(key)) return
    if (raw === null) {
      // Erased elsewhere. A store keeps its state when nothing is stored, so only a reload forgets it.
      reloadOnce()
      return
    }
    seen.set(key, raw)
    // A store can save without a change to tell its listeners about, and that
    // write went unnoticed above. What is stored is then what it already holds.
    if (raw === ownString(store)) return
    const version = versionOf(raw)
    // Written by a different build. Reading it would migrate it and write the
    // result back, and the two builds would rewrite each other's data forever.
    if (typeof version === 'number' && version !== store.persist.getOptions().version) return
    rehydrating = true
    try {
      void store.persist.rehydrate()
    } finally {
      rehydrating = false
    }
  }

  const checkAll = () => {
    // An erase or an import shows as a key that is gone. Found first, so that nothing
    // is read from the keys before it in the list when the answer is to reload.
    for (const key of byKey.keys()) {
      if (seen.get(key) !== null && read(key) === null) {
        reloadOnce()
        return
      }
    }
    for (const [key, store] of byKey) check(key, store)
  }

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== storage) return
    if (event.key === null) {
      // localStorage.clear(), possibly by another site on this origin: look at what is left of ours.
      checkAll()
      return
    }
    const store = byKey.get(event.key)
    if (!store) return
    // A removed key means another tab erased the data or is importing a backup.
    // Reloading, unlike resetting the store, cannot write anything over what that tab stores next.
    if (event.newValue === null) {
      if (seen.get(event.key) !== null || read(event.key) !== null) reloadOnce()
      return
    }
    check(event.key, store)
  }

  // Storage events do not reach a frozen tab, or a page waiting in the back/forward cache.
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') checkAll()
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) checkAll()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    for (const cleanup of cleanups) cleanup()
  }
}
