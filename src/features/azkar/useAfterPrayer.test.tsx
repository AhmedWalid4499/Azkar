import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { azkarData } from './data'
import { useAzkarProgress } from './progressStore'
import { withAfterPrayer, withTasbih } from './testing/fixture'
import { resetStores } from './testing/harness'
import {
  useAfterPrayerCompletionRate,
  useAfterPrayerDateKey,
  useAfterPrayerInRange,
  useAfterPrayerLifetime,
  useAfterPrayerSessions,
  useAfterPrayerStanding,
  useAfterPrayerStreaks,
} from './useAfterPrayer'
import { useTasbihDateKey, useTasbihDay, useTasbihInRange, useTasbihLifetime } from './useTasbih'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

// After Dhuhr, Asr and Isha: after-once ×1, after-thrice ×3. After Fajr and Maghrib a third, ×10 and ×7.
const progress = () => useAzkarProgress.getState()
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

function finish(dateKey: string, prayer: (typeof PRAYERS)[number]) {
  for (const id of ['after-once', 'after-thrice', 'after-dawn-dusk']) progress().completeAfterPrayer(dateKey, prayer, id)
}

function finishAll(dateKey: string) {
  for (const prayer of PRAYERS) finish(dateKey, prayer)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T13:00:00Z'))
  resetStores()
  withAfterPrayer(azkarData)
  withTasbih(azkarData)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.afterPrayer
  delete azkarData.tasbih
})

describe('after-prayer hooks', () => {
  it('give the day the clock files after-prayer azkar under: yesterday until Fajr', () => {
    expect(renderHook(() => useAfterPrayerDateKey()).result.current).toBe('2026-10-12')
    vi.setSystemTime(new Date('2026-10-13T02:00:00Z'))
    expect(renderHook(() => useAfterPrayerDateKey()).result.current).toBe('2026-10-12')
  })

  it('give a day’s records and follow new counts', () => {
    const { result } = renderHook(() => useAfterPrayerSessions('2026-10-12'))
    expect(result.current).toBeUndefined()
    act(() => finish('2026-10-12', 'dhuhr'))
    expect(result.current?.dhuhr).toMatchObject({
      completed: true,
      completedAt: Date.parse('2026-10-12T13:00:00Z'),
      recitations: 4,
    })
  })

  it('give the days of a range, and keep the same answer while nothing changes', () => {
    act(() => {
      finish('2026-10-08', 'fajr')
      progress().incrementAfterPrayer('2026-10-11', 'isha', 'after-once')
    })
    const { result, rerender } = renderHook(() => useAfterPrayerInRange('2026-10-09', '2026-10-12'))
    expect(result.current.map((entry) => entry.dateKey)).toEqual(['2026-10-11'])
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('give streaks and rates as of now', () => {
    act(() => {
      finishAll('2026-10-10')
      finishAll('2026-10-11')
      finish('2026-10-12', 'fajr')
    })
    const streaks = renderHook(() => useAfterPrayerStreaks()).result
    expect(streaks.current.all).toEqual({ current: 2, best: 2 })
    expect(streaks.current.byPrayer.fajr).toEqual({ current: 3, best: 3 })
    const rates = renderHook(() => useAfterPrayerCompletionRate(7)).result
    expect(rates.current.all).toEqual({ completed: 11, due: 11, rate: 1 })
  })

  it('give the lifetime totals', () => {
    act(() => {
      finish('2026-10-11', 'fajr')
      finish('2026-10-12', 'fajr')
    })
    const { result } = renderHook(() => useAfterPrayerLifetime())
    expect(result.current.completed.fajr).toBe(2)
    expect(result.current.recitations).toBe(28)
  })

  it('give where one prayer’s azkar stand, a completion surviving "Start over"', () => {
    const { result } = renderHook(() => useAfterPrayerStanding('fajr', '2026-10-12'))
    expect(result.current).toEqual({ status: 'idle', done: 0, total: 3, fraction: 0, completedAt: undefined })
    act(() => finish('2026-10-12', 'fajr'))
    act(() => progress().resetAfterPrayer('2026-10-12', 'fajr'))
    expect(result.current).toMatchObject({ status: 'complete', done: 3, completedAt: Date.parse('2026-10-12T13:00:00Z') })
  })
})

describe('tasbih hooks', () => {
  it('give the day, the day’s counts, a range and the lifetime totals', () => {
    act(() => {
      progress().countTasbih('2026-10-10', 'preset-one')
      progress().countTasbih('2026-10-12', 'preset-two')
      progress().countTasbih('2026-10-12', null)
    })
    expect(renderHook(() => useTasbihDateKey()).result.current).toBe('2026-10-12')
    expect(renderHook(() => useTasbihDay('2026-10-12')).result.current).toMatchObject({
      presets: { 'preset-two': { count: 1 } },
      free: { count: 1 },
    })
    const range = renderHook(() => useTasbihInRange('2026-10-11', '2026-10-12')).result
    expect(range.current.map((entry) => [entry.dateKey, entry.count])).toEqual([['2026-10-12', 2]])
    expect(renderHook(() => useTasbihLifetime()).result.current).toMatchObject({ count: 3, free: 1, days: 2 })
  })
})
