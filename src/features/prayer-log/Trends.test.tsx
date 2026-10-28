import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { DateKey } from '../../shared/types'
import type { SessionRecord } from '../azkar'
import { freezeToday, resetApp, seedLog, seedSessions, seedSunnah, setLanguage } from './test-utils'
import { Trends } from './Trends'
import type { DayLog, LogEntries } from './types'

const TODAY = '2026-10-11'
const tick = Date.parse(`${TODAY}T05:00:00Z`)
const ALL: DayLog = Object.fromEntries(PRAYERS.map((prayer) => [prayer, 'ontime'])) as DayLog

function span(from: DateKey, to: DateKey): LogEntries {
  const entries: LogEntries = {}
  for (let key = from; key <= to; key = shiftDateKey(key, 1)) entries[key] = ALL
  return entries
}

const record = (completed: boolean): SessionRecord => ({ completed, done: completed ? 2 : 1, total: 2, recitations: 4 })

function seed() {
  seedLog({
    '2026-09-30': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'missed' },
    ...span('2026-10-04', '2026-10-10'),
    [TODAY]: { fajr: 'ontime', dhuhr: 'missed' },
    // Days to come are not counted, even when a backup holds them.
    '2026-10-12': ALL,
  })
  seedSunnah({ '2026-10-05': { witr: tick }, '2026-10-06': { witr: tick, duha: tick }, '2026-10-13': { witr: tick } })
  seedSessions({
    '2026-10-04': { morning: record(true), evening: record(true) },
    '2026-10-05': { morning: record(true), sleep: record(true) },
    '2026-10-06': { evening: record(false) },
    [TODAY]: { morning: record(true) },
    '2026-10-12': { morning: record(true) },
  })
}

/** What a screen reader hears for each week of one chart, oldest first. */
const weeks = (title: string) =>
  within(screen.getByRole('figure', { name: title }))
    .getAllByRole('listitem')
    .map((week) => week.querySelector('.visually-hidden')?.textContent)

beforeEach(() => {
  freezeToday(TODAY)
})

afterEach(() => {
  resetApp()
})

describe('Trends', () => {
  it('explains what will appear before anything is recorded', () => {
    render(<Trends today={TODAY} hasRecord={false} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Last 8 weeks' })).toBeInTheDocument()
    expect(screen.getByText(/each of your last eight weeks will show here as a bar/)).toBeInTheDocument()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  })

  it('draws three charts of eight weeks, the last being this week', () => {
    seed()
    render(<Trends today={TODAY} hasRecord />)

    const charts = screen.getAllByRole('figure')
    expect(charts.map((chart) => chart.querySelector('figcaption span')?.textContent)).toEqual([
      'Obligatory prayers prayed',
      'Sunnah prayers',
      'Morning and evening azkar completed',
    ])
    for (const chart of charts) {
      const items = within(chart).getAllByRole('listitem')
      expect(items).toHaveLength(8)
      expect(items.map((item) => item.dataset.current)).toEqual([...Array(7).fill(undefined), 'true'])
    }
  })

  it('writes out every week’s figure for screen readers, against the most a week can hold', () => {
    seed()
    render(<Trends today={TODAY} hasRecord />)

    // English weeks begin on Sunday, so today, a Sunday, opens a new week.
    expect(weeks('Obligatory prayers prayed')).toEqual([
      'Week of August 23: 0 of 35',
      'Week of August 30: 0 of 35',
      'Week of September 6: 0 of 35',
      'Week of September 13: 0 of 35',
      'Week of September 20: 0 of 35',
      'Week of September 27: 3 of 35',
      'Week of October 4: 35 of 35',
      'This week so far, from October 11: 1',
    ])
    expect(weeks('Sunnah prayers').slice(-2)).toEqual(['Week of October 4: 3 of 56', 'This week so far, from October 11: 0'])
    // Bedtime azkar and a session not completed are left out.
    expect(weeks('Morning and evening azkar completed').slice(-2)).toEqual([
      'Week of October 4: 3 of 14',
      'This week so far, from October 11: 1',
    ])
  })

  it('draws each bar to scale, with its figure and the date its week begins', () => {
    seed()
    render(<Trends today={TODAY} hasRecord />)

    const chart = screen.getByRole('figure', { name: 'Obligatory prayers prayed' })
    expect(chart).toHaveTextContent('out of 35 a week')
    const [, , , , , september, october, current] = within(chart).getAllByRole('listitem')
    const fill = (week: HTMLElement | undefined) => week?.querySelector<HTMLElement>('[style]')?.style.getPropertyValue('--share')
    expect(fill(october)).toBe('1')
    expect(Number(fill(september))).toBeCloseTo(3 / 35)
    expect(Number(fill(current))).toBeCloseTo(1 / 35)
    expect(october).toHaveTextContent('3510/4')
    expect(current).toHaveTextContent('110/11')
    expect(screen.getByText(/starting on Sunday/)).toBeInTheDocument()
  })

  it('follows the week of the language: from Saturday in Arabic, with Arabic figures', () => {
    setLanguage('ar')
    seed()
    render(<Trends today={TODAY} hasRecord />)

    expect(screen.getByRole('heading', { level: 2, name: 'آخر ٨ أسابيع' })).toBeInTheDocument()
    expect(weeks('الصلوات المفروضة المؤدّاة').slice(-3)).toEqual([
      'أسبوع ٢٦ سبتمبر: ٣ من ٣٥',
      'أسبوع ٣ أكتوبر: ٣٠ من ٣٥',
      'هذا الأسبوع حتى الآن، منذ ١٠ أكتوبر: ٦',
    ])
    expect(screen.getByText(/يبدأ يوم السبت/)).toBeInTheDocument()
  })
})
