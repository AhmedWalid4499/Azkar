import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AzkarTodayCards } from './AzkarTodayCards'
import { azkarData } from './data'
import { useAzkarProgress } from './progressStore'
import { renderInRouter, resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

const DAY = '2026-10-12'

const at = (time: string) => vi.setSystemTime(new Date(`${DAY}T${time}:00Z`))
const card = (name: string) => screen.getByRole('link', { name }).closest('article')!

beforeEach(() => {
  vi.useFakeTimers()
  at('08:00')
  resetStores()
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.collections.sleep
})

describe('AzkarTodayCards', () => {
  it('links to the morning and evening sessions, and leaves bedtime out', () => {
    azkarData.collections.sleep = ['hamd']
    renderInRouter(<AzkarTodayCards />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Morning azkar' })).toHaveAttribute('href', '/azkar/morning')
    expect(screen.getByRole('link', { name: 'Evening azkar' })).toHaveAttribute('href', '/azkar/evening')
  })

  it('shows each session’s progress and state', () => {
    useAzkarProgress.setState({
      days: { [DAY]: { morning: { tasbih: 3 }, evening: { hamd: 1, tasbih: 3 } } },
    })
    renderInRouter(<AzkarTodayCards />)

    const morning = within(card('Morning azkar'))
    expect(morning.getByText('Continue')).toBeInTheDocument()
    expect(morning.getByRole('progressbar', { name: '1 of 3 done' })).toHaveAttribute('aria-valuenow', '33')

    const evening = within(card('Evening azkar'))
    expect(evening.getByText('Completed')).toBeInTheDocument()
    expect(evening.getByRole('progressbar', { name: '2 of 2 done' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('starts each day at zero', () => {
    useAzkarProgress.setState({ days: { '2026-10-11': { morning: { tasbih: 3, hamd: 1, takbir: 10 } } } })
    renderInRouter(<AzkarTodayCards />)
    expect(within(card('Morning azkar')).getByText('Start')).toBeInTheDocument()
  })

  it('marks the session whose time it is, in words as well as in colour', () => {
    at('08:00')
    const { unmount } = renderInRouter(<AzkarTodayCards />)
    expect(within(card('Morning azkar')).getByText('Now')).toBeInTheDocument()
    expect(within(card('Evening azkar')).queryByText('Now')).not.toBeInTheDocument()
    unmount()

    at('13:00')
    const midday = renderInRouter(<AzkarTodayCards />)
    expect(screen.queryByText('Now')).not.toBeInTheDocument()
    midday.unmount()

    at('18:00')
    renderInRouter(<AzkarTodayCards />)
    expect(within(card('Evening azkar')).getByText('Now')).toBeInTheDocument()
    expect(within(card('Morning azkar')).queryByText('Now')).not.toBeInTheDocument()
  })

  it('is written in Arabic in the Arabic interface', () => {
    resetStores('ar')
    renderInRouter(<AzkarTodayCards />)
    expect(screen.getByRole('link', { name: 'أذكار الصباح' })).toBeInTheDocument()
    expect(within(card('أذكار الصباح')).getByText('الآن')).toBeInTheDocument()
    expect(within(card('أذكار المساء')).getByRole('progressbar', { name: 'اكتمل ٠ من ٢' })).toBeInTheDocument()
  })
})
