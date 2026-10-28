import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { FastingStats } from './FastingStats'
import { useFasting } from './store'
import { freezeToday, resetFasting, seedFasts, setSettings } from './test-utils'
import type { FastingDays } from './types'

const TODAY = '2026-10-29'
const AT = Date.parse(`${TODAY}T12:00:00Z`)

function history(): FastingDays {
  const days: FastingDays = {}
  // Ramadan 1447: 28 days fasted, then one excused and one missed.
  for (let index = 0; index < 28; index++) days[shiftDateKey('2026-02-18', index)] = { kind: 'ramadan', status: 'fasted', at: AT }
  days['2026-03-18'] = { kind: 'ramadan', status: 'excused', at: AT }
  days['2026-03-19'] = { kind: 'ramadan', status: 'missed', at: AT }
  days['2026-04-06'] = { kind: 'qada', status: 'fasted', at: AT }
  // Voluntary fasts in 1448: Ashura, and two in Jumada I (the 1st and the 15th, a Monday).
  days['2026-06-25'] = { kind: 'voluntary', status: 'fasted', at: AT }
  days['2026-10-12'] = { kind: 'voluntary', status: 'fasted', at: AT }
  days['2026-10-26'] = { kind: 'voluntary', status: 'fasted', at: AT }
  return days
}

function renderStats(options: { language?: 'en' | 'ar'; days?: FastingDays; owedBefore?: number } = {}) {
  freezeToday(TODAY)
  setSettings({ language: options.language ?? 'en' })
  seedFasts(options.days ?? history(), options.owedBefore ?? 3)
  return render(<FastingStats />)
}

/** The figures of one group, as "label: value". */
function figures(name: string): string[] {
  const group = screen.getByRole('region', { name })
  const terms = within(group).getAllByRole('term')
  const values = within(group).getAllByRole('definition')
  return terms.map((term, index) => `${term.textContent}: ${values[index]?.textContent}`)
}

afterEach(() => {
  resetFasting()
})

describe('FastingStats', () => {
  it('shows this year’s Ramadan', () => {
    renderStats()
    expect(screen.getByRole('heading', { level: 2, name: 'Fasting' })).toBeInTheDocument()
    expect(figures('Ramadan 1447 AH')).toEqual(['Days fasted: 28 of 30', 'Not fasted: 2 days', 'Not logged: 0 days'])
  })

  it('shows what is still to make up, and how the figure is made', () => {
    renderStats()
    expect(figures('Making up Ramadan')).toEqual([
      'Still to make up: 4 days',
      'Made up: 1 day',
      'Not fasted in Ramadan: 2 days',
    ])
    expect(screen.getByRole('spinbutton', { name: 'Owed from before you began logging' })).toHaveValue(3)
  })

  it('takes the days owed from before the log as typed', async () => {
    renderStats()
    const field = screen.getByRole('spinbutton', { name: 'Owed from before you began logging' })
    await userEvent.clear(field)
    // An empty field is left alone while it is being typed into.
    expect(useFasting.getState().owedBefore).toBe(3)
    await userEvent.type(field, '12')
    expect(useFasting.getState().owedBefore).toBe(12)
    expect(figures('Making up Ramadan')[0]).toBe('Still to make up: 13 days')

    await userEvent.clear(field)
    await userEvent.tab()
    // Left empty, the field shows the figure kept.
    expect(field).toHaveValue(12)
  })

  it('counts voluntary fasts this Hijri month and year', () => {
    renderStats()
    expect(figures('Voluntary fasts')).toEqual(['Jumada I 1448 AH: 2 fasts', '1448 AH: 3 fasts'])
  })

  it('shows the streaks', () => {
    // Mondays and Thursdays from 15 October: the 15th, 19th, 22nd, 26th and 29th.
    const days: FastingDays = {}
    for (const date of ['2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29']) {
      days[date] = { kind: 'voluntary', status: 'fasted', at: AT }
    }
    // Jumada I's white days.
    days['2026-10-24'] = { kind: 'voluntary', status: 'fasted', at: AT }
    days['2026-10-25'] = { kind: 'voluntary', status: 'fasted', at: AT }
    renderStats({ days })
    expect(figures('Fasting streaks')).toEqual([
      'Mondays and Thursdays: 5 fasts, best 5 fasts',
      'White days: 1 month, best 1 month',
    ])
  })

  it('starts from nothing', () => {
    renderStats({ days: {}, owedBefore: 0 })
    expect(figures('Making up Ramadan')[0]).toBe('Still to make up: 0 days')
    expect(figures('Ramadan 1447 AH')).toEqual(['Days fasted: 0 of 30', 'Not fasted: 0 days', 'Not logged: 30 days'])
    expect(figures('Fasting streaks')).toEqual([
      'Mondays and Thursdays: 0 fasts, best 0 fasts',
      'White days: 0 months, best 0 months',
    ])
  })

  it('reads naturally in Arabic', () => {
    renderStats({ language: 'ar' })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('الصيام')
    expect(figures('رمضان ١٤٤٧ هـ')).toEqual(['أيام الصيام: ٢٨ من ٣٠', 'أيام الإفطار: يومان', 'أيام لم تُسجَّل: ٠ يوم'])
    expect(figures('قضاء رمضان')).toEqual([
      'المتبقي للقضاء: ٤ أيام',
      'ما قُضي: يوم واحد',
      'أيام لم تُصَم في رمضان: يومان',
    ])
  })
})

describe('on a runtime without the Umm al-Qura calendar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('says so, and still shows the days to make up and the Monday and Thursday streak', async () => {
    const Real = Intl.DateTimeFormat
    // Such a runtime silently falls back to the Gregorian calendar.
    const Fallback = function (locale?: string, options?: Intl.DateTimeFormatOptions) {
      return new Real(locale?.replace('-ca-islamic-umalqura', ''), { ...options, calendar: 'gregory' })
    } as unknown as typeof Intl.DateTimeFormat
    // Intl's members are not enumerable, so the stub inherits them rather than copying them.
    vi.stubGlobal('Intl', Object.assign(Object.create(Intl) as typeof Intl, { DateTimeFormat: Fallback }))
    vi.resetModules()
    const [{ FastingStats: Fresh }, { useFasting: freshStore }, { useSettings: freshSettings }] = await Promise.all([
      import('./FastingStats'),
      import('./store'),
      import('../../shared/settings'),
    ])
    freshSettings.setState({ language: 'en' })
    freshStore.setState({ days: { '2026-10-26': { kind: 'voluntary', status: 'fasted', at: AT } }, owedBefore: 2 })

    render(<Fresh today={TODAY} />)
    expect(screen.getByText('This device has no Hijri calendar, so Ramadan and the white days can’t be worked out.')).toBeInTheDocument()
    expect(figures('Making up Ramadan')[0]).toBe('Still to make up: 2 days')
    expect(screen.queryByRole('region', { name: 'Voluntary fasts' })).toBeNull()
    expect(figures('Fasting streaks')).toEqual(['Mondays and Thursdays: 1 fast, best 1 fast'])
  })
})
