import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatHijri, shiftDateKey } from '../../shared/date'
import { useSettings } from '../../shared/settings'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerDay } from '../../shared/types'
import { LogPage } from './LogPage'
import { LogRoutes } from './LogRoutes'
import { usePrayerLog } from './store'
import { freezeToday, resetApp, seedLog, setLanguage } from './test-utils'
import type { DayLog, LogEntries, PrayerStatus } from './types'

// The timetable belongs to another feature; only its `usePrayerDay` contract is used here.
const timetable = vi.hoisted(() => ({ forDay: (_dateKey?: string): PrayerDay | null => null }))
vi.mock('../prayer-times', () => ({ usePrayerDay: (dateKey?: string) => timetable.forDay(dateKey) }))

const TODAY = '2026-10-11'

function all(status: PrayerStatus): DayLog {
  return Object.fromEntries(PRAYERS.map((prayer) => [prayer, status])) as DayLog
}

function span(from: DateKey, to: DateKey, log: DayLog = all('ontime')): LogEntries {
  const entries: LogEntries = {}
  for (let key = from; key <= to; key = shiftDateKey(key, 1)) entries[key] = log
  return entries
}

const entries = () => usePrayerLog.getState().entries
const day = (dateKey: DateKey) =>
  screen.getByRole('grid').querySelector<HTMLButtonElement>(`button[data-date="${dateKey}"]`)!
const status = (prayer: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: `${prayer} status` })).getByRole('radio', { name })
/** The figure shown under a stat's label. */
const stat = (label: string) => screen.getByText(label).closest('div')!.querySelector('dd')!

beforeEach(() => {
  freezeToday(TODAY)
})

afterEach(() => {
  resetApp()
  timetable.forDay = () => null
})

describe('for a first-time user', () => {
  it('welcomes them instead of showing empty statistics', () => {
    render(<LogPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Prayer log' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your log begins here' })).toBeInTheDocument()
    expect(screen.queryByText('Current streak')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /by prayer$/ })).not.toBeInTheDocument()
  })

  it('still lets them start logging straight away, on today', () => {
    render(<LogPage />)

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
    render(<LogPage />)

    await user.click(status('Fajr', 'On time'))

    expect(entries()).toEqual({ [TODAY]: { fajr: 'ontime' } })
    expect(screen.queryByRole('heading', { name: 'Your log begins here' })).not.toBeInTheDocument()
    expect(screen.getByText('Current streak')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'October 2026 by prayer' })).toBeInTheDocument()
    expect(day(TODAY)).toHaveAccessibleName('Today, Sunday, October 11, 2026, 1 of 5 logged')
  })
})

