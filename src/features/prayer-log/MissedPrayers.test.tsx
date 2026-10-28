import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import { MissedPrayers } from './MissedPrayers'
import { freezeToday, resetApp, seedLog } from './test-utils'
import type { DayLog, LogEntries } from './types'

const TODAY = '2026-10-11'
const ALL_MISSED = Object.fromEntries(PRAYERS.map((prayer) => [prayer, 'missed'])) as DayLog

beforeEach(() => {
  freezeToday(TODAY)
})

afterEach(() => {
  resetApp()
})

describe('MissedPrayers', () => {
  it('stays quick with years of prayers to make up, and still lists every day once opened', async () => {
    // Nearly three years of days with all five prayers missed: 5,000 prayers.
    const entries: LogEntries = {}
    let first = TODAY
    for (let back = 1; back <= 1000; back++) {
      first = shiftDateKey(TODAY, -back)
      entries[first] = ALL_MISSED
    }
    seedLog(entries)
    const onOpenDay = vi.fn()
    const { rerender } = render(<MissedPrayers today={TODAY} onOpenDay={onOpenDay} />)

    // The page renders this on every change and every clock tick; nothing on show depends on the list itself.
    const start = performance.now()
    for (let pass = 0; pass < 5; pass++) rerender(<MissedPrayers today={TODAY} onOpenDay={onOpenDay} />)
    expect(performance.now() - start).toBeLessThan(100)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '5000 missed prayers to make up' }))
    // Read straight from the DOM: a thousand role queries would take seconds in jsdom.
    const days = [...screen.getByRole('dialog').querySelectorAll<HTMLButtonElement>('li > button')]
    expect(days).toHaveLength(1000)
    expect(days[0]).toHaveAttribute('aria-label', 'Monday, January 15, 2024: Fajr, Dhuhr, Asr, Maghrib, Isha')
    expect(days.at(-1)).toHaveAttribute('aria-label', 'Saturday, October 10, 2026: Fajr, Dhuhr, Asr, Maghrib, Isha')

    await user.click(days[0]!)
    expect(onOpenDay).toHaveBeenCalledWith(first)
  }, 15_000)
})
