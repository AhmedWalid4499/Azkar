import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canHaptic, haptic, isNativeApp, setNativeKeepAwake } from '../../native'
import { AzkarSettingsSection } from './AzkarSettingsSection'
import { useAzkarProgress } from './progressStore'
import { ADVANCE_DELAY_MS, SETTLE_MS } from './reader/Reader'
import { useAzkarSettings } from './settingsStore'
import { renderRoute, resetStores } from './testing/harness'

// As in the installed iOS or Android app: no navigator.vibrate and no Screen Wake Lock API,
// only the native layer.
vi.mock('../../native', () => ({
  isNativeApp: vi.fn(() => true),
  canHaptic: vi.fn(() => true),
  haptic: vi.fn(),
  setNativeKeepAwake: vi.fn(() => Promise.resolve()),
}))
vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

const DAY = '2026-10-12'
const counter = () => screen.getByRole('button', { name: /^(Tap to count|Done\.)/ })
const tap = (times = 1) => {
  for (let i = 0; i < times; i++) fireEvent.click(counter())
}
const pass = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${DAY}T08:00:00Z`))
  resetStores()
  vi.mocked(haptic).mockClear()
  vi.mocked(setNativeKeepAwake).mockClear()
  vi.mocked(isNativeApp).mockReturnValue(true)
  vi.mocked(canHaptic).mockReturnValue(true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('haptics in the app', () => {
  it('gives the system’s light tick per tap and its success feedback on reaching the count', () => {
    renderRoute('/azkar/morning')
    tap(2)
    expect(vi.mocked(haptic).mock.calls).toEqual([['tick'], ['tick']])
    tap()
    expect(vi.mocked(haptic).mock.calls).toEqual([['tick'], ['tick'], ['done']])
  })

  it('ticks on undo and gives the success feedback for "mark all done"', () => {
    renderRoute('/azkar/morning')
    tap()
    fireEvent.click(screen.getByRole('button', { name: 'Undo one count' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next dhikr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark all done' }))
    expect(vi.mocked(haptic).mock.calls).toEqual([['tick'], ['tick'], ['done']])
  })

  it('stays silent when haptics are off', () => {
    useAzkarSettings.getState().update({ haptics: false })
    renderRoute('/azkar/morning')
    tap(3)
    expect(haptic).not.toHaveBeenCalled()
  })
})

describe('keeping the screen awake in the app', () => {
  it('keeps it on while reading and lets it sleep again on leaving', () => {
    const request = vi.fn()
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const { unmount } = renderRoute('/azkar/morning')
    expect(vi.mocked(setNativeKeepAwake).mock.calls).toEqual([[true]])
    // The app does not also take a browser wake lock.
    expect(request).not.toHaveBeenCalled()

    unmount()
    expect(vi.mocked(setNativeKeepAwake).mock.calls).toEqual([[true], [false]])
  })

  it('lets the screen sleep on the end screen', () => {
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 3, takbir: 10 } } } })
    renderRoute('/azkar/morning')
    tap()
    pass(ADVANCE_DELAY_MS + SETTLE_MS)
    expect(screen.getByRole('heading', { name: 'Morning azkar complete' })).toBeInTheDocument()
    expect(vi.mocked(setNativeKeepAwake).mock.calls).toEqual([[true], [false]])
  })

  it('leaves the screen alone when the setting is off', () => {
    useAzkarSettings.getState().update({ keepAwake: false })
    renderRoute('/azkar/morning')
    tap()
    expect(setNativeKeepAwake).not.toHaveBeenCalled()
  })
})

describe('reader settings in the app', () => {
  it('offers haptics and keep-awake, though the web view has neither vibration nor a wake lock', () => {
    expect('vibrate' in navigator).toBe(false)
    expect('wakeLock' in navigator).toBe(false)
    render(<AzkarSettingsSection />)
    fireEvent.click(screen.getByRole('switch', { name: 'Haptic feedback' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Keep screen awake' }))
    expect(useAzkarSettings.getState()).toMatchObject({ haptics: false, keepAwake: false })
  })

  it('hides the haptics switch where the device has no haptics at all', () => {
    vi.mocked(canHaptic).mockReturnValue(false)
    vi.mocked(isNativeApp).mockReturnValue(false)
    render(<AzkarSettingsSection />)
    expect(screen.queryByRole('switch', { name: 'Haptic feedback' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Keep screen awake' })).not.toBeInTheDocument()
  })
})
