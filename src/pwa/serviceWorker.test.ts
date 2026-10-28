import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'virtual:pwa-register'

const mocks = vi.hoisted(() => ({ registerSW: vi.fn(), native: false }))
vi.mock('virtual:pwa-register', () => ({ registerSW: mocks.registerSW }))
vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  isNativeApp: () => mocks.native,
}))

interface NodeEvents {
  on: (event: string, listener: (...args: unknown[]) => void) => void
  off: (event: string, listener: (...args: unknown[]) => void) => void
}

/** Stands in for navigator.serviceWorker: jsdom has none. */
class FakeContainer extends EventTarget {
  controller: object | null = null
}

function installContainer(controlled: boolean): FakeContainer {
  const container = new FakeContainer()
  container.controller = controlled ? {} : null
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container })
  return container
}

/** A fresh copy of the module (it keeps its state in module variables), registered against fakes. */
async function setup({ controlled = true }: { controlled?: boolean } = {}) {
  vi.resetModules()
  const container = installContainer(controlled)
  const skipWaiting = vi.fn(async () => {})
  let options: RegisterSWOptions = {}
  mocks.registerSW.mockReset()
  mocks.registerSW.mockImplementation((given: RegisterSWOptions) => {
    options = given
    return skipWaiting
  })
  const sw = await import('./serviceWorker')
  const reload = vi.fn()
  await sw.registerServiceWorker(reload)
  const changeController = () => container.dispatchEvent(new Event('controllerchange'))
  return { ...sw, options: () => options, reload, skipWaiting, changeController }
}

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  mocks.native = false
})

