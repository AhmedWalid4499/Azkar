import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatHijri, shiftDateKey } from '../../shared/date'
import { useSettings } from '../../shared/settings'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerDay } from '../../shared/types'
import type { SessionRecord } from '../azkar'
import { LogPage } from './LogPage'
import { LogRoutes } from './LogRoutes'
import { usePrayerLog } from './store'
import { freezeToday, resetApp, seedLog, seedSessions, seedSunnah, setLanguage } from './test-utils'
import type { DayLog, LogEntries, PrayerStatus } from './types'

// The timetable belongs to another feature; only its `usePrayerDay` contract is used here.
const timetable = vi.hoisted(() => ({ forDay: (_dateKey?: string): PrayerDay | null => null }))
vi.mock('../prayer-times', () => ({ usePrayerDay: (dateKey?: string) => timetable.forDay(dateKey) }))

const TODAY = '2026-10-11'
const AT = (dateKey: DateKey, time: string) => Date.parse(`${dateKey}T${time}Z`)

function all(status: PrayerStatus): DayLog {
  return Object.fromEntries(PRAYERS.map((prayer) => [prayer, status])) as DayLog
}

function span(from: DateKey, to: DateKey, log: DayLog = all('ontime')): LogEntries {
  const entries: LogEntries = {}
  for (let key = from; key <= to; key = shiftDateKey(key, 1)) entries[key] = log
  return entries
}

function completed(dateKey: DateKey): SessionRecord {
  return {
    startedAt: AT(dateKey, '05:00:00'),
    lastAt: AT(dateKey, '05:20:00'),
    completedAt: AT(dateKey, '05:20:00'),
    completed: true,
    done: 3,
    total: 3,
    recitations: 40,
  }
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <LogPage />
    </MemoryRouter>,
  )

const entries = () => usePrayerLog.getState().entries
const day = (dateKey: DateKey) =>
  screen.getByRole('grid').querySelector<HTMLButtonElement>(`button[data-date="${dateKey}"]`)!
const status = (prayer: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: `${prayer} status` })).getByRole('radio', { name })
/** The figure shown under a tile's label. */
const tile = (label: string) => screen.getByText(label).closest('div')!.querySelector('dd')!
/** One cell of the 7- and 30-day table: the row's measure, then the window. */
const rate = (row: string, days: 7 | 30) => {
  const line = within(screen.getByRole('table')).getByRole('rowheader', { name: row }).closest('tr')!
  return within(line).getAllByRole('cell')[days === 7 ? 0 : 1]!
}
/** A row of the "More streaks" list. */
const streak = (name: string, heading = 'More streaks') => {
  const list = screen.getByRole('heading', { name: heading }).parentElement!
  return within(list).getByText(name).closest('dt')!.nextElementSibling!
}

beforeEach(() => {
  freezeToday(TODAY)
})

afterEach(() => {
  resetApp()
  timetable.forDay = () => null
})

