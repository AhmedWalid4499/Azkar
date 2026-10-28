import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AzkarTodayCards } from './AzkarTodayCards'
import { azkarData, availableCollections } from './data'
import mood from './mood.module.css'
import { AZKAR_PROGRESS_STORAGE_KEY, useAzkarProgress } from './progressStore'
import { ADVANCE_DELAY_MS, SETTLE_MS } from './reader/Reader'
import { renderRoute, resetStores } from './testing/harness'
import { computeSleepStreak, lifetimeTotals, sessionsInRange, sleepCompletionRate } from './tracking'
import { useDaySessions, useSleepCompletionRate, useSleepStreak } from './useTracking'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

// Bedtime, once the dataset has it: hamd ×1, then tasbih ×3.
const DAY = '2026-10-12'
const progress = () => useAzkarProgress.getState()
const counter = () => screen.getByRole('button', { name: /^(Tap to count|Done\.)/ })
const at = (time: string, day = DAY) => vi.setSystemTime(new Date(`${day}T${time}:00Z`))
const card = () => screen.getByRole('link', { name: /Before sleep/ }).closest('article')!

function readAll() {
  fireEvent.click(counter())
  act(() => {
    vi.advanceTimersByTime(ADVANCE_DELAY_MS + SETTLE_MS)
  })
  for (let i = 0; i < 3; i++) fireEvent.click(counter())
  act(() => {
    vi.advanceTimersByTime(ADVANCE_DELAY_MS + SETTLE_MS)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  at('22:30')
  resetStores()
  azkarData.collections.sleep = ['hamd', 'tasbih']
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.collections.sleep
})

describe('before-sleep azkar, once the dataset has them', () => {
  it('are a session of their own, after the morning and the evening', () => {
    expect(availableCollections()).toEqual(['morning', 'evening', 'sleep'])
    delete azkarData.collections.sleep
    expect(availableCollections()).toEqual(['morning', 'evening'])
  })

  it('get a picker card in the night’s colours, leading to their reader', () => {
    renderRoute('/azkar')
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Before sleep/ })).toHaveAttribute('href', '/azkar/sleep')
    expect(within(card()).getByText('أذكار النوم')).toHaveAttribute('lang', 'ar')
    expect(within(card()).getByText('2 azkar')).toBeInTheDocument()
    expect(mood.sleep).toBeTruthy()
    expect(card()).toHaveClass(mood.sleep!)
    expect(card()).not.toHaveClass(mood.evening!)
  })

  it('are read in the reader and recorded, with their own end screen', () => {
    renderRoute('/azkar/sleep')
    expect(screen.getByRole('heading', { level: 1, name: 'Before sleep' })).toBeInTheDocument()
    readAll()
    expect(screen.getByRole('heading', { level: 1, name: 'Bedtime azkar complete' })).toBeInTheDocument()
    expect(progress().days[DAY]?.sleep).toEqual({ hamd: 1, tasbih: 3 })
    // The second dhikr was counted once the reader had moved on to it.
    const finished = Date.parse(`${DAY}T22:30:00Z`) + ADVANCE_DELAY_MS + SETTLE_MS
    expect(progress().sessions[DAY]?.sleep).toEqual({
      startedAt: Date.parse(`${DAY}T22:30:00Z`),
      lastAt: finished,
      completedAt: finished,
      completed: true,
      done: 2,
      total: 2,
      recitations: 4,
    })
  })

  it('read after midnight count for the night before, until Fajr', () => {
    at('01:15', '2026-10-13')
    renderRoute('/azkar/sleep')
    fireEvent.click(counter())
    expect(progress().days).toEqual({ [DAY]: { sleep: { hamd: 1 } } })
    expect(progress().sessions[DAY]?.sleep?.startedAt).toBe(Date.parse('2026-10-13T01:15:00Z'))
  })

  it('show last night’s progress on the picker until Fajr, and a fresh start after it', () => {
    progress().complete(DAY, 'sleep', 'hamd')
    at('02:00', '2026-10-13')
    const { unmount } = renderRoute('/azkar')
    expect(within(card()).getByText('Continue')).toBeInTheDocument()
    expect(within(card()).getByRole('progressbar', { name: '1 of 2 done' })).toBeInTheDocument()
    unmount()

    at('06:00', '2026-10-13')
    renderRoute('/azkar')
    expect(within(card()).getByText('Start')).toBeInTheDocument()
  })

  it('are never recommended by the clock', () => {
    at('23:30')
    renderRoute('/azkar')
    expect(within(card()).queryByText('Recommended now')).not.toBeInTheDocument()
  })

  it('reach the tracker: the day’s sessions, a range and the lifetime totals', () => {
    progress().complete(DAY, 'sleep', 'hamd')
    progress().complete(DAY, 'sleep', 'tasbih')
    const { result } = renderHook(() => useDaySessions(DAY))
    expect(result.current?.sleep).toMatchObject({ completed: true, recitations: 4 })
    expect(sessionsInRange(progress().sessions, DAY, DAY)[0]?.sessions.sleep?.completed).toBe(true)
    expect(lifetimeTotals(progress()).sessionsCompleted).toEqual({ morning: 0, evening: 0, sleep: 1 })
    expect(lifetimeTotals(progress()).recitations).toBe(4)
  })

  it('have a streak and a rate of their own, by the night rule, measured from the first night read', () => {
    const done = { completed: true, done: 2, total: 2, recitations: 4 }
    const nights = { '2026-10-09': { sleep: done }, '2026-10-10': { sleep: done }, '2026-10-11': { sleep: done } }
    expect(computeSleepStreak({}, DAY, 'evening')).toEqual({ current: 0, best: 0 })
    // Tonight is not over, so it neither breaks the run nor adds to it.
    expect(computeSleepStreak(nights, DAY, 'evening')).toEqual({ current: 3, best: 3 })
    // At 1 am on the 13th, the 12th is still tonight.
    expect(computeSleepStreak(nights, '2026-10-13', 'beforeDawn')).toEqual({ current: 3, best: 3 })
    expect(computeSleepStreak(nights, '2026-10-13', 'morning')).toEqual({ current: 0, best: 3 })

    expect(sleepCompletionRate({}, DAY, 'evening', 7)).toEqual({ completed: 0, due: 0, rate: null })
    expect(sleepCompletionRate(nights, DAY, 'evening', 7)).toEqual({ completed: 3, due: 3, rate: 1 })
    expect(sleepCompletionRate({ ...nights, '2026-10-10': {} }, DAY, 'evening', 7)).toEqual({
      completed: 2,
      due: 3,
      rate: 2 / 3,
    })
    // The morning and evening rates do not count bedtime at all.
    expect(lifetimeTotals({ sessions: nights, totals: {}, totalRecitations: 0 }).sessionsCompleted.sleep).toBe(3)
  })

  it('give their streak and rate through hooks that follow the clock', () => {
    progress().complete('2026-10-11', 'sleep', 'hamd')
    progress().complete('2026-10-11', 'sleep', 'tasbih')
    expect(renderHook(() => useSleepStreak()).result.current).toEqual({ current: 1, best: 1 })
    expect(renderHook(() => useSleepCompletionRate(7)).result.current).toEqual({ completed: 1, due: 1, rate: 1 })
  })

  it('are kept through saving and loading', async () => {
    progress().complete(DAY, 'sleep', 'hamd')
    const raw = localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!
    resetStores()
    localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, raw)
    await useAzkarProgress.persist.rehydrate()
    expect(progress().days[DAY]?.sleep).toEqual({ hamd: 1 })
    expect(progress().sessions[DAY]?.sleep).toMatchObject({ done: 1, total: 2 })
  })

  it('stay off the Today page, which keeps to the morning and the evening', () => {
    render(
      <MemoryRouter>
        <AzkarTodayCards />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /Before sleep/ })).not.toBeInTheDocument()
  })
})
