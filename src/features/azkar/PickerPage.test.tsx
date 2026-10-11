import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrayerDay } from '../../shared/types'
import { usePrayerDay } from '../prayer-times'
import { azkarData } from './data'
import { useAzkarProgress } from './progressStore'
import { renderRoute, resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: vi.fn(() => null) }))

// The fixture's morning session has three azkar (tasbih ×3, hamd ×1, takbir ×10), the evening two.
const DAY = '2026-10-12'

const at = (time: string) => vi.setSystemTime(new Date(`${DAY}T${time}:00Z`))
const card = (name: RegExp) => screen.getByRole('link', { name }).closest('article')!

beforeEach(() => {
  vi.useFakeTimers()
  at('08:00')
  resetStores()
  vi.mocked(usePrayerDay).mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.collections.sleep
})

describe('session picker', () => {
  it('offers one card per session the dataset provides', () => {
    renderRoute('/azkar')
    expect(screen.getByRole('heading', { level: 1, name: 'Azkar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Morning azkar/ })).toHaveAttribute('href', '/azkar/morning')
    expect(screen.getByRole('link', { name: /Evening azkar/ })).toHaveAttribute('href', '/azkar/evening')
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('adds the bedtime session when there is one', () => {
    azkarData.collections.sleep = ['hamd']
    renderRoute('/azkar')
    expect(screen.getByRole('link', { name: /Before sleep/ })).toHaveAttribute('href', '/azkar/sleep')
    expect(within(card(/Before sleep/)).getByText('1 dhikr')).toBeInTheDocument()
  })

  it('shows each title in Arabic and in translation', () => {
    renderRoute('/azkar')
    const arabic = within(card(/Morning azkar/)).getByText('أذكار الصباح')
    expect(arabic).toHaveAttribute('lang', 'ar')
    expect(within(card(/Evening azkar/)).getByText('أذكار المساء')).toBeInTheDocument()
  })

  it('shows the Arabic title once in the Arabic interface, with Arabic plurals', () => {
    resetStores('ar')
    renderRoute('/azkar')
    expect(screen.getAllByText('أذكار الصباح')).toHaveLength(1)
    expect(within(card(/أذكار الصباح/)).getByText('٣ أذكار')).toBeInTheDocument()
    expect(within(card(/أذكار المساء/)).getByText('ذِكران')).toBeInTheDocument()
  })

  it('shows the count of azkar, today’s progress and where the session stands', () => {
    useAzkarProgress.setState({
      days: { [DAY]: { morning: { tasbih: 3, takbir: 5 }, evening: { hamd: 1, tasbih: 3 } } },
    })
    renderRoute('/azkar')

    const morning = within(card(/Morning azkar/))
    expect(morning.getByText('3 azkar')).toBeInTheDocument()
    expect(morning.getByText('Continue')).toBeInTheDocument()
    const bar = morning.getByRole('progressbar', { name: '1 of 3 done' })
    expect(bar).toHaveAttribute('aria-valuenow', '50') // one done plus half of the ×10

    const evening = within(card(/Evening azkar/))
    expect(evening.getByText('Completed')).toBeInTheDocument()
    expect(evening.getByRole('progressbar', { name: '2 of 2 done' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('invites a start when nothing is counted today', () => {
    useAzkarProgress.setState({ days: { '2026-10-11': { morning: { tasbih: 3 } } } })
    renderRoute('/azkar')
    expect(within(card(/Morning azkar/)).getByText('Start')).toBeInTheDocument()
    expect(within(card(/Morning azkar/)).getByRole('progressbar', { name: '0 of 3 done' })).toBeInTheDocument()
  })
})

describe('recommended now', () => {
  const recommended = (name: RegExp) => within(card(name)).queryByText('Recommended now')

  it('marks the morning session in the morning', () => {
    at('08:00')
    renderRoute('/azkar')
    expect(recommended(/Morning azkar/)).toBeInTheDocument()
    expect(recommended(/Evening azkar/)).not.toBeInTheDocument()
  })

  it('marks neither between Dhuhr and Asr', () => {
    at('13:00')
    renderRoute('/azkar')
    expect(screen.queryByText('Recommended now')).not.toBeInTheDocument()
  })

  it('marks the evening session from Asr and through the night', () => {
    at('20:00')
    const { unmount } = renderRoute('/azkar')
    expect(recommended(/Evening azkar/)).toBeInTheDocument()
    expect(recommended(/Morning azkar/)).not.toBeInTheDocument()
    unmount()

    at('02:00')
    renderRoute('/azkar')
    expect(recommended(/Evening azkar/)).toBeInTheDocument()
  })

  it('goes by the real prayer times once a location provides them', () => {
    const prayerDay: PrayerDay = {
      dateKey: DAY,
      timeZone: 'UTC',
      times: {
        fajr: new Date(`${DAY}T05:30:00Z`),
        sunrise: new Date(`${DAY}T06:45:00Z`),
        dhuhr: new Date(`${DAY}T12:10:00Z`),
        asr: new Date(`${DAY}T15:20:00Z`),
        maghrib: new Date(`${DAY}T17:40:00Z`),
        isha: new Date(`${DAY}T19:00:00Z`),
      },
    }
    vi.mocked(usePrayerDay).mockReturnValue(prayerDay)

    at('05:00') // after the 04:00 stand-in, but Fajr here is not until 05:30
    const { unmount } = renderRoute('/azkar')
    expect(recommended(/Evening azkar/)).toBeInTheDocument()
    unmount()

    at('15:10') // after the 15:00 stand-in, but Asr here is not until 15:20
    renderRoute('/azkar')
    expect(screen.queryByText('Recommended now')).not.toBeInTheDocument()
  })

  it('never recommends the bedtime session by the clock', () => {
    azkarData.collections.sleep = ['hamd']
    at('23:00')
    renderRoute('/azkar')
    expect(recommended(/Before sleep/)).not.toBeInTheDocument()
    expect(recommended(/Evening azkar/)).toBeInTheDocument()
  })
})

describe('after midnight', () => {
  it('still shows last evening’s session, and a fresh morning one', () => {
    useAzkarProgress.setState({
      days: { '2026-10-11': { morning: { tasbih: 3, hamd: 1, takbir: 10 }, evening: { hamd: 1 } } },
    })
    at('01:00')
    renderRoute('/azkar')
    expect(within(card(/Evening azkar/)).getByText('Continue')).toBeInTheDocument()
    expect(within(card(/Evening azkar/)).getByRole('progressbar', { name: '1 of 2 done' })).toBeInTheDocument()
    expect(within(card(/Morning azkar/)).getByText('Start')).toBeInTheDocument()
  })
})
