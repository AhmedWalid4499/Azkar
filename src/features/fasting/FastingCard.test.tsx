import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic } from '../../native'
import type { DateKey } from '../../shared/types'
import { FastingCard } from './FastingCard'
import { useFasting } from './store'
import { freezeToday, resetFasting, seedFasts, setSettings } from './test-utils'
import type { FastingDays } from './types'

vi.mock('../../native', async (importOriginal) => ({ ...(await importOriginal<object>()), haptic: vi.fn() }))

const MONDAY = '2026-11-02'
const TUESDAY = '2026-11-03'
const NOON = (dateKey: DateKey) => Date.parse(`${dateKey}T12:00:00Z`)

function renderCard(today: DateKey, options: { offset?: number; language?: 'en' | 'ar'; days?: FastingDays; owedBefore?: number } = {}) {
  freezeToday(today)
  setSettings({ hijriOffset: options.offset ?? 0, language: options.language ?? 'en' })
  seedFasts(options.days ?? {}, options.owedBefore ?? 0)
  return render(<FastingCard />)
}

const reasons = () =>
  within(screen.getByRole('list', { name: 'Why today' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)
const fasting = () => screen.getByRole('button', { name: 'I’m fasting today' })
const qadaSwitch = () => screen.queryByRole('switch', { name: 'Make-up fast for a day of Ramadan' })
const days = () => useFasting.getState().days

beforeEach(() => {
  vi.mocked(haptic).mockClear()
})

afterEach(() => {
  resetFasting()
})

describe('when it appears', () => {
  it('appears on a Monday, saying why, under a heading', () => {
    renderCard(MONDAY)
    expect(screen.getByRole('region', { name: 'A sunnah fast today' })).toBeInTheDocument()
    expect(reasons()).toEqual(['Monday'])
    expect(fasting()).toHaveAttribute('aria-pressed', 'false')
  })

  it('stays away on an ordinary day', () => {
    const { container } = renderCard(TUESDAY)
    expect(container).toBeEmptyDOMElement()
  })

  it('gives every reason a day has', () => {
    renderCard('2026-10-26')
    expect(reasons()).toEqual(['One of the white days (Jumada I 15)', 'Monday'])
  })

  it('names Arafah and Ashura', () => {
    const { unmount } = renderCard('2026-05-26')
    expect(reasons()).toEqual(['Day of Arafah'])
    unmount()
    renderCard('2026-06-24')
    expect(reasons()).toEqual(['Tasu‘a, the day before Ashura'])
  })

  it('follows the Hijri offset', () => {
    renderCard('2026-05-25', { offset: 1 })
    expect(reasons()).toEqual(['Day of Arafah', 'Monday'])
  })

  it('never suggests a fast on the Eid or the days of Tashriq, a Thursday or a logged fast notwithstanding', () => {
    const thursdayOfTashriq = '2026-05-28'
    const { container, unmount } = renderCard(thursdayOfTashriq, {
      days: { [thursdayOfTashriq]: { kind: 'voluntary', status: 'fasted', at: NOON(thursdayOfTashriq) } },
    })
    expect(container).toBeEmptyDOMElement()
    unmount()
    // Shifted a day, Monday 25 May is Arafah and Tuesday 26 May the Eid.
    expect(renderCard('2026-05-26', { offset: 1 }).container).toBeEmptyDOMElement()
  })

  it('gives way to the Ramadan card in Ramadan, though it is a Monday and a white day', () => {
    const { container } = renderCard('2026-03-02')
    expect(container).toBeEmptyDOMElement()
  })

  it('appears on an ordinary day once a fast is logged for it', () => {
    renderCard(TUESDAY, { days: { [TUESDAY]: { kind: 'qada', status: 'fasted', at: NOON(TUESDAY) } } })
    expect(screen.getByRole('region', { name: 'Today’s fast' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
    expect(fasting()).toHaveAttribute('aria-pressed', 'true')
    expect(qadaSwitch()).toBeChecked()
  })
})

describe('the six days of Shawwal', () => {
  const shawwalFasts = (dates: DateKey[]): FastingDays =>
    Object.fromEntries(dates.map((date) => [date, { kind: 'voluntary', status: 'fasted', at: NOON(date) }]))

  it('says how many are done', () => {
    renderCard('2026-03-23', { days: shawwalFasts(['2026-03-21', '2026-03-22']) })
    expect(reasons()).toEqual(['The six days of Shawwal: 2 of 6 fasted', 'Monday'])
  })

  it('stops suggesting them once six are fasted', () => {
    const six = shawwalFasts(['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26'])
    const { container, unmount } = renderCard('2026-03-28', { days: six })
    expect(container).toBeEmptyDOMElement()
    unmount()
    // A Thursday is still a Thursday.
    renderCard('2026-04-09', { days: six })
    expect(reasons()).toEqual(['Thursday'])
  })

  it('counts today’s fast among them once it is logged', async () => {
    renderCard('2026-03-24', { days: shawwalFasts(['2026-03-21', '2026-03-22', '2026-03-23']) })
    expect(reasons()).toEqual(['The six days of Shawwal: 3 of 6 fasted'])
    await userEvent.click(fasting())
    expect(reasons()).toEqual(['The six days of Shawwal: 4 of 6 fasted'])
  })

  it('keeps the card on the day the sixth is logged', async () => {
    renderCard('2026-03-31', {
      days: shawwalFasts(['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25']),
    })
    await userEvent.click(fasting())
    expect(reasons()).toEqual(['The six days of Shawwal: 6 of 6 fasted'])
    expect(fasting()).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('logging today’s fast', () => {
  it('logs a voluntary fast in one tap, with the time, and clears it with another', async () => {
    renderCard(MONDAY)
    await userEvent.click(fasting())
    expect(days()).toEqual({ [MONDAY]: { kind: 'voluntary', status: 'fasted', at: NOON(MONDAY) } })
    expect(fasting()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Logged at 12:00')).toBeInTheDocument()
    expect(haptic).toHaveBeenCalledWith('tick')

    await userEvent.click(fasting())
    expect(days()).toEqual({})
    // The card stays: Monday is still recommended.
    expect(fasting()).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers to count it as a make-up fast while days of Ramadan are owed', async () => {
    renderCard(MONDAY, { owedBefore: 2 })
    expect(qadaSwitch()).toBeNull()
    await userEvent.click(fasting())
    expect(qadaSwitch()).not.toBeChecked()

    await userEvent.click(qadaSwitch()!)
    expect(days()[MONDAY]).toMatchObject({ kind: 'qada', status: 'fasted' })
    expect(qadaSwitch()).toBeChecked()

    await userEvent.click(qadaSwitch()!)
    expect(days()[MONDAY]).toMatchObject({ kind: 'voluntary', status: 'fasted' })
  })

  it('does not offer it when nothing is owed', async () => {
    renderCard(MONDAY)
    await userEvent.click(fasting())
    expect(qadaSwitch()).toBeNull()
  })

  it('keeps a make-up fast a make-up fast when it is logged again', async () => {
    renderCard(MONDAY, { days: { [MONDAY]: { kind: 'qada', status: 'broken', at: NOON(MONDAY) } } })
    expect(screen.getByText('Logged as: Make-up fast: Broke the fast')).toBeInTheDocument()
    expect(fasting()).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(fasting())
    expect(days()[MONDAY]).toMatchObject({ kind: 'qada', status: 'fasted' })
  })
})

describe('in Arabic', () => {
  it('reads naturally', () => {
    renderCard('2026-10-26', { language: 'ar' })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('يُستحب الصيام اليوم')
    const list = screen.getByRole('list', { name: 'سبب الاستحباب' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'من الأيام البيض (١٥ جمادى الأولى)',
      'يوم الاثنين',
    ])
    expect(screen.getByRole('button', { name: 'أصوم اليوم' })).toBeInTheDocument()
  })
})
