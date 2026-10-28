import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AfterPrayerPrompt } from './AfterPrayerPrompt'
import { azkarData } from './data'
import { useAzkarProgress } from './progressStore'
import { CurrentPath } from './testing/CurrentPath'
import { withAfterPrayer } from './testing/fixture'
import { resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

// After Dhuhr: after-once ×1, after-thrice ×3. After Fajr, a third dhikr ×10.
const DAY = '2026-10-12'
const progress = () => useAzkarProgress.getState()

function renderPrompt(prayer: 'fajr' | 'dhuhr' | 'isha', dateKey = DAY) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AfterPrayerPrompt prayer={prayer} dateKey={dateKey} />} />
        <Route path="azkar/*" element={<h1>Reader</h1>} />
      </Routes>
      <CurrentPath />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${DAY}T13:00:00Z`))
  resetStores()
  withAfterPrayer(azkarData)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.afterPrayer
})

describe('after-prayer prompt', () => {
  it('invites the user to read the azkar after the prayer, and leads to its reader', () => {
    renderPrompt('dhuhr')
    expect(screen.getByText('Said after the closing salam of the prayer')).toBeInTheDocument()
    expect(screen.getByText('Start')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Azkar after Dhuhr' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/azkar/after/dhuhr')
  })

  it('shows how far a started reading got', () => {
    progress().completeAfterPrayer(DAY, 'fajr', 'after-once')
    progress().incrementAfterPrayer(DAY, 'fajr', 'after-thrice')
    renderPrompt('fajr')
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '1 of 3 done' })).toHaveAttribute('aria-valuenow', '44')
  })

  it('says when a finished reading was finished', () => {
    progress().completeAfterPrayer(DAY, 'dhuhr', 'after-once')
    progress().completeAfterPrayer(DAY, 'dhuhr', 'after-thrice')
    renderPrompt('dhuhr')
    expect(screen.getByText(/^Done at 1:00\sPM$/)).toBeInTheDocument()
    expect(screen.queryByText('Continue')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('follows the prayer’s own day, not today’s', () => {
    progress().incrementAfterPrayer('2026-10-11', 'isha', 'after-once')
    renderPrompt('isha', '2026-10-11')
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Azkar after Isha' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/azkar/after/isha/2026-10-11')
  })

  it('links to the reader without a date when the prayer’s day is the one it opens anyway', () => {
    // At 1 am the day of last night's Isha is the 11th.
    vi.setSystemTime(new Date('2026-10-12T01:00:00Z'))
    renderPrompt('isha', '2026-10-11')
    expect(screen.getByRole('link', { name: 'Azkar after Isha' })).toHaveAttribute('href', '/azkar/after/isha')
  })

  it('renders nothing until the dataset has after-prayer azkar', () => {
    delete azkarData.afterPrayer
    renderPrompt('fajr')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Start')).not.toBeInTheDocument()
  })

  it('speaks Arabic in the Arabic interface', () => {
    resetStores('ar')
    renderPrompt('fajr')
    expect(screen.getByRole('link', { name: 'أذكار بعد صلاة الفجر' })).toBeInTheDocument()
    expect(screen.getByText('تُقال بعد السلام من الصلاة')).toBeInTheDocument()
  })
})
