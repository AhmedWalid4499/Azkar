import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../shared/settings'
import { AzkarTodayCards } from './AzkarTodayCards'
import { azkarData } from './data'
import { useAzkarProgress } from './progressStore'
import type { SessionRecord } from './progressStore'
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

    // A session under way says how far it got (it used to say only "Continue").
    const morning = within(card('Morning azkar'))
    expect(morning.getByText('1 of 3 done')).toBeInTheDocument()
    expect(morning.queryByText('Continue')).not.toBeInTheDocument()
    expect(morning.getByRole('progressbar', { name: '1 of 3 done' })).toHaveAttribute('aria-valuenow', '33')
    // Said once to a screen reader, by the ring: the visible line repeats it.
    expect(morning.getByText('1 of 3 done').closest('p')).toHaveAttribute('aria-hidden', 'true')

    const evening = within(card('Evening azkar'))
    // A completion says something the ring does not, so it is read out.
    expect(evening.getByText('Completed').closest('p')).not.toHaveAttribute('aria-hidden')
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

describe('what was done today', () => {
  const at0612 = Date.parse(`${DAY}T06:12:00Z`)
  const finished = (completedAt?: number): SessionRecord => ({
    startedAt: at0612 - 15 * 60_000,
    lastAt: completedAt ?? at0612,
    ...(completedAt === undefined ? {} : { completedAt }),
    completed: true,
    done: 3,
    total: 3,
    recitations: 14,
  })
  const state = (name: string) => card(name).querySelector('p')

  it('says when a finished session was finished', () => {
    useAzkarProgress.setState({
      days: { [DAY]: { morning: { tasbih: 3, hamd: 1, takbir: 10 } } },
      sessions: { [DAY]: { morning: finished(at0612) } },
    })
    renderInRouter(<AzkarTodayCards />)
    expect(state('Morning azkar')).toHaveTextContent(/^Done at 6:12\sAM$/)
    expect(within(card('Morning azkar')).getByRole('progressbar', { name: '3 of 3 done' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })

  it('follows the 24-hour setting and the saved location’s time zone', () => {
    resetStores('en', 'Asia/Riyadh') // UTC+3
    useSettings.setState({ timeFormat: '24h' })
    useAzkarProgress.setState({ sessions: { [DAY]: { morning: finished(at0612) } } })
    renderInRouter(<AzkarTodayCards />)
    expect(state('Morning azkar')).toHaveTextContent(/^Done at 09:12$/)
  })

  it('says only "Completed" when the time is not known, as for a day carried over from version 1', () => {
    useAzkarProgress.setState({ sessions: { [DAY]: { morning: finished() } } })
    renderInRouter(<AzkarTodayCards />)
    expect(state('Morning azkar')).toHaveTextContent(/^Completed$/)
  })

  it('keeps showing the completion after "Start over", while a second reading is under way', () => {
    useAzkarProgress.setState({ sessions: { [DAY]: { morning: { ...finished(at0612), done: 0 } } } })
    const { unmount } = renderInRouter(<AzkarTodayCards />)
    expect(state('Morning azkar')).toHaveTextContent(/^Done at 6:12\sAM$/)
    expect(within(card('Morning azkar')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    unmount()

    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 2 } } } })
    renderInRouter(<AzkarTodayCards />)
    expect(state('Morning azkar')).toHaveTextContent(/^Done at 6:12\sAM$/)
  })

  it('shows the time a session was finished by counting it to the end', () => {
    vi.setSystemTime(at0612)
    const progress = useAzkarProgress.getState()
    for (const id of ['tasbih', 'hamd', 'takbir']) progress.complete(DAY, 'morning', id)
    progress.increment(DAY, 'evening', 'hamd')
    vi.setSystemTime(at0612 + 60 * 60_000)
    renderInRouter(<AzkarTodayCards />)
    expect(state('Morning azkar')).toHaveTextContent(/^Done at 6:12\sAM$/)
    expect(state('Evening azkar')).toHaveTextContent(/^1 of 2 done$/)
  })

  it('shows last night’s evening session, finished after midnight, until Fajr', () => {
    // Evening azkar finished at 00:30 on the 13th are filed under the evening of the 12th.
    useAzkarProgress.setState({
      sessions: { [DAY]: { evening: { ...finished(Date.parse('2026-10-13T00:30:00Z')), total: 2, done: 2 } } },
    })
    vi.setSystemTime(new Date('2026-10-13T01:00:00Z'))
    renderInRouter(<AzkarTodayCards />)
    expect(state('Evening azkar')).toHaveTextContent(/^Done at 12:30\sAM$/)
    expect(state('Morning azkar')).toHaveTextContent(/^Start$/)
  })

  it('is written in Arabic in the Arabic interface', () => {
    resetStores('ar')
    useAzkarProgress.setState({
      days: { [DAY]: { evening: { hamd: 1 } } },
      sessions: { [DAY]: { morning: finished(at0612) } },
    })
    renderInRouter(<AzkarTodayCards />)
    expect(state('أذكار الصباح')).toHaveTextContent(/^اكتملت الساعة ٦:١٢\sص$/)
    expect(state('أذكار المساء')).toHaveTextContent(/^اكتمل ١ من ٢$/)
  })
})
