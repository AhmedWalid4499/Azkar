import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppPlatform } from './platform'

const mocks = vi.hoisted(() => ({
  platform: 'web' as AppPlatform,
  hide: vi.fn(async () => {}),
  setStyle: vi.fn(async (_options: { style: string }) => {}),
  setBackgroundColor: vi.fn(async (_options: { color: string }) => {}),
  addListener: vi.fn(),
  remove: vi.fn(async () => {}),
  exitApp: vi.fn(async () => {}),
  systemBarsStyle: vi.fn(async (_options: { style: string }) => {}),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  SystemBars: { setStyle: mocks.systemBarsStyle },
}))

vi.mock('./platform', () => ({
  appPlatform: () => mocks.platform,
  isNativeApp: () => mocks.platform !== 'web',
}))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: mocks.hide } }))
vi.mock('@capacitor/status-bar', () => ({
  Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
  StatusBar: { setStyle: mocks.setStyle, setBackgroundColor: mocks.setBackgroundColor },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener, exitApp: mocks.exitApp } }))

const { exitNativeApp, hideSplashScreen, onNativeBackButton, setNativeStatusBar } = await import('./index')

beforeEach(() => {
  mocks.platform = 'web'
  mocks.addListener.mockImplementation(async () => ({ remove: mocks.remove }))
})

describe('hideSplashScreen', () => {
  it('hides the launch screen in the app, and does nothing in a browser', async () => {
    await hideSplashScreen()
    expect(mocks.hide).not.toHaveBeenCalled()

    mocks.platform = 'ios'
    await hideSplashScreen()
    expect(mocks.hide).toHaveBeenCalledTimes(1)
  })

  it('never throws', async () => {
    mocks.platform = 'android'
    mocks.hide.mockRejectedValueOnce(new Error('no splash'))
    await expect(hideSplashScreen()).resolves.toBeUndefined()
  })
})

describe('setNativeStatusBar', () => {
  it('gives light text over a dark page and dark text over a light one', async () => {
    mocks.platform = 'ios'
    await setNativeStatusBar('dark', '#0e1513')
    await setNativeStatusBar('light', '#f5f1e8')
    expect(mocks.setStyle.mock.calls.map(([options]) => options.style)).toEqual(['DARK', 'LIGHT'])
    // iOS draws no background of its own behind the bar: the page shows through.
    expect(mocks.setBackgroundColor).not.toHaveBeenCalled()
    expect(mocks.systemBarsStyle).not.toHaveBeenCalled()
  })

  it('also colours the bar on Android', async () => {
    mocks.platform = 'android'
    await setNativeStatusBar('dark', '#0e1513')
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith({ color: '#0e1513' })
  })

  it('keeps the page’s style on Android when the phone is turned, rather than the system’s', async () => {
    // Android's SystemBars puts back the style it was last given on every configuration change.
    mocks.platform = 'android'
    await setNativeStatusBar('dark', '#0e1513')
    await setNativeStatusBar('light', '#f5f1e8')
    expect(mocks.systemBarsStyle.mock.calls.map(([options]) => options.style)).toEqual(['DARK', 'LIGHT'])
  })

  it('does nothing in a browser, and never throws', async () => {
    await setNativeStatusBar('dark', '#0e1513')
    expect(mocks.setStyle).not.toHaveBeenCalled()

    mocks.platform = 'android'
    mocks.setStyle.mockRejectedValueOnce(new Error('not available'))
    await expect(setNativeStatusBar('light')).resolves.toBeUndefined()
  })
})

describe('onNativeBackButton', () => {
  it('hands Android’s back button to the app until stopped', async () => {
    mocks.platform = 'android'
    const handler = vi.fn()
    const stop = onNativeBackButton(handler)

    expect(mocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function))
    const native = mocks.addListener.mock.calls[0]![1] as (event: { canGoBack: boolean }) => void
    native({ canGoBack: true })
    expect(handler).toHaveBeenCalledWith({ canGoBack: true })

    stop()
    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1))
  })

  it('leaves iOS and the browser alone', () => {
    for (const platform of ['ios', 'web'] as const) {
      mocks.platform = platform
      onNativeBackButton(vi.fn())()
      exitNativeApp()
    }
    expect(mocks.addListener).not.toHaveBeenCalled()
    expect(mocks.exitApp).not.toHaveBeenCalled()
  })

  it('closes the app on Android when asked', () => {
    mocks.platform = 'android'
    exitNativeApp()
    expect(mocks.exitApp).toHaveBeenCalledTimes(1)
  })
})
