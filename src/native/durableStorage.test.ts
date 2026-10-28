import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  app: true,
  /** What the app's native preferences hold. */
  prefs: new Map<string, string>(),
  failKeys: false,
}))

vi.mock('./platform', () => ({ isNativeApp: () => native.app, appPlatform: () => (native.app ? 'ios' : 'web') }))

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    keys: vi.fn(async () => {
      if (native.failKeys) throw new Error('bridge unavailable')
      return { keys: [...native.prefs.keys()] }
    }),
    get: vi.fn(async ({ key }: { key: string }) => ({ value: native.prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      native.prefs.set(key, value)
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      native.prefs.delete(key)
    }),
    clear: vi.fn(async () => {
      native.prefs.clear()
    }),
  },
}))

const LOG = 'azkar:prayer-log'
const SETTINGS = 'azkar:settings'
const LOG_VALUE = '{"state":{"entries":{"2026-10-26":{"fajr":"ontime"}}},"version":1}'

const { setItem, removeItem, clear } = Storage.prototype

/** A fresh copy of the module: it remembers whether it has restored and is mirroring. */
async function load() {
  vi.resetModules()
  return import('./durableStorage')
}

/** Lets the mirror's fire-and-forget calls land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  native.app = true
  native.prefs.clear()
  native.failKeys = false
})

afterEach(() => {
  // mirrorToNative wraps these for the life of the page; put them back for the next test.
  Object.assign(Storage.prototype, { setItem, removeItem, clear })
})

describe('restoreFromNative', () => {
  it('puts back what the web view lost, and only the app’s keys', async () => {
    native.prefs.set(LOG, LOG_VALUE)
    native.prefs.set('someone-else', 'x')
    const { restoreFromNative } = await load()

    await restoreFromNative()

    expect(localStorage.getItem(LOG)).toBe(LOG_VALUE)
    expect(localStorage.getItem('someone-else')).toBeNull()
  })

  it('keeps what the web view still holds over the native copy', async () => {
    native.prefs.set(SETTINGS, '{"state":{"language":"en"},"version":1}')
    localStorage.setItem(SETTINGS, '{"state":{"language":"ar"},"version":1}')
    const { restoreFromNative } = await load()

    await restoreFromNative()

    expect(localStorage.getItem(SETTINGS)).toBe('{"state":{"language":"ar"},"version":1}')
  })

  it('does nothing in a browser', async () => {
    native.app = false
    native.prefs.set(LOG, LOG_VALUE)
    const { restoreFromNative } = await load()
    await restoreFromNative()
    expect(localStorage.getItem(LOG)).toBeNull()
  })
})

describe('mirrorToNative', () => {
  it('copies every write, removal and clear of the app’s keys after a restore', async () => {
    localStorage.setItem(SETTINGS, '{"state":{},"version":1}')
    const { mirrorToNative, restoreFromNative } = await load()
    await restoreFromNative()
    mirrorToNative()
    await settle()
    // What the web view already held is copied first.
    expect(native.prefs.get(SETTINGS)).toBe('{"state":{},"version":1}')

    localStorage.setItem(LOG, LOG_VALUE)
    localStorage.setItem('someone-else', 'x')
    sessionStorage.setItem('azkar:session', 'x')
    await settle()
    expect(native.prefs.get(LOG)).toBe(LOG_VALUE)
    expect(native.prefs.has('someone-else')).toBe(false)
    expect(native.prefs.has('azkar:session')).toBe(false)

    localStorage.removeItem(LOG)
    await settle()
    expect(native.prefs.has(LOG)).toBe(false)

    localStorage.clear()
    await settle()
    expect(native.prefs.size).toBe(0)
  })

  it('never writes over the native copy when it could not be read at launch', async () => {
    // The web view lost the log, and the bridge failed when it was to be put back.
    native.prefs.set(LOG, LOG_VALUE)
    native.failKeys = true
    const { mirrorToNative, restoreFromNative } = await load()
    await restoreFromNative()
    mirrorToNative()

    // The store, finding nothing, saves an empty log.
    localStorage.setItem(LOG, '{"state":{"entries":{}},"version":1}')
    localStorage.removeItem(LOG)
    await settle()

    expect(native.prefs.get(LOG)).toBe(LOG_VALUE)

    // At the next launch the bridge answers, and the log comes back.
    native.failKeys = false
    localStorage.clear()
    const next = await load()
    await next.restoreFromNative()
    expect(localStorage.getItem(LOG)).toBe(LOG_VALUE)
  })

  it('does nothing in a browser', async () => {
    native.app = false
    const { mirrorToNative, restoreFromNative } = await load()
    await restoreFromNative()
    mirrorToNative()
    localStorage.setItem(LOG, LOG_VALUE)
    await settle()
    expect(native.prefs.size).toBe(0)
    expect(Storage.prototype.setItem).toBe(setItem)
  })
})
