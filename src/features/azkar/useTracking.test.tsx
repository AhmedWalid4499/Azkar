import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAzkarProgress } from './progressStore'
import { resetStores } from './testing/harness'
import {
  useAzkarCompletionRate,
  useAzkarLifetime,
  useAzkarStreaks,
  useDaySessions,
  useSessionsInRange,
} from './useTracking'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

// The fixture's morning session: tasbih ×3, hamd ×1, takbir ×10. Evening: hamd ×1, tasbih ×3.
const progress = () => useAzkarProgress.getState()

function finishMorning(dateKey: string) {
  for (const id of ['tasbih', 'hamd', 'takbir']) progress().complete(dateKey, 'morning', id)
}

function finishEvening(dateKey: string) {
  for (const id of ['hamd', 'tasbih']) progress().complete(dateKey, 'evening', id)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T08:00:00Z'))
  resetStores()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('tracking hooks', () => {
  it('give a day’s sessions and follow new counts', () => {
    const { result } = renderHook(() => useDaySessions('2026-10-12'))
    expect(result.current).toBeUndefined()
    act(() => finishMorning('2026-10-12'))
    expect(result.current?.morning).toMatchObject({
      completed: true,
      completedAt: Date.parse('2026-10-12T08:00:00Z'),
      recitations: 14,
    })
  })

  it('give the days of a range, and keep the same answer while nothing changes', () => {
    act(() => {
      finishMorning('2026-10-10')
      progress().increment('2026-10-12', 'evening', 'hamd')
    })
    const { result, rerender } = renderHook(() => useSessionsInRange('2026-10-06', '2026-10-12'))
    expect(result.current.map((entry) => entry.dateKey)).toEqual(['2026-10-10', '2026-10-12'])
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('give streaks that follow the night rule of the clock', () => {
    act(() => {
      finishEvening('2026-10-10')
      finishEvening('2026-10-11')
    })
    vi.setSystemTime(new Date('2026-10-13T01:00:00Z'))
    const { result } = renderHook(() => useAzkarStreaks())
    // At 1 am the evening of the 12th is still open, so the run from the 10th stands.
    expect(result.current.evening).toEqual({ current: 2, best: 2 })

    // Read now, the evening azkar count for the 12th.
    act(() => finishEvening('2026-10-12'))
    expect(result.current.evening).toEqual({ current: 3, best: 3 })
  })

  it('give the completion rate over a window', () => {
    act(() => {
      finishMorning('2026-10-10')
      finishEvening('2026-10-10')
      finishMorning('2026-10-11')
    })
    const { result } = renderHook(() => ({ week: useAzkarCompletionRate(7), month: useAzkarCompletionRate(30) }))
    expect(result.current.week.all).toEqual({ completed: 3, due: 4, rate: 0.75 })
    expect(result.current.month.all).toEqual(result.current.week.all)
  })

  it('give lifetime totals that follow every count', () => {
    const { result } = renderHook(() => useAzkarLifetime())
    act(() => {
      finishMorning('2026-10-11')
      finishEvening('2026-10-12')
      progress().decrement('2026-10-12', 'evening', 'tasbih')
    })
    expect(result.current.sessionsCompleted).toEqual({ morning: 1, evening: 0, sleep: 0 })
    expect(result.current.recitations).toBe(17)
    expect(result.current.byDhikr.map(({ id, recitations }) => [id, recitations])).toEqual([
      ['takbir', 10],
      ['tasbih', 5],
      ['hamd', 2],
    ])
  })
})