describe('for a first-time user', () => {
  it('welcomes them instead of showing empty statistics, and says what each section will hold', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Log' })).toBeInTheDocument()
    expect(screen.getByText('Your prayers and azkar, day by day')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your log begins here' })).toBeInTheDocument()
    expect(screen.getByText(/streaks, how the last week and month went, missed prayers/)).toBeInTheDocument()
    expect(screen.queryByText('Current streak')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'All time' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /by prayer$/ })).not.toBeInTheDocument()

    const trends = screen.getByRole('region', { name: 'Last 8 weeks' })
    expect(trends).toHaveTextContent('each of your last eight weeks will show here as a bar')
    expect(within(trends).queryByRole('figure')).not.toBeInTheDocument()

    const history = screen.getByRole('region', { name: 'Your history' })
    expect(history).toHaveTextContent('Once you have recorded a day')
    expect(within(history).queryByRole('button')).not.toBeInTheDocument()
  })

  it('still lets them start logging straight away, on today', () => {
    renderPage()

    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { selected: true })).toContainElement(day(TODAY))
    expect(screen.getByRole('heading', { name: 'Sunday, October 11, 2026' })).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText(formatHijri(TODAY, 'en'))).toBeInTheDocument()
    expect(screen.getAllByRole('radiogroup')).toHaveLength(5)
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument()
  })

  it('replaces the welcome with statistics after the first prayer is logged', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(status('Fajr', 'On time'))

    expect(entries()).toEqual({ [TODAY]: { fajr: 'ontime' } })
    expect(screen.queryByRole('heading', { name: 'Your log begins here' })).not.toBeInTheDocument()
    expect(screen.getByText('Current streak')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'October 2026 by prayer' })).toBeInTheDocument()
    expect(day(TODAY)).toHaveAccessibleName('Today, Sunday, October 11, 2026, 1 of 5 logged')
    expect(screen.getByRole('region', { name: 'Your history' })).toContainElement(
      screen.getByRole('button', { name: 'Export history (CSV)' }),
    )
  })

  it('counts a sunnah prayer or an azkar session alone as a start', () => {
    seedSessions({ [TODAY]: { morning: completed(TODAY) } })
    renderPage()

    expect(screen.queryByRole('heading', { name: 'Your log begins here' })).not.toBeInTheDocument()
    expect(rate('Morning azkar', 7)).toHaveTextContent('100%')
    // No obligatory prayer is logged, so there is no month by prayer to show yet.
    expect(screen.queryByRole('heading', { name: /by prayer$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export history (CSV)' })).toBeInTheDocument()
  })
})

describe('the day panel', () => {
  it('offers all five statuses for each of the five prayers', () => {
    renderPage()
    for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      const group = screen.getByRole('radiogroup', { name: `${prayer} status` })
      expect(within(group).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
        'On time',
        'Jamaah',
        'Late',
        'Missed',
        'Excused',
      ])
    }
  })

  it('shows what is logged and changes it', async () => {
    seedLog({ [TODAY]: { fajr: 'jamaah', dhuhr: 'missed' } })
    const user = userEvent.setup()
    renderPage()

    expect(status('Fajr', 'Jamaah')).toBeChecked()
    expect(status('Dhuhr', 'Missed')).toBeChecked()
    const asr = screen.getByRole('radiogroup', { name: 'Asr status' })
    expect(within(asr).queryByRole('radio', { checked: true })).toBeNull()

    await user.click(status('Dhuhr', 'Late'))
    await user.click(status('Isha', 'Excused'))
    expect(entries()).toEqual({ [TODAY]: { fajr: 'jamaah', dhuhr: 'late', isha: 'excused' } })
    expect(status('Dhuhr', 'Late')).toBeChecked()
    expect(status('Dhuhr', 'Missed')).not.toBeChecked()
  })

  it('works with the keyboard like any radio group', async () => {
    seedLog({ [TODAY]: { fajr: 'ontime' } })
    const user = userEvent.setup()
    renderPage()

    status('Fajr', 'On time').focus()
    await user.keyboard('{ArrowRight}')
    expect(entries()[TODAY]).toEqual({ fajr: 'jamaah' })
    expect(status('Fajr', 'Jamaah')).toHaveFocus()
  })

  it('clears an entry and hands focus back to the choices', async () => {
    seedLog({ [TODAY]: { fajr: 'ontime', asr: 'late' } })
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByRole('button', { name: 'Clear Dhuhr entry' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear Asr entry' }))

    expect(entries()).toEqual({ [TODAY]: { fajr: 'ontime' } })
    expect(screen.queryByRole('button', { name: 'Clear Asr entry' })).not.toBeInTheDocument()
    expect(status('Asr', 'On time')).toHaveFocus()
    expect(status('Asr', 'Late')).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Clear Fajr entry' }))
    expect(entries()).toEqual({})
  })

  it('follows the day selected in the calendar', async () => {
    seedLog({ '2026-10-09': { maghrib: 'excused' } })
    const user = userEvent.setup()
    renderPage()

    await user.click(day('2026-10-09'))
    expect(screen.getByRole('heading', { name: 'Friday, October 9, 2026' })).toBeInTheDocument()
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(status('Maghrib', 'Excused')).toBeChecked()

    await user.click(status('Fajr', 'Late'))
    expect(entries()).toEqual({ '2026-10-09': { maghrib: 'excused', fajr: 'late' } })
    expect(day('2026-10-09')).toHaveAccessibleName('Friday, October 9, 2026, 2 of 5 logged')
  })

  it('keeps showing the selected day while another month is browsed', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sunday, October 11, 2026' })).toBeInTheDocument()

    await user.click(day('2026-09-30'))
    expect(screen.getByRole('heading', { name: 'Wednesday, September 30, 2026' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sunday, October 11, 2026' })).toBeInTheDocument()
  })

  describe('prayer times', () => {
    const cairo = (dateKey: DateKey): PrayerDay => ({
      dateKey,
      timeZone: 'Africa/Cairo',
      times: {
        fajr: new Date(`${dateKey}T02:05:00Z`),
        sunrise: new Date(`${dateKey}T03:30:00Z`),
        dhuhr: new Date(`${dateKey}T09:42:00Z`),
        asr: new Date(`${dateKey}T13:01:00Z`),
        maghrib: new Date(`${dateKey}T15:28:00Z`),
        isha: new Date(`${dateKey}T16:45:00Z`),
      },
    })
    const row = (prayer: string) => screen.getByRole('heading', { level: 4, name: prayer }).closest('li')!

    it('are left out when the timetable is not available', () => {
      renderPage()
      expect(row('Fajr')).not.toHaveTextContent(/\d:\d\d/)
    })

    it('are shown in the timetable zone and the chosen clock format', () => {
      timetable.forDay = (dateKey) => cairo(dateKey ?? TODAY)
      const { unmount } = renderPage()
      expect(within(row('Fajr')).getByText(/^5:05\sAM$/)).toBeInTheDocument()
      expect(within(row('Isha')).getByText(/^7:45\sPM$/)).toBeInTheDocument()
      unmount()

      useSettings.setState({ timeFormat: '24h' })
      renderPage()
      expect(within(row('Fajr')).getByText('05:05')).toBeInTheDocument()
      expect(within(row('Isha')).getByText('19:45')).toBeInTheDocument()
    })

    it('are asked for the selected day', async () => {
      const asked: Array<string | undefined> = []
      timetable.forDay = (dateKey) => {
        asked.push(dateKey)
        return null
      }
      const user = userEvent.setup()
      renderPage()
      await user.click(day('2026-10-03'))
      expect(asked).toContain(TODAY)
      expect(asked.at(-1)).toBe('2026-10-03')
    })

    it('are not shown when the timetable on hand is for another day', () => {
      timetable.forDay = () => cairo('2026-10-10')
      renderPage()
      expect(row('Fajr')).not.toHaveTextContent(/\d:\d\d/)
    })
  })
})

describe('statistics', () => {
  it('shows streaks and recent completion', () => {
    seedLog({
      ...span('2026-09-01', '2026-09-10'),
      ...span('2026-10-08', '2026-10-10'),
      [TODAY]: { fajr: 'ontime', dhuhr: 'missed' },
    })
    renderPage()

    expect(tile('Current streak')).toHaveTextContent('3 days')
    expect(tile('Best streak')).toHaveTextContent('10 days')
    // 5 to 7 October were not logged; today counts only its two logged prayers.
    expect(rate('Obligatory prayers', 7)).toHaveTextContent('50%')
    expect(rate('Obligatory prayers', 7)).toHaveTextContent('16 of 32 prayed')
    // 12 September onwards: 26 unlogged days, three full ones and today's two.
    expect(rate('Obligatory prayers', 30)).toHaveTextContent('10%')
    expect(rate('Obligatory prayers', 30)).toHaveTextContent('16 of 147 prayed')
  })

  it('uses the singular for a one-day streak', () => {
    seedLog({ [TODAY]: all('jamaah') })
    renderPage()
    expect(tile('Current streak')).toHaveTextContent(/^1 day$/)
    expect(rate('Obligatory prayers', 7)).toHaveTextContent('100%')
  })

  it('says so plainly when there is nothing to measure, as when every day was excused', () => {
    seedLog(span('2026-10-09', TODAY, all('excused')))
    renderPage()

    expect(tile('Current streak')).toHaveTextContent('0 days')
    expect(rate('Obligatory prayers', 7)).toHaveTextContent('Nothing to measure yet')
    expect(rate('Obligatory prayers', 7)).not.toHaveTextContent('%')
  })

  it('updates as prayers are logged', async () => {
    seedLog({
      ...span('2026-10-09', '2026-10-10'),
      [TODAY]: { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime' },
    })
    const user = userEvent.setup()
    renderPage()
    expect(tile('Current streak')).toHaveTextContent('2 days')

    await user.click(status('Isha', 'Late'))
    expect(tile('Current streak')).toHaveTextContent('3 days')

    // A missed prayer today is shown, but does not undo the days before it.
    await user.click(status('Isha', 'Missed'))
    expect(tile('Current streak')).toHaveTextContent('2 days')
    expect(tile('Best streak')).toHaveTextContent('2 days')
  })

  it('gives the last 7 and 30 days of the sunnah prayers and of each azkar session', () => {
    const tick = AT('2026-10-09', '05:00:00')
    seedSunnah({
      '2026-09-21': { duha: tick },
      '2026-10-09': { beforeFajr: tick, witr: tick },
      '2026-10-10': { witr: tick },
    })
    seedSessions({
      '2026-09-25': { morning: completed('2026-09-25') },
      '2026-10-09': { morning: completed('2026-10-09') },
      '2026-10-10': { evening: { ...completed('2026-10-10'), completed: false, completedAt: undefined, done: 1 } },
    })
    renderPage()

    expect(screen.getByRole('table', { name: 'Last 7 and 30 days' })).toBeInTheDocument()
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual(['Last 7 days', 'Last 30 days'])
    // Six past days of eight each in the week; today is under way and counts only what is done.
    expect(rate('Sunnah prayers', 7)).toHaveTextContent('6%')
    expect(rate('Sunnah prayers', 7)).toHaveTextContent('3 of 48 done')
    // Measured from the first tick, on 21 September: twenty past days.
    expect(rate('Sunnah prayers', 30)).toHaveTextContent('2%')
    expect(rate('Sunnah prayers', 30)).toHaveTextContent('4 of 160 done')
    // Today's sessions are still open, so only the six days before count in the week.
    expect(rate('Morning azkar', 7)).toHaveTextContent('16%')
    expect(rate('Morning azkar', 7)).toHaveTextContent('1 of 6 completed')
    expect(rate('Evening azkar', 7)).toHaveTextContent('0 of 6 completed')
    // Measured from the first session, on 25 September.
    expect(rate('Morning azkar', 30)).toHaveTextContent('12%')
    expect(rate('Morning azkar', 30)).toHaveTextContent('2 of 16 completed')
    expect(rate('Evening azkar', 30)).toHaveTextContent('0%')
    expect(rate('Evening azkar', 30)).toHaveTextContent('0 of 16 completed')
  })

  it('shows the Witr and azkar streaks beside the five prayers’', () => {
    const tick = (dateKey: DateKey) => AT(dateKey, '21:00:00')
    seedLog({ [TODAY]: { fajr: 'ontime' } })
    seedSunnah({
      '2026-10-08': { witr: tick('2026-10-08') },
      '2026-10-09': { witr: tick('2026-10-09') },
      '2026-10-10': { witr: tick('2026-10-10') },
    })
    seedSessions({
      '2026-10-05': { morning: completed('2026-10-05') },
      '2026-10-06': { morning: completed('2026-10-06') },
      '2026-10-10': { morning: completed('2026-10-10'), evening: completed('2026-10-10') },
      [TODAY]: { morning: completed(TODAY) },
    })
    renderPage()

    expect(streak('Witr')).toHaveTextContent('3 days, best 3 days')
    expect(streak('Morning azkar')).toHaveTextContent('2 days, best 2 days')
    expect(streak('Evening azkar')).toHaveTextContent('1 day, best 1 day')
  })

  describe('between midnight and Fajr', () => {
    beforeEach(() => {
      // 1:30 at night, before the stand-in Fajr hour: the night of 10 October is still under way.
      vi.setSystemTime(new Date(`${TODAY}T01:30:00Z`))
    })

    it('counts up to last night, so its Isha and Witr are not held against the streaks yet', () => {
      const tick = (dateKey: DateKey) => AT(dateKey, '21:00:00')
      seedLog({
        ...span('2026-10-08', '2026-10-09'),
        '2026-10-10': { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime' },
      })
      seedSunnah({ '2026-10-08': { witr: tick('2026-10-08') }, '2026-10-09': { witr: tick('2026-10-09') } })
      renderPage()

      expect(tile('Current streak')).toHaveTextContent('2 days')
      expect(streak('Witr')).toHaveTextContent('2 days, best 2 days')
      // Last night's Isha is not due yet either: 14 of the 14 prayers due since the 8th were prayed.
      expect(rate('Obligatory prayers', 7)).toHaveTextContent('14 of 14 prayed')
    })

    it('points from today to last night, where its Isha and night prayers belong', async () => {
      const user = userEvent.setup()
      renderPage()

      expect(screen.getByText('Until Fajr, last night’s Isha and night prayers count for yesterday.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Open yesterday' }))

      const heading = screen.getByRole('heading', { level: 2, name: 'Saturday, October 10, 2026' })
      expect(heading).toHaveFocus()
      expect(screen.getByRole('gridcell', { selected: true })).toContainElement(day('2026-10-10'))
      expect(screen.queryByRole('button', { name: 'Open yesterday' })).not.toBeInTheDocument()
    })
  })

  it('says nothing about last night once Fajr has come', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open yesterday' })).not.toBeInTheDocument()
  })
})

describe('missed prayers to make up', () => {
  it('reports when there are none', () => {
    seedLog({ [TODAY]: all('ontime') })
    renderPage()
    expect(screen.getByText('No missed prayers to make up')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /missed prayers? to make up/ })).not.toBeInTheDocument()
  })

  it('counts them and lists their days, oldest first, each opening that day', async () => {
    seedLog({
      '2026-10-03': { dhuhr: 'missed', asr: 'missed', isha: 'ontime' },
      '2026-10-09': { fajr: 'missed' },
      [TODAY]: all('ontime'),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '3 missed prayers to make up' }))
    const sheet = screen.getByRole('dialog', { name: 'Missed prayers to make up' })
    expect(sheet).toHaveTextContent('log it as Late and it leaves this list')
    expect(within(sheet).getAllByRole('listitem').map((item) => within(item).getByRole('button').getAttribute('aria-label'))).toEqual([
      'Saturday, October 3, 2026: Dhuhr, Asr',
      'Friday, October 9, 2026: Fajr',
    ])

    await user.click(within(sheet).getByRole('button', { name: 'Saturday, October 3, 2026: Dhuhr, Asr' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Saturday, October 3, 2026' })).toHaveFocus()
    expect(status('Dhuhr', 'Missed')).toBeChecked()

    // Made up: logged as late, it leaves the count.
    await user.click(status('Dhuhr', 'Late'))
    expect(screen.getByRole('button', { name: '2 missed prayers to make up' })).toBeInTheDocument()
  })

  it('brings the calendar to the month of a day in another month', async () => {
    seedLog({ '2026-08-20': { maghrib: 'missed' }, [TODAY]: all('ontime') })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '1 missed prayer to make up' }))
    await user.click(screen.getByRole('button', { name: 'Thursday, August 20, 2026: Maghrib' }))
    expect(screen.getByRole('grid', { name: 'August 2026' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { selected: true })).toContainElement(day('2026-08-20'))
  })
})

describe('all-time totals', () => {
  it('add up every prayer, sunnah prayer, azkar session and recitation', () => {
    const tick = AT('2026-10-09', '05:00:00')
    seedLog({ '2026-10-09': all('ontime'), '2026-10-10': { fajr: 'missed', dhuhr: 'late' }, '2026-10-20': all('ontime') })
    seedSunnah({ '2026-10-09': { beforeFajr: tick, witr: tick }, '2026-10-10': { duha: tick } })
    seedSessions(
      {
        '2026-10-09': { morning: completed('2026-10-09'), evening: completed('2026-10-09') },
        '2026-10-10': { morning: completed('2026-10-10') },
      },
      12_345,
    )
    renderPage()

    const totals = within(screen.getByRole('region', { name: 'All time' }))
    const figure = (label: string) => totals.getByText(label).closest('div')!.querySelector('dd')!
    // The future day is left out; the missed Fajr is logged but not prayed.
    expect(figure('Prayers prayed')).toHaveTextContent('6Logged in all: 7')
    expect(figure('Sunnah prayers')).toHaveTextContent(/^3$/)
    expect(figure('Azkar sessions completed')).toHaveTextContent('3Morning 2 · evening 1')
    expect(figure('Recitations')).toHaveTextContent('12,345')
  })
})

describe('the month breakdown', () => {
  const rowText = (prayer: string) =>
    [...document.querySelectorAll('li .visually-hidden')]
      .map((node) => node.textContent)
      .find((text) => text?.startsWith(prayer))

  it('spells out each prayer’s counts for screen readers', () => {
    seedLog({
      '2026-10-09': all('ontime'),
      '2026-10-10': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'missed', isha: 'excused' },
      [TODAY]: { fajr: 'missed' },
      // Other months and future days are not part of October so far.
      '2026-09-30': all('missed'),
      '2026-10-20': all('missed'),
    })
    renderPage()

    expect(rowText('Fajr')).toBe('Fajr: On time 2, Missed 1, Not logged 8')
    expect(rowText('Dhuhr')).toBe('Dhuhr: On time 1, Jamaah 1, Not logged 9')
    expect(rowText('Isha')).toBe('Isha: On time 1, Excused 1, Not logged 9')
  })

  it('gives the month’s totals in the legend, in figures', () => {
    seedLog({
      '2026-10-09': all('ontime'),
      '2026-10-10': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'missed', isha: 'excused' },
    })
    renderPage()

    const legend = screen.getByRole('list', { name: 'Totals for the month' })
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'On time6',
      'Jamaah1',
      'Late1',
      'Missed1',
      'Excused1',
    ])
  })

  it('follows the month on show', async () => {
    seedLog({ [TODAY]: all('ontime'), '2026-08-15': { fajr: 'late' } })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: 'September 2026 by prayer' })).toBeInTheDocument()
    expect(screen.getByText('Nothing logged in this month.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: 'August 2026 by prayer' })).toBeInTheDocument()
    expect(rowText('Fajr')).toBe('Fajr: Late 1, Not logged 30')
  })
})

