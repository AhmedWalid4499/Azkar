import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic } from '../../native'
import type { DateKey, PrayerDay } from '../../shared/types'
import { usePrayerDay } from '../prayer-times'
import { RamadanCard } from './RamadanCard'
import { useFasting } from './store'
import { fakePrayerDay, resetFasting, seedFasts, setClock, setSettings } from './test-utils'

vi.mock('../../native', async (importOriginal) => ({ ...(await importOriginal<object>()), haptic: vi.fn() }))
// Only the timetable is needed, so the rest of the prayer-times feature is not loaded at all.
vi.mock('../prayer-times', () => ({ usePrayerDay: vi.fn() }))

const RIYADH = 'Asia/Riyadh'
/** 12 Ramadan 1447, a Sunday. */
const DAY_12 = '2026-03-01'
/** 30 Ramadan 1447, the last day: Eid al-Fitr is the next. */
const LAST_DAY = '2026-03-19'

/** Every day's prayer times at the saved location; Fajr a minute later each day, to tell the days apart. */
let timetable: Record<DateKey, PrayerDay> = {}

function at(dateKey: DateKey, clock: string) {
  return `${dateKey}T${clock}:00+03:00`
}

function renderCard(iso: string, options: { offset?: number; language?: 'en' | 'ar'; ticking?: boolean } = {}) {
  setClock(iso, RIYADH, { ticking: options.ticking })
  setSettings({ hijriOffset: options.offset ?? 0, language: options.language ?? 'en' })
  return render(<RamadanCard />)
}

const heading = () => screen.getByRole('heading', { level: 2 })
const toggle = (name: string | RegExp) => screen.getByRole('button', { name })
const fastToday = () => useFasting.getState().days

beforeEach(() => {
  vi.mocked(haptic).mockClear()
  timetable = {
    '2026-02-17': fakePrayerDay('2026-02-17', { fajr: '05:20' }, RIYADH),
    [DAY_12]: fakePrayerDay(DAY_12, { fajr: '05:00', maghrib: '18:00' }, RIYADH),
    '2026-03-02': fakePrayerDay('2026-03-02', { fajr: '04:59', maghrib: '18:01' }, RIYADH),
    [LAST_DAY]: fakePrayerDay(LAST_DAY, { fajr: '04:45', maghrib: '18:15' }, RIYADH),
    '2026-03-20': fakePrayerDay('2026-03-20', { fajr: '04:44' }, RIYADH),
  }
  vi.mocked(usePrayerDay).mockImplementation((dateKey?: DateKey) => (dateKey ? (timetable[dateKey] ?? null) : null))
})

afterEach(() => {
  resetFasting()
})

describe('outside Ramadan', () => {
  it('renders nothing', () => {
    const { container } = renderCard(at('2026-10-29', '09:00'))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on the Eid', () => {
    const { container } = renderCard(at('2026-03-20', '09:00'))
    expect(container).toBeEmptyDOMElement()
  })
})

