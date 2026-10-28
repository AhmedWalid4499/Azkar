import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SETTINGS_KEY = 'azkar:settings'

const mocks = vi.hoisted(() => ({
  events: [] as string[],
  native: false,
  restore: async () => {},
  hideSplashScreen: vi.fn(async () => {}),
  registerServiceWorker: vi.fn(async () => {}),
}))

// The entry point is what is under test, not the screens it draws.
vi.mock('./App', () => ({ App: () => createElement('p', null, 'First screen') }))

vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  isNativeApp: () => mocks.native,
  restoreFromNative: async () => {
    mocks.events.push('restore')
    await mocks.restore()
    mocks.events.push('restored')
  },
  mirrorToNative: () => {
    mocks.events.push('mirror')
  },
  hideSplashScreen: mocks.hideSplashScreen,
}))

vi.mock('../pwa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../pwa')>()),
  registerServiceWorker: mocks.registerServiceWorker,
}))

/** Loads the entry point as a page load does, and waits until the launch screen has been taken down. */
async function loadPage() {
  await import('../main')
  // The first load compiles the whole app.
  await vi.waitFor(() => expect(mocks.hideSplashScreen).toHaveBeenCalled(), { timeout: 10_000 })
}

const { getItem } = Storage.prototype

beforeEach(() => {
  vi.resetModules()
  document.body.innerHTML = '<div id="root"></div>'
  mocks.events.length = 0
  mocks.native = false
  mocks.restore = async () => {}
  // Every store reads its saved state from localStorage the moment its module is imported.
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (key.startsWith('azkar:')) mocks.events.push(`read ${key}`)
    return getItem.call(this, key)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('the entry point', () => {
  it('puts back the native copy of the data before any store reads it, and mirrors from then on', async () => {
    mocks.native = true
    // The web view lost the settings; the native copy still has them, and takes a moment to read.
    mocks.restore = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: { language: 'ar' }, version: 1 }))
    }

    await loadPage()

    const firstRead = mocks.events.findIndex((event) => event.startsWith('read '))
    expect(mocks.events.slice(0, 3)).toEqual(['restore', 'restored', 'mirror'])
    expect(firstRead).toBeGreaterThan(2)
    expect(mocks.events).toContain(`read ${SETTINGS_KEY}`)
    const { useSettings } = await import('../shared/settings')
    expect(useSettings.getState().language).toBe('ar')
  })

  it('starts following the app’s other tabs when the page loads', async () => {
    await loadPage()
    const { useSettings } = await import('../shared/settings')
    expect(useSettings.getState().language).toBe('system')

    // Another tab saves a setting; this page hears of it and takes it over.
    const raw = JSON.stringify({ state: { language: 'ar' }, version: 1 })
    localStorage.setItem(SETTINGS_KEY, raw)
    window.dispatchEvent(
      new StorageEvent('storage', { key: SETTINGS_KEY, oldValue: null, newValue: raw, storageArea: localStorage }),
    )

    expect(useSettings.getState().language).toBe('ar')
  })

  it('takes the launch screen down only once the first screen is on the page', async () => {
    let shown: string | null | undefined
    mocks.hideSplashScreen.mockImplementation(async () => {
      shown = document.getElementById('root')?.textContent
    })
    await loadPage()
    expect(shown).toBe('First screen')
    expect(mocks.hideSplashScreen).toHaveBeenCalledTimes(1)
  })

  it('takes the launch screen down when the app cannot start, and reports why', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.doMock('./start', () => ({ startApp: () => Promise.reject(new Error('broken bundle')) }))
    try {
      await loadPage()
      expect(error).toHaveBeenCalledWith('Azkar could not start', expect.objectContaining({ message: 'broken bundle' }))
    } finally {
      vi.doUnmock('./start')
    }
  })

  it('takes the launch screen down after a while even if starting never finishes', async () => {
    vi.useFakeTimers()
    mocks.restore = () => new Promise(() => {})
    await import('../main')

    await vi.advanceTimersByTimeAsync(7_999)
    expect(mocks.hideSplashScreen).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.hideSplashScreen).toHaveBeenCalledTimes(1)
  })

  it('registers the service worker in a production website only, never inside the app', async () => {
    vi.stubEnv('PROD', true)
    await loadPage()
    expect(mocks.registerServiceWorker).toHaveBeenCalledTimes(1)

    vi.resetModules()
    mocks.hideSplashScreen.mockClear()
    mocks.registerServiceWorker.mockClear()
    mocks.native = true
    await loadPage()
    expect(mocks.registerServiceWorker).not.toHaveBeenCalled()

    vi.resetModules()
    mocks.hideSplashScreen.mockClear()
    mocks.native = false
    vi.stubEnv('PROD', false)
    await loadPage()
    expect(mocks.registerServiceWorker).not.toHaveBeenCalled()
  })
})
