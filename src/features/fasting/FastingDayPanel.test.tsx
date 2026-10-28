import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { DateKey } from '../../shared/types'
import { FastingDayPanel } from './FastingDayPanel'
import { useFasting } from './store'
import { freezeToday, resetFasting, seedFasts, setSettings } from './test-utils'
import type { FastingDays } from './types'

const TODAY = '2026-10-29'
const NOON = Date.parse(`${TODAY}T12:00:00Z`)
/** 12 Ramadan 1447. */
const RAMADAN_DAY = '2026-03-01'
/** 15 Jumada I 1448, a Monday. */
const WHITE_MONDAY = '2026-10-26'

function renderPanel(dateKey: DateKey, options: { days?: FastingDays; offset?: number; language?: 'en' | 'ar' } = {}) {
  freezeToday(TODAY)
  setSettings({ hijriOffset: options.offset ?? 0, language: options.language ?? 'en' })
  seedFasts(options.days ?? {})
  return render(<FastingDayPanel dateKey={dateKey} />)
}

const group = (name: string) => screen.getByRole('group', { name })
const options = (name: string) => within(group(name)).getAllByRole('radio')
const optionNames = (name: string) => options(name).map((radio) => radio.getAttribute('value'))
const checked = (name: string) => options(name).filter((radio) => (radio as HTMLInputElement).checked).map((radio) => radio.getAttribute('value'))
const days = () => useFasting.getState().days

afterEach(() => {
  resetFasting()
})

describe('a day of Ramadan', () => {
  it('says which day of Ramadan it is and offers the four ways it can go', () => {
    renderPanel(RAMADAN_DAY)
    expect(screen.getByRole('region', { name: 'Fasting' })).toBeInTheDocument()
    expect(screen.getByText('Day 12 of Ramadan')).toBeInTheDocument()
    expect(screen.getByText('No fast logged for this day.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Kind of fast' })).toBeNull()
    expect(optionNames('Status')).toEqual(['fasted', 'excused', 'broken', 'missed'])
    expect(checked('Status')).toEqual([])
    expect(screen.getByRole('radio', { name: 'Excused' })).toHaveAccessibleDescription(
      'Not fasting for a valid reason, such as travel, illness or menstruation',
    )
  })

  it('logs a Ramadan fast, shows when, and clears it', async () => {
    renderPanel(RAMADAN_DAY)
    await userEvent.click(screen.getByRole('radio', { name: 'Excused' }))
    expect(days()).toEqual({ [RAMADAN_DAY]: { kind: 'ramadan', status: 'excused', at: NOON } })
    expect(checked('Status')).toEqual(['excused'])
    // Logged months later, so the date is given with the time.
    expect(screen.getByText('Logged at Oct 29, 12:00')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Did not fast' }))
    expect(days()[RAMADAN_DAY]).toMatchObject({ kind: 'ramadan', status: 'missed' })

    await userEvent.click(screen.getByRole('button', { name: 'Clear fast' }))
    expect(days()).toEqual({})
    expect(screen.getByText('No fast logged for this day.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear fast' })).toBeNull()
  })
})

