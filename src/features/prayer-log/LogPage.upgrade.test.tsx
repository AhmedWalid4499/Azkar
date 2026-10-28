import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTextFile } from '../../native'
import { useAzkarProgress } from '../azkar'
import { parseCsv } from './csvTesting'
import { LogPage } from './LogPage'
import { PRAYER_LOG_STORAGE_KEY, usePrayerLog } from './store'
import { freezeToday, resetApp } from './test-utils'

vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))
vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveTextFile: vi.fn(async () => true),
}))

const TODAY = '2026-10-11'
/** The azkar feature's storage key, as every version of it has written it. */
const AZKAR_PROGRESS_KEY = 'azkar:azkar-progress'

beforeEach(() => {
  localStorage.clear()
  freezeToday(TODAY, 'Asia/Riyadh')
})

afterEach(() => {
  resetApp()
  localStorage.clear()
})

// What the first version of each store wrote: statuses with no times, and completed sessions
// with per-dhikr counts for the last week only. The tracker has to show all of it, inventing nothing.
describe('the tracker after an upgrade from the first version', () => {
  it('shows every prayer and azkar session the first version kept, with no times made up', async () => {
    localStorage.setItem(
      PRAYER_LOG_STORAGE_KEY,
      JSON.stringify({
        state: {
          entries: {
            '2026-10-09': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'ontime', isha: 'ontime' },
            '2026-10-10': { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime', isha: 'missed' },
          },
        },
        version: 1,
      }),
    )
    localStorage.setItem(
      AZKAR_PROGRESS_KEY,
      JSON.stringify({
        state: {
          days: { '2026-10-10': { evening: { 'ayat-al-kursi': 1 } } },
          history: { '2026-10-09': ['morning', 'evening'], '2026-10-10': ['morning'] },
        },
        version: 1,
      }),
    )
    await usePrayerLog.persist.rehydrate()
    await useAzkarProgress.persist.rehydrate()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LogPage />
      </MemoryRouter>,
    )

    const day = (dateKey: string) =>
      screen.getByRole('grid').querySelector<HTMLButtonElement>(`button[data-date="${dateKey}"]`)!
    expect(day('2026-10-09')).toHaveAccessibleName('Friday, October 9, 2026, 5 of 5 logged, morning and evening azkar done')
    expect(day('2026-10-10')).toHaveAccessibleName('Saturday, October 10, 2026, 5 of 5 logged, morning azkar done')
    expect(screen.getByRole('button', { name: '1 missed prayer to make up' })).toBeInTheDocument()

    const totals = within(screen.getByRole('region', { name: 'All time' }))
    const figure = (label: string) => totals.getByText(label).closest('div')!.querySelector('dd')!
    expect(figure('Prayers prayed')).toHaveTextContent('9Logged in all: 10')
    expect(figure('Azkar sessions completed')).toHaveTextContent('3Morning 2 · evening 1')

    await user.click(day('2026-10-10'))
    const panel = within(screen.getByRole('region', { name: 'Saturday, October 10, 2026' }))
    const isha = panel.getByRole('heading', { level: 4, name: 'Isha' }).closest('li')!
    expect(within(isha).getByRole('radio', { name: 'Missed' })).toBeChecked()
    expect(isha).not.toHaveTextContent('Logged')
    const morning = panel.getByRole('heading', { level: 4, name: 'Morning azkar' }).closest('li')!
    expect(morning).toHaveTextContent('Completed')
    expect(morning).toHaveTextContent(/(\d+) of \1 done/)
    expect(morning).toHaveTextContent('FinishedTime not recorded')
    expect(morning).not.toHaveTextContent('Started')
    const evening = panel.getByRole('heading', { level: 4, name: 'Evening azkar' }).closest('li')!
    expect(evening).toHaveTextContent('In progress')
    expect(evening).toHaveTextContent(/^.*1 of \d+ done.*Recitations1$/)

    await user.click(screen.getByRole('button', { name: 'Export history (CSV)' }))
    const [header = [], ...rows] = parseCsv(vi.mocked(saveTextFile).mock.calls[0]![1].replace(/^﻿/, ''))
    const cell = (dateKey: string, column: string) => rows.find((row) => row[0] === dateKey)?.[header.indexOf(column)]
    expect(rows.map((row) => row[0])).toEqual(['2026-10-09', '2026-10-10'])
    expect(cell('2026-10-09', 'Asr: status')).toBe('Late')
    expect(cell('2026-10-09', 'Asr: logged at')).toBe('')
    expect(cell('2026-10-10', 'Isha: status')).toBe('Missed')
    expect(cell('2026-10-09', 'Evening azkar: status')).toBe('Completed')
    expect(cell('2026-10-09', 'Evening azkar: finished at')).toBe('')
    expect(cell('2026-10-10', 'Evening azkar: status')).toBe('In progress')
    expect(cell('2026-10-10', 'Evening azkar: recitations')).toBe('1')
  })
})