describe('in Arabic', () => {
  beforeEach(() => {
    setLanguage('ar')
  })

  it('welcomes a new user', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'السجل' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'من هنا يبدأ سجلّك' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'الأحد، ١١ أكتوبر ٢٠٢٦' })).toBeInTheDocument()
  })

  it('pluralises days and formats figures with the chosen digits', () => {
    seedLog(span('2026-10-10', TODAY))
    const { unmount } = renderPage()

    expect(tile('السلسلة الحالية')).toHaveTextContent('يومان')
    expect(rate('الصلوات المفروضة', 7)).toHaveTextContent('أُدِّيت ١٠ من ١٠')
    expect(rate('الصلوات المفروضة', 7)).toHaveTextContent('١٠٠')
    expect(screen.getByRole('columnheader', { name: 'آخر ٣٠ يومًا' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'آخر ٧ أيام و٣٠ يومًا' })).toBeInTheDocument()
    unmount()

    useSettings.setState({ arabicDigits: false })
    seedLog(span('2026-10-01', TODAY))
    renderPage()
    expect(tile('السلسلة الحالية')).toHaveTextContent('11 يومًا')
    expect(screen.getByRole('columnheader', { name: 'آخر 7 أيام' })).toBeInTheDocument()
  })

  it('logs from the day panel', async () => {
    const user = userEvent.setup()
    renderPage()

    const group = screen.getByRole('radiogroup', { name: 'حالة صلاة الفجر' })
    await user.click(within(group).getByRole('radio', { name: 'قضاء' }))
    expect(entries()).toEqual({ [TODAY]: { fajr: 'late' } })
    expect(screen.getByRole('button', { name: 'مسح تسجيل صلاة الفجر' })).toHaveTextContent('مسح')
  })

  it('names the missed prayers with the right plural, and the totals in Arabic digits', () => {
    seedLog({ '2026-10-09': { fajr: 'missed', dhuhr: 'missed' }, [TODAY]: all('ontime') })
    seedSessions({}, 12_345)
    renderPage()

    expect(screen.getByRole('button', { name: 'صلاتان فائتتان للقضاء' })).toBeInTheDocument()
    const totals = within(screen.getByRole('region', { name: 'منذ البداية' }))
    expect(totals.getByText('مرات الذكر').closest('div')!.querySelector('dd')).toHaveTextContent('١٢٬٣٤٥')
    expect(streak('الوتر', 'سلاسل أخرى')).toHaveTextContent('٠ يوم، والأطول ٠ يوم')
  })
})

describe('LogRoutes', () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="log/*" element={<LogRoutes />} />
        </Routes>
      </MemoryRouter>,
    )

  it('serves the log at /log', () => {
    renderAt('/log')
    expect(screen.getByRole('heading', { level: 1, name: 'Log' })).toBeInTheDocument()
  })

  it('sends unknown sub-paths back to the log', () => {
    renderAt('/log/2026/whatever')
    expect(screen.getByRole('heading', { level: 1, name: 'Log' })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toBeInTheDocument()
  })
})
