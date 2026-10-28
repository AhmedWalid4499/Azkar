import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { azkarData } from '../data'
import { useAzkarProgress } from '../progressStore'
import { afterDawnAndDusk, afterOnce, afterThrice, withAfterPrayer } from '../testing/fixture'
import { renderRoute, resetStores } from '../testing/harness'
import { ADVANCE_DELAY_MS, SETTLE_MS } from './Reader'

vi.mock('../data', async () => (await import('../testing/fixture')).createDataModule())
vi.mock('../../prayer-times', () => ({ usePrayerDay: () => null }))

// After Fajr: after-once ×1, after-thrice ×3, after-dawn-dusk ×10. After Maghrib the last is ×7.
// After Dhuhr, Asr and Isha: after-once ×1, after-thrice ×3.
const DAY = '2026-10-12'
const progress = () => useAzkarProgress.getState()
const counter = () => screen.getByRole('button', { name: /^(Tap to count|Done\.)/ })
const path = () => screen.getByTestId('path').textContent
const at = (time: string, day = DAY) => vi.setSystemTime(new Date(`${day}T${time}:00Z`))

function tap(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(counter())
}

function settle() {
  act(() => {
    vi.advanceTimersByTime(ADVANCE_DELAY_MS + SETTLE_MS)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  at('13:00')
  resetStores()
  withAfterPrayer(azkarData)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.afterPrayer
})

describe('the reader of one prayer', () => {
  it('names the prayer and shows that prayer’s azkar', () => {
    renderRoute('/azkar/after/fajr')
    expect(screen.getByRole('heading', { level: 1, name: 'Azkar after Fajr' })).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByText(afterOnce.arabic)).toHaveAttribute('lang', 'ar')
  })

  it('has only the azkar said after that prayer', () => {
    renderRoute('/azkar/after/dhuhr')
    expect(screen.getByRole('heading', { level: 1, name: 'Azkar after Dhuhr' })).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('counts each dhikr to that prayer’s own number', () => {
    renderRoute('/azkar/after/maghrib')
    tap() // after-once ×1
    settle()
    tap(3) // after-thrice ×3
    settle()
    expect(screen.getByText(afterDawnAndDusk.arabic)).toBeInTheDocument()
    expect(counter()).toHaveTextContent('0 / 7')
    tap(7)
    expect(progress().afterPrayer.days[DAY]?.maghrib).toEqual({ 'after-once': 1, 'after-thrice': 3, 'after-dawn-dusk': 7 })
  })

  it('files its counts under the prayer and the day, with a record of the reading', () => {
    renderRoute('/azkar/after/asr')
    tap()
    settle()
    tap(2)
    expect(progress().afterPrayer.days).toEqual({ [DAY]: { asr: { 'after-once': 1, 'after-thrice': 2 } } })
    expect(progress().afterPrayer.sessions[DAY]?.asr).toMatchObject({
      startedAt: Date.parse(`${DAY}T13:00:00Z`),
      completed: false,
      done: 1,
      total: 2,
      recitations: 3,
    })
    expect(progress().days).toEqual({})
  })

  it('ends with the prayer’s own completion screen, and records the completion', () => {
    renderRoute('/azkar/after/dhuhr')
    tap()
    settle()
    tap(3)
    settle()
    expect(screen.getByRole('heading', { level: 1, name: 'Azkar after Dhuhr complete' })).toBeInTheDocument()
    expect(progress().afterPrayer.sessions[DAY]?.dhuhr).toMatchObject({ completed: true, recitations: 4 })
  })

  it('resumes where it was left', () => {
    useAzkarProgress.getState().completeAfterPrayer(DAY, 'fajr', 'after-once')
    renderRoute('/azkar/after/fajr')
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(screen.getByText(afterThrice.arabic)).toBeInTheDocument()
  })

  it('names the prayer in Arabic in the Arabic interface', () => {
    resetStores('ar')
    renderRoute('/azkar/after/isha')
    expect(screen.getByRole('heading', { level: 1, name: 'أذكار بعد صلاة العشاء' })).toBeInTheDocument()
  })
})

describe('which day it reads', () => {
  it('files Isha’s azkar read after midnight under the evening before', () => {
    at('01:00', '2026-10-13')
    renderRoute('/azkar/after/isha')
    tap()
    expect(progress().afterPrayer.days).toEqual({ [DAY]: { isha: { 'after-once': 1 } } })
    // It is the night's own day, so no date is shown.
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('reads a given day of the past, and says which', () => {
    renderRoute('/azkar/after/fajr/2026-10-10')
    expect(screen.getByText(/^Saturday, October 10 · 1 of 3$/)).toBeInTheDocument()
    tap()
    expect(progress().afterPrayer.days).toEqual({ '2026-10-10': { fajr: { 'after-once': 1 } } })
  })

  it('reads today without saying so when the address names today', () => {
    renderRoute(`/azkar/after/fajr/${DAY}`)
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('turns a day still to come into the prayer’s own reader', () => {
    renderRoute('/azkar/after/fajr/2026-10-13')
    expect(path()).toBe('/azkar/after/fajr')
  })

  it('turns an impossible date into the prayer’s own reader', () => {
    renderRoute('/azkar/after/fajr/2026-02-30')
    expect(path()).toBe('/azkar/after/fajr')
  })
})

describe('routing', () => {
  it('sends an unknown prayer back to the picker', () => {
    renderRoute('/azkar/after/sunrise')
    expect(path()).toBe('/azkar')
  })

  it('sends every prayer back to the picker until the dataset has after-prayer azkar', () => {
    delete azkarData.afterPrayer
    renderRoute('/azkar/after/fajr')
    expect(path()).toBe('/azkar')
    expect(screen.getByRole('heading', { level: 1, name: 'Azkar' })).toBeInTheDocument()
  })

  it('sends "after" on its own back to the picker', () => {
    renderRoute('/azkar/after')
    expect(path()).toBe('/azkar')
  })
})