describe('another day', () => {
  it('says why it is recommended and offers a voluntary or a make-up fast', () => {
    renderPanel(WHITE_MONDAY)
    const reasons = screen.getByRole('list', { name: 'Recommended for fasting:' })
    expect(within(reasons).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'One of the white days (Jumada I 15)',
      'Monday',
    ])
    expect(optionNames('Kind of fast')).toEqual(['voluntary', 'qada'])
    expect(optionNames('Status')).toEqual(['fasted', 'broken', 'excused'])
    expect(screen.getByRole('radio', { name: 'Make-up fast' })).toHaveAccessibleDescription('Making up a day of Ramadan')
  })

  it('logs a completed fast of the kind chosen first, then changes how it went', async () => {
    renderPanel(WHITE_MONDAY)
    await userEvent.click(screen.getByRole('radio', { name: 'Make-up fast' }))
    expect(days()[WHITE_MONDAY]).toMatchObject({ kind: 'qada', status: 'fasted' })
    expect(checked('Kind of fast')).toEqual(['qada'])
    expect(checked('Status')).toEqual(['fasted'])

    await userEvent.click(screen.getByRole('radio', { name: 'Broke the fast' }))
    expect(days()[WHITE_MONDAY]).toMatchObject({ kind: 'qada', status: 'broken' })

    await userEvent.click(screen.getByRole('radio', { name: 'Voluntary fast' }))
    expect(days()[WHITE_MONDAY]).toMatchObject({ kind: 'voluntary', status: 'broken' })
  })

  it('counts the six days of Shawwal as done at six, however many more were fasted', () => {
    const shawwal: FastingDays = {}
    for (const date of ['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28']) {
      shawwal[date] = { kind: 'voluntary', status: 'fasted', at: NOON }
    }
    renderPanel('2026-03-24', { days: shawwal })
    const reasons = screen.getByRole('list', { name: 'Recommended for fasting:' })
    expect(within(reasons).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'The six days of Shawwal: 6 of 6 fasted',
    ])
  })

  it('logs a voluntary fast when how it went is chosen first', async () => {
    renderPanel('2026-10-27')
    expect(screen.queryByRole('list')).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'Excused' }))
    expect(days()['2026-10-27']).toMatchObject({ kind: 'voluntary', status: 'excused' })
  })

  it('keeps a Ramadan fast that the offset has since moved out of Ramadan, and lets it be changed', async () => {
    // With an offset of -1 the 18th of February is the 29th of Sha'ban.
    renderPanel('2026-02-18', { offset: -1, days: { '2026-02-18': { kind: 'ramadan', status: 'fasted', at: NOON } } })
    expect(optionNames('Kind of fast')).toEqual(['voluntary', 'qada', 'ramadan'])
    expect(checked('Kind of fast')).toEqual(['ramadan'])
    expect(optionNames('Status')).toEqual(['fasted', 'excused', 'broken', 'missed'])
    await userEvent.click(screen.getByRole('radio', { name: 'Voluntary fast' }))
    expect(days()['2026-02-18']).toMatchObject({ kind: 'voluntary', status: 'fasted' })
  })
})

describe('days that cannot be logged', () => {
  it('offers nothing for a day that has not begun', () => {
    renderPanel('2026-11-02')
    expect(screen.getByText('This day has not begun yet.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    // What the calendar says is still shown.
    expect(screen.getByText('Monday')).toBeInTheDocument()
  })

  it('offers nothing to log on the Eid, and says why', () => {
    renderPanel('2026-05-27')
    expect(screen.getByText('Eid al-Adha: fasting is not permitted on this day.')).toBeInTheDocument()
    expect(screen.getByText('If your local calendar differs, the Hijri date can be adjusted in Settings.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByText('No fast logged for this day.')).toBeNull()
  })

  it('still shows a fast logged on such a day, so it can be corrected or cleared', async () => {
    renderPanel('2026-05-28', { days: { '2026-05-28': { kind: 'voluntary', status: 'fasted', at: NOON } } })
    expect(screen.getByText('One of the days of Tashriq: fasting is not permitted on this day.')).toBeInTheDocument()
    expect(checked('Status')).toEqual(['fasted'])
    await userEvent.click(screen.getByRole('button', { name: 'Clear fast' }))
    expect(days()).toEqual({})
    expect(screen.queryByRole('radio')).toBeNull()
  })
})

describe('in Arabic', () => {
  it('reads naturally', () => {
    renderPanel(RAMADAN_DAY, { language: 'ar' })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('الصيام')
    expect(screen.getByText('اليوم ١٢ من رمضان')).toBeInTheDocument()
    const status = screen.getByRole('group', { name: 'الحالة' })
    const radios = within(status).getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(radios[0]).toHaveAccessibleName('صيام تام')
    expect(radios[0]).toHaveAccessibleDescription('صيام من الفجر إلى المغرب')
    expect(radios[1]).toHaveAccessibleName('إفطار بعذر')
    expect(radios[1]).toHaveAccessibleDescription('ترك الصيام لعذر شرعي، كالسفر أو المرض أو الحيض')
    expect(radios[2]).toHaveAccessibleName('صيام لم يكتمل')
    // A verbal noun, like the other explanations, so it addresses no one as he or she.
    expect(radios[2]).toHaveAccessibleDescription('بدء الصيام دون إتمامه')
    expect(radios[3]).toHaveAccessibleName('إفطار بلا عذر')
  })
})
