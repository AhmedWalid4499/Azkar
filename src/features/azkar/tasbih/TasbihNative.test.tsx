import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic, isNativeApp, setNativeKeepAwake } from '../../../native'
import { azkarData } from '../data'
import { withTasbih } from '../testing/fixture'
import { renderRoute, resetStores } from '../testing/harness'

// As in the installed iOS or Android app: only the native layer, through src/native.
vi.mock('../../../native', () => ({
  isNativeApp: vi.fn(() => true),
  canHaptic: vi.fn(() => true),
  haptic: vi.fn(),
  setNativeKeepAwake: vi.fn(() => Promise.resolve()),
}))
vi.mock('../data', async () => (await import('../testing/fixture')).createDataModule())
vi.mock('../../prayer-times', () => ({ usePrayerDay: () => null }))

const counter = () => screen.getByRole('button', { name: /^Tap to count/ })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T14:00:00Z'))
  resetStores()
  withTasbih(azkarData)
  vi.mocked(haptic).mockClear()
  vi.mocked(setNativeKeepAwake).mockClear()
  vi.mocked(isNativeApp).mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.tasbih
})

describe('the tasbih counter in the app', () => {
  it('gives the system’s light tick per count, and its success feedback at the target', () => {
    renderRoute('/azkar/tasbih')
    for (let i = 0; i < 33; i++) fireEvent.click(counter())
    const calls = vi.mocked(haptic).mock.calls.map(([kind]) => kind)
    expect(calls.slice(0, 32).every((kind) => kind === 'tick')).toBe(true)
    expect(calls[32]).toBe('done')
    fireEvent.click(screen.getByRole('button', { name: 'Undo one count' }))
    expect(vi.mocked(haptic)).toHaveBeenLastCalledWith('tick')
  })

  it('keeps the screen on while the counter is open', () => {
    const { unmount } = renderRoute('/azkar/tasbih')
    expect(setNativeKeepAwake).toHaveBeenCalledExactlyOnceWith(true)
    unmount()
    expect(setNativeKeepAwake).toHaveBeenLastCalledWith(false)
  })
})