describe('in Ramadan', () => {
  it('names the day of Ramadan and shows when suhoor ends and when iftar is', () => {
    renderCard(at(DAY_12, '09:00'))
    expect(screen.getByRole('region', { name: 'Day 12 of Ramadan' })).toBeInTheDocument()
    expect(heading()).toHaveTextContent('Day 12 of Ramadan')

    const terms = screen.getAllByRole('term').map((term) => term.textContent)
    const values = screen.getAllByRole('definition').map((value) => value.textContent)
    expect(terms).toEqual(['Suhoor ends Fajr', 'Iftar Maghrib'])
    expect(values).toEqual(['05:00', '18:00'])
    expect(vi.mocked(usePrayerDay)).toHaveBeenCalledWith(DAY_12)
    expect(vi.mocked(usePrayerDay)).toHaveBeenCalledWith('2026-03-02')
  })

  it('counts down to iftar during the day, and says so in words for a screen reader', () => {
    renderCard(at(DAY_12, '09:00'))
    expect(screen.getByText('9:00:00')).toBeInTheDocument()
    expect(screen.getByText('Until iftar')).toBeInTheDocument()
    expect(screen.getByText('Iftar is at 18:00, in 9 hours.')).toHaveClass('visually-hidden')
    // The ticking figures are hidden from assistive tech, and nothing on the card is a live region.
    expect(screen.getByText('9:00:00').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(document.querySelector('[aria-live]')).toBeNull()
  })

  it('counts down to the end of suhoor before Fajr', () => {
    renderCard(at(DAY_12, '03:30'))
    expect(screen.getByText('1:30:00')).toBeInTheDocument()
    expect(screen.getByText('Until suhoor ends')).toBeInTheDocument()
    expect(screen.getByText('Suhoor ends at 05:00, in 1 hour and 30 minutes.')).toBeInTheDocument()
  })

  it('counts down to tomorrow’s suhoor after iftar', () => {
    renderCard(at(DAY_12, '20:00'))
    expect(screen.getByText('8:59:00')).toBeInTheDocument()
    expect(screen.getByText('Until suhoor ends tomorrow')).toBeInTheDocument()
    expect(screen.getByText('Suhoor ends tomorrow at 04:59, in 8 hours and 59 minutes.')).toBeInTheDocument()
  })

  it('keeps counting as the clock runs, and rolls over to iftar once Fajr comes', () => {
    renderCard(at(DAY_12, '04:59'), { ticking: true })
    expect(screen.getByText('0:01:00')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByText('0:00:45')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(46_000))
    expect(screen.getByText('Until iftar')).toBeInTheDocument()
    expect(screen.getByText('12:59:59')).toBeInTheDocument()
  })

  it('says that tomorrow is the Eid once the last iftar has come', () => {
    renderCard(at(LAST_DAY, '19:00'))
    expect(heading()).toHaveTextContent('Day 30 of Ramadan')
    expect(screen.getByText('Tomorrow is Eid al-Fitr.')).toBeInTheDocument()
    expect(screen.queryByText(/^Until/)).toBeNull()
  })

  it('counts down to iftar on the last day as on any other', () => {
    renderCard(at(LAST_DAY, '12:15'))
    expect(screen.getByText('6:00:00')).toBeInTheDocument()
    expect(screen.queryByText('Tomorrow is Eid al-Fitr.')).toBeNull()
  })

  it('follows the Hijri offset', () => {
    const { unmount } = renderCard(at('2026-02-17', '09:00'))
    expect(screen.queryByRole('heading')).toBeNull()
    unmount()

    renderCard(at('2026-02-17', '09:00'), { offset: 1 })
    expect(heading()).toHaveTextContent('Day 1 of Ramadan')
  })

  it('leaves out a time that does not exist that day', () => {
    timetable[DAY_12] = fakePrayerDay(DAY_12, { fajr: null, maghrib: '18:00' }, RIYADH)
    renderCard(at(DAY_12, '03:00'))
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Iftar Maghrib'])
    expect(screen.getByText('Until iftar')).toBeInTheDocument()
  })

  it('still logs the fast without a location, and says where the times will come from', async () => {
    timetable = {}
    renderCard(at(DAY_12, '09:00'))
    expect(screen.getByText('The times of suhoor and iftar appear once a location is set.')).toBeInTheDocument()
    expect(screen.queryByRole('term')).toBeNull()
    await userEvent.click(toggle('I’m fasting today'))
    expect(fastToday()[DAY_12]).toMatchObject({ kind: 'ramadan', status: 'fasted' })
  })
})

describe('today’s fast', () => {
  it('is logged in one tap, with the time, and cleared with another', async () => {
    renderCard(at(DAY_12, '09:00'))
    const fasting = toggle('I’m fasting today')
    expect(fasting).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(fasting)
    expect(fastToday()).toEqual({ [DAY_12]: { kind: 'ramadan', status: 'fasted', at: Date.parse(at(DAY_12, '09:00')) } })
    expect(fasting).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Logged at 09:00')).toBeInTheDocument()
    expect(haptic).toHaveBeenCalledWith('tick')

    await userEvent.click(fasting)
    expect(fastToday()).toEqual({})
    expect(fasting).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(/^Logged/)).toBeNull()
  })

  it('can be logged as excused instead, and switched back', async () => {
    renderCard(at(DAY_12, '09:00'))
    await userEvent.click(toggle('Excused today'))
    expect(fastToday()[DAY_12]).toMatchObject({ kind: 'ramadan', status: 'excused' })
    expect(toggle('Excused today')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle('I’m fasting today')).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(toggle('I’m fasting today'))
    expect(fastToday()[DAY_12]).toMatchObject({ kind: 'ramadan', status: 'fasted' })
    expect(toggle('Excused today')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows another status logged in the tracker in words, with neither toggle pressed', () => {
    seedFasts({ [DAY_12]: { kind: 'ramadan', status: 'broken', at: Date.parse(at(DAY_12, '13:10')) } })
    renderCard(at(DAY_12, '14:00'))
    expect(screen.getByText('Logged as: Ramadan fast: Broke the fast')).toBeInTheDocument()
    expect(screen.getByText('Logged at 13:10')).toBeInTheDocument()
    for (const button of screen.getAllByRole('button')) expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('is filed under the day of Ramadan it is, before Fajr included', async () => {
    renderCard(at('2026-03-02', '03:00'))
    expect(heading()).toHaveTextContent('Day 13 of Ramadan')
    await userEvent.click(toggle('I’m fasting today'))
    expect(Object.keys(fastToday())).toEqual(['2026-03-02'])
  })
})

describe('in Arabic', () => {
  it('reads naturally, with Arabic digits', () => {
    renderCard(at(DAY_12, '09:00'), { language: 'ar' })
    expect(heading()).toHaveTextContent('اليوم ١٢ من رمضان')
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['نهاية السحور الفجر', 'الإفطار المغرب'])
    expect(screen.getByText('المتبقي على الإفطار')).toBeInTheDocument()
    expect(screen.getByText('الإفطار في الساعة ١٨:٠٠، أي بعد ٩ ساعات.')).toBeInTheDocument()
    expect(within(screen.getByRole('region')).getByRole('button', { name: 'أصوم اليوم' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'لديّ عذر اليوم' })).toBeInTheDocument()
  })
})
