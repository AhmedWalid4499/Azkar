import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DateKey } from '../../shared/types'
import { usePrayerDay } from '../prayer-times'
import { FastingToday } from './FastingToday'
import { fakePrayerDay, freezeToday, resetFasting, setSettings } from './test-utils'

vi.mock('../prayer-times', () => ({ usePrayerDay: vi.fn() }))

beforeEach(() => {
  vi.mocked(usePrayerDay).mockImplementation((dateKey?: DateKey) => (dateKey ? fakePrayerDay(dateKey, {}, 'UTC') : null))
})

afterEach(() => {
  resetFasting()
})

function renderToday(today: DateKey, given?: DateKey) {
  freezeToday(today)
  setSettings()
  return render(<FastingToday today={given} />)
}

describe('FastingToday', () => {
  it('shows Ramadan mode in Ramadan', () => {
    renderToday('2026-03-02')
    expect(screen.getByRole('region', { name: 'Day 13 of Ramadan' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'A sunnah fast today' })).toBeNull()
  })

  it('shows the recommended fast on another day', () => {
    renderToday('2026-11-02')
    expect(screen.getByRole('region', { name: 'A sunnah fast today' })).toBeInTheDocument()
  })

  it('shows nothing on an ordinary day', () => {
    expect(renderToday('2026-11-03').container).toBeEmptyDOMElement()
  })

  it('goes by the day it is given', () => {
    renderToday('2026-11-03', '2026-03-02')
    expect(screen.getByRole('region', { name: 'Day 13 of Ramadan' })).toBeInTheDocument()
  })
})