describe('registerServiceWorker', () => {
  it('does nothing in a browser without service workers', async () => {
    vi.resetModules()
    mocks.registerSW.mockReset()
    const { registerServiceWorker, useUpdateStore } = await import('./serviceWorker')
    await registerServiceWorker()
    expect(mocks.registerSW).not.toHaveBeenCalled()
    expect(useUpdateStore.getState().status).toBe('idle')
  })

  it('never registers inside the iOS and Android apps, even where the web view has service workers', async () => {
    vi.resetModules()
    mocks.native = true
    const container = installContainer(false)
    mocks.registerSW.mockReset()
    const { registerServiceWorker, useUpdateStore } = await import('./serviceWorker')
    await registerServiceWorker(vi.fn())

    expect(mocks.registerSW).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    container.dispatchEvent(new Event('controllerchange'))
    expect(useUpdateStore.getState().status).toBe('idle')
  })

  it('keeps the app running when registration cannot start', async () => {
    vi.resetModules()
    installContainer(false)
    mocks.registerSW.mockReset()
    mocks.registerSW.mockImplementation(() => {
      throw new Error('blocked')
    })
    const { registerServiceWorker, useUpdateStore } = await import('./serviceWorker')
    await expect(registerServiceWorker(vi.fn())).resolves.toBeUndefined()
    expect(useUpdateStore.getState().status).toBe('idle')
  })

  it('offers a waiting update without reloading', async () => {
    const { options, reload, skipWaiting, useUpdateStore } = await setup()
    expect(useUpdateStore.getState()).toMatchObject({ status: 'idle', dismissed: false })

    options().onNeedRefresh?.()

    expect(useUpdateStore.getState().status).toBe('ready')
    expect(skipWaiting).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('takes over the reload the plugin would otherwise do in every open tab', async () => {
    const { options, reload } = await setup()
    expect(options().onNeedReload).toBeTypeOf('function')
    options().onNeedReload?.()
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('applyUpdate', () => {
  it('activates the waiting worker and reloads once it has taken over', async () => {
    vi.useFakeTimers()
    const { applyUpdate, changeController, options, reload, skipWaiting, useUpdateStore } = await setup()
    options().onNeedRefresh?.()

    applyUpdate()
    expect(skipWaiting).toHaveBeenCalledTimes(1)
    expect(useUpdateStore.getState().status).toBe('applying')
    expect(reload).not.toHaveBeenCalled()

    changeController()
    expect(reload).toHaveBeenCalledTimes(1)

    // Neither the safety timer nor a second press reloads again.
    applyUpdate()
    vi.advanceTimersByTime(60_000)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('reloads anyway when the worker never reports taking over', async () => {
    vi.useFakeTimers()
    const { applyUpdate, options, reload } = await setup()
    options().onNeedRefresh?.()

    applyUpdate()
    vi.advanceTimersByTime(3_999)
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing while no update is waiting', async () => {
    const { applyUpdate, reload, skipWaiting } = await setup()
    applyUpdate()
    expect(skipWaiting).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('an update accepted in another tab', () => {
  it('is offered here instead of reloading this page', async () => {
    const { applyUpdate, changeController, reload, skipWaiting, useUpdateStore } = await setup()

    changeController()
    expect(reload).not.toHaveBeenCalled()
    expect(useUpdateStore.getState().status).toBe('ready')

    // The new worker is in control already, so Reload is a plain reload.
    applyUpdate()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(skipWaiting).not.toHaveBeenCalled()
  })

  it('is not confused with the first worker claiming a fresh page', async () => {
    const { changeController, reload, useUpdateStore } = await setup({ controlled: false })

    changeController()
    expect(useUpdateStore.getState().status).toBe('idle')
    expect(reload).not.toHaveBeenCalled()

    changeController()
    expect(useUpdateStore.getState().status).toBe('ready')
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('dismissUpdate', () => {
  it('stays dismissed for the visit, even when the update is announced again', async () => {
    const { dismissUpdate, options, reload, useUpdateStore } = await setup()
    options().onNeedRefresh?.()
    dismissUpdate()
    expect(useUpdateStore.getState()).toMatchObject({ status: 'ready', dismissed: true })

    options().onNeedRefresh?.()
    expect(useUpdateStore.getState().dismissed).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('checking for a new version', () => {
  it('asks at most once an hour, when the app comes back to the foreground online', async () => {
    vi.useFakeTimers()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { options } = await setup()
    const update = vi.fn(async () => {})
    options().onRegisteredSW?.('./sw.js', { update } as unknown as ServiceWorkerRegistration)
    const comeBack = () => document.dispatchEvent(new Event('visibilitychange'))

    comeBack()
    expect(update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60 * 60_000)
    visibility.mockReturnValue('hidden')
    comeBack()
    expect(update).not.toHaveBeenCalled()

    visibility.mockReturnValue('visible')
    online.mockReturnValue(false)
    comeBack()
    expect(update).not.toHaveBeenCalled()

    online.mockReturnValue(true)
    comeBack()
    expect(update).toHaveBeenCalledTimes(1)

    comeBack()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('shrugs off a check that fails', async () => {
    // Only the clock is faked, so the real timer below can let a stray rejection surface.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { options, useUpdateStore } = await setup()
    // A plain function: vi.fn() observes the promises it returns, which would hide an unhandled rejection.
    let checks = 0
    const update = () => {
      checks += 1
      return Promise.reject(new TypeError('Failed to fetch'))
    }
    options().onRegisteredSW?.('./sw.js', { update } as unknown as ServiceWorkerRegistration)

    // The app's tsconfig carries no Node types; the test runner is Node all the same.
    const nodeProcess = (globalThis as unknown as { process: NodeEvents }).process
    const unhandled = vi.fn()
    nodeProcess.on('unhandledRejection', unhandled)
    try {
      vi.setSystemTime(Date.now() + 60 * 60_000)
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(checks).toBe(1)
      expect(unhandled).not.toHaveBeenCalled()
      expect(useUpdateStore.getState().status).toBe('idle')
    } finally {
      nodeProcess.off('unhandledRejection', unhandled)
    }
  })
})