describe('the day panel', () => {
  it('offers all five statuses for each of the five prayers', () => {
    render(<LogPage />)
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
    render(<LogPage />)

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
    render(<LogPage />)

    status('Fajr', 'On time').focus()
    await user.keyboard('{ArrowRight}')
    expect(entries()[TODAY]).toEqual({ fajr: 'jamaah' })
    expect(status('Fajr', 'Jamaah')).toHaveFocus()
  })

  it('clears an entry and hands focus back to the choices', async () => {
    seedLog({ [TODAY]: { fajr: 'ontime', asr: 'late' } })
    const user = userEvent.setup()
    render(<LogPage />)

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
    render(<LogPage />)

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
    render(<LogPage />)

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
    const row = (prayer: string) => screen.getByRole('heading', { level: 3, name: prayer }).closest('li')!

    it('are left out when the timetable is not available', () => {
      render(<LogPage />)
      expect(row('Fajr')).not.toHaveTextContent(/\d:\d\d/)
    })

    it('are shown in the timetable zone and the chosen clock format', () => {
      timetable.forDay = (dateKey) => cairo(dateKey ?? TODAY)
      const { unmount } = render(<LogPage />)
      expect(within(row('Fajr')).getByText(/^5:05\sAM$/)).toBeInTheDocument()
      expect(within(row('Isha')).getByText(/^7:45\sPM$/)).toBeInTheDocument()
      unmount()

      useSettings.setState({ timeFormat: '24h' })
      render(<LogPage />)
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
      render(<LogPage />)
      await user.click(day('2026-10-03'))
      expect(asked).toContain(TODAY)
      expect(asked.at(-1)).toBe('2026-10-03')
    })

    it('are not shown when the timetable on hand is for another day', () => {
      timetable.forDay = () => cairo('2026-10-10')
      render(<LogPage />)
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
    render(<LogPage />)

    expect(stat('Current streak')).toHaveTextContent('3 days')
    expect(stat('Best streak')).toHaveTextContent('10 days')
    // 5 to 7 October were not logged; today counts only its two logged prayers.
    expect(stat('Last 7 days')).toHaveTextContent('50%')
    expect(stat('Last 7 days')).toHaveTextContent('16 of 32 prayed')
    // 12 September onwards: 26 unlogged days, three full ones and today's two.
    expect(stat('Last 30 days')).toHaveTextContent('10%')
    expect(stat('Last 30 days')).toHaveTextContent('16 of 147 prayed')
  })

  it('uses the singular for a one-day streak', () => {
    seedLog({ [TODAY]: all('jamaah') })
    render(<LogPage />)
    expect(stat('Current streak')).toHaveTextContent(/^1 day$/)
    expect(stat('Last 7 days')).toHaveTextContent('100%')
  })

  it('says so plainly when there is nothing to measure, as when every day was excused', () => {
    seedLog(span('2026-10-09', TODAY, all('excused')))
    render(<LogPage />)

    expect(stat('Current streak')).toHaveTextContent('0 days')
    expect(stat('Last 7 days')).toHaveTextContent('Nothing to measure yet')
    expect(stat('Last 7 days')).not.toHaveTextContent('%')
  })

  it('updates as prayers are logged', async () => {
    seedLog({
      ...span('2026-10-09', '2026-10-10'),
      [TODAY]: { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime' },
    })
    const user = userEvent.setup()
    render(<LogPage />)
    expect(stat('Current streak')).toHaveTextContent('2 days')

    await user.click(status('Isha', 'Late'))
    expect(stat('Current streak')).toHaveTextContent('3 days')

    // A missed prayer today is shown, but does not undo the days before it.
    await user.click(status('Isha', 'Missed'))
    expect(stat('Current streak')).toHaveTextContent('2 days')
    expect(stat('Best streak')).toHaveTextContent('2 days')
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
    render(<LogPage />)

    expect(rowText('Fajr')).toBe('Fajr: On time 2, Missed 1, Not logged 8')
    expect(rowText('Dhuhr')).toBe('Dhuhr: On time 1, Jamaah 1, Not logged 9')
    expect(rowText('Isha')).toBe('Isha: On time 1, Excused 1, Not logged 9')
  })

  it('gives the month’s totals in the legend, in figures', () => {
    seedLog({
      '2026-10-09': all('ontime'),
      '2026-10-10': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'missed', isha: 'excused' },
    })
    render(<LogPage />)

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
    render(<LogPage />)

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
    render(<LogPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'سجل الصلاة' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'من هنا يبدأ سجلّك' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'الأحد، ١١ أكتوبر ٢٠٢٦' })).toBeInTheDocument()
  })

  it('pluralises days and formats figures with the chosen digits', () => {
    seedLog(span('2026-10-10', TODAY))
    const { unmount } = render(<LogPage />)

    expect(stat('السلسلة الحالية')).toHaveTextContent('يومان')
    expect(stat('آخر ٧ أيام')).toHaveTextContent('أُدِّيت ١٠ من ١٠')
    expect(stat('آخر ٧ أيام')).toHaveTextContent('١٠٠')
    expect(screen.getByText('آخر ٣٠ يومًا')).toBeInTheDocument()
    unmount()

    useSettings.setState({ arabicDigits: false })
    seedLog(span('2026-10-01', TODAY))
    render(<LogPage />)
    expect(stat('السلسلة الحالية')).toHaveTextContent('11 يومًا')
    expect(screen.getByText('آخر 7 أيام')).toBeInTheDocument()
  })

  it('logs from the day panel', async () => {
    const user = userEvent.setup()
    render(<LogPage />)

    const group = screen.getByRole('radiogroup', { name: 'حالة صلاة الفجر' })
    await user.click(within(group).getByRole('radio', { name: 'قضاء' }))
    expect(entries()).toEqual({ [TODAY]: { fajr: 'late' } })
    expect(screen.getByRole('button', { name: 'مسح تسجيل صلاة الفجر' })).toHaveTextContent('مسح')
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
    expect(screen.getByRole('heading', { level: 1, name: 'Prayer log' })).toBeInTheDocument()
  })

  it('sends unknown sub-paths back to the log', () => {
    renderAt('/log/2026/whatever')
    expect(screen.getByRole('heading', { level: 1, name: 'Prayer log' })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toBeInTheDocument()
  })
})
