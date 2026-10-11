import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSettings } from '../../shared/settings'
import { PRAYERS } from '../../shared/types'
import type { DateKey, Lang } from '../../shared/types'
import { monthOfDateKey } from './calendar'
import type { MonthRef } from './calendar'
import { MonthCalendar } from './MonthCalendar'
import { resetApp, seedLog, setLanguage } from './test-utils'
import type { DayLog, PrayerStatus } from './types'

const TODAY = '2026-10-11'

function all(status: PrayerStatus): DayLog {
  return Object.fromEntries(PRAYERS.map((prayer) => [prayer, status])) as DayLog
}

interface HarnessProps {
  today?: DateKey
  month?: MonthRef
}

/** Holds the state the log page normally owns. */
function Harness({ today = TODAY, month }: HarnessProps) {
  const [shown, setShown] = useState(month ?? monthOfDateKey(today))
  const [selected, setSelected] = useState(today)
  return (
    <MonthCalendar
      month={shown}
      today={today}
      selected={selected}
      onSelect={setSelected}
      onMonthChange={setShown}
      onToday={() => {
        setShown(monthOfDateKey(today))
        setSelected(today)
      }}
    />
  )
}

function day(dateKey: DateKey): HTMLButtonElement {
  const button = screen.getByRole('grid').querySelector<HTMLButtonElement>(`button[data-date="${dateKey}"]`)
  if (!button) throw new Error(`No cell for ${dateKey}`)
  return button
}

/** The grid as rendered: weekday headers, then each week's cells as date keys (null for padding). */
function layout() {
  const [header, ...weeks] = within(screen.getByRole('grid')).getAllByRole('row')
  const headers = within(header!).getAllByRole('columnheader')
  return {
    short: headers.map((cell) => cell.querySelector('[aria-hidden]')?.textContent),
    long: headers.map((cell) => cell.querySelector('.visually-hidden')?.textContent),
    weeks: weeks.map((week) =>
      within(week)
        .getAllByRole('gridcell')
        .map((cell) => cell.querySelector('button')?.dataset.date ?? null),
    ),
  }
}

const title = () => screen.getByRole('heading', { level: 2 }).textContent
const tabStops = () => [...screen.getByRole('grid').querySelectorAll('button[tabindex="0"]')]

afterEach(() => {
  resetApp()
})

describe('layout', () => {
  it.each<[Lang, MonthRef, number, number]>([
    // October 2026 begins on a Thursday.
    ['en', { year: 2026, month: 10 }, 4, 5],
    ['ar', { year: 2026, month: 10 }, 5, 6],
    // February 2026 begins on a Sunday and is exactly four weeks long.
    ['en', { year: 2026, month: 2 }, 0, 4],
    ['ar', { year: 2026, month: 2 }, 1, 5],
    // August 2026 begins on a Saturday.
    ['en', { year: 2026, month: 8 }, 6, 6],
    ['ar', { year: 2026, month: 8 }, 0, 5],
  ])('in %s, lays out %o with %i leading blanks over %i weeks', (lang, month, blanks, rows) => {
    setLanguage(lang)
    render(<Harness today="2026-12-31" month={month} />)

    const { weeks } = layout()
    expect(weeks).toHaveLength(rows)
    for (const week of weeks) expect(week).toHaveLength(7)
    expect(weeks[0]!.findIndex((cell) => cell !== null)).toBe(blanks)

    const days = weeks.flat().filter((cell) => cell !== null)
    const pad = String(month.month).padStart(2, '0')
    expect(days[0]).toBe(`${month.year}-${pad}-01`)
    expect(days).toHaveLength(new Date(Date.UTC(month.year, month.month, 0)).getUTCDate())
    expect([...days].sort()).toEqual(days)
  })

  it('starts the English week on Sunday', () => {
    render(<Harness />)
    const { short, long, weeks } = layout()
    expect(short).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(long).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    // Sunday 11 October leads its week.
    expect(weeks[2]![0]).toBe('2026-10-11')
    expect(day('2026-10-01')).toHaveTextContent('1')
  })

  it('starts the Arabic week on Saturday, with Arabic names and digits', () => {
    setLanguage('ar')
    render(<Harness />)
    const { short, long, weeks } = layout()
    expect(short).toEqual(['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'])
    expect(long).toEqual(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'])
    expect(weeks[2]!.slice(0, 2)).toEqual(['2026-10-10', '2026-10-11'])
    expect(day('2026-10-01')).toHaveTextContent('١')
    expect(day('2026-10-31')).toHaveTextContent('٣١')
  })

  it('uses Latin digits in Arabic when the user prefers them', () => {
    setLanguage('ar')
    useSettings.setState({ arabicDigits: false })
    render(<Harness />)
    expect(day('2026-10-31')).toHaveTextContent('31')
  })

  it('shows the Gregorian month with the Hijri months it spans', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { level: 2, name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByText('Rabiʻ II – Jumada I 1448 AH')).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
  })

  it('applies the Hijri adjustment from settings to the month title', () => {
    useSettings.setState({ hijriOffset: 1 })
    render(<Harness today="2025-02-28" />)
    expect(screen.getByText('Shaʻban – Ramadan 1446 AH')).toBeInTheDocument()
  })

  it('writes the Hijri span in Arabic', () => {
    setLanguage('ar')
    render(<Harness />)
    expect(screen.getByRole('heading', { level: 2, name: 'أكتوبر ٢٠٢٦' })).toBeInTheDocument()
    expect(screen.getByText('ربيع الآخر – جمادى الأولى ١٤٤٨ هـ')).toBeInTheDocument()
  })
})

describe('day cells', () => {
  const marks = (dateKey: DateKey) =>
    [...day(dateKey).querySelectorAll<HTMLElement>('[data-status]')].map((mark) => mark.dataset.status)

  it('names each day with its full date and how much is logged', () => {
    seedLog({
      '2026-10-09': all('ontime'),
      '2026-10-10': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'missed' },
      [TODAY]: { fajr: 'late' },
    })
    render(<Harness />)

    expect(day('2026-10-01')).toHaveAccessibleName('Thursday, October 1, 2026, 0 of 5 logged')
    expect(day('2026-10-09')).toHaveAccessibleName('Friday, October 9, 2026, 5 of 5 logged')
    expect(day('2026-10-10')).toHaveAccessibleName('Saturday, October 10, 2026, 3 of 5 logged')
    expect(day(TODAY)).toHaveAccessibleName('Today, Sunday, October 11, 2026, 1 of 5 logged')
  })

  it('uses the right Arabic plural for each count', () => {
    setLanguage('ar')
    seedLog({
      '2026-10-08': { fajr: 'ontime', dhuhr: 'ontime' },
      '2026-10-09': all('ontime'),
      '2026-10-10': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'missed' },
      [TODAY]: { fajr: 'late' },
    })
    render(<Harness />)

    expect(day('2026-10-01')).toHaveAccessibleName('الخميس، ١ أكتوبر ٢٠٢٦، لم تُسجَّل أي صلاة')
    expect(day('2026-10-08')).toHaveAccessibleName('الخميس، ٨ أكتوبر ٢٠٢٦، سُجِّلت صلاتان من ٥')
    expect(day('2026-10-09')).toHaveAccessibleName('الجمعة، ٩ أكتوبر ٢٠٢٦، سُجِّلت ٥ صلوات من ٥')
    expect(day('2026-10-10')).toHaveAccessibleName('السبت، ١٠ أكتوبر ٢٠٢٦، سُجِّلت ٣ صلوات من ٥')
    expect(day(TODAY)).toHaveAccessibleName('اليوم، الأحد، ١١ أكتوبر ٢٠٢٦، سُجِّلت صلاة واحدة من ٥')
  })

  it('draws one mark per prayer, in order, by status', () => {
    seedLog({
      '2026-10-10': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'missed' },
      [TODAY]: { fajr: 'late', isha: 'excused' },
    })
    render(<Harness />)

    expect(marks('2026-10-10')).toEqual(['ontime', 'jamaah', 'missed', 'none', 'none'])
    expect(marks(TODAY)).toEqual(['late', 'none', 'none', 'none', 'excused'])
    expect(marks('2026-10-01')).toEqual(['none', 'none', 'none', 'none', 'none'])
  })

  it('marks today, and only today, as the current date', () => {
    render(<Harness />)
    expect(day(TODAY)).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('grid').querySelectorAll('[aria-current]')).toHaveLength(1)
  })

  it('makes future days inert and blank, even if a backup holds entries for them', () => {
    seedLog({ '2026-10-12': all('ontime') })
    render(<Harness />)

    const tomorrow = day('2026-10-12')
    expect(tomorrow).toBeDisabled()
    expect(tomorrow).toHaveAccessibleName('Monday, October 12, 2026, upcoming')
    expect(marks('2026-10-12')).toEqual(['none', 'none', 'none', 'none', 'none'])
    expect(day('2026-10-31')).toBeDisabled()
    expect(day(TODAY)).toBeEnabled()
    expect(day('2026-10-01')).toBeEnabled()
  })

  it('selects a day when it is clicked', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const selected = () => screen.getAllByRole('gridcell', { selected: true })

    expect(selected()).toHaveLength(1)
    expect(selected()[0]).toContainElement(day(TODAY))

    await user.click(day('2026-10-09'))
    expect(selected()).toHaveLength(1)
    expect(selected()[0]).toContainElement(day('2026-10-09'))
  })
})

describe('month navigation', () => {
  it('cannot go past the current month', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const next = screen.getByRole('button', { name: 'Next month' })

    expect(next).toHaveAttribute('aria-disabled', 'true')
    // Kept focusable, so focus is not thrown away when the limit is reached.
    expect(next).toBeEnabled()
    await user.click(next)
    expect(title()).toBe('October 2026')
  })

  it('goes back and comes forward again, stopping at the current month', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const previous = screen.getByRole('button', { name: 'Previous month' })
    const next = screen.getByRole('button', { name: 'Next month' })

    await user.click(previous)
    expect(title()).toBe('September 2026')
    expect(next).toHaveAttribute('aria-disabled', 'false')
    expect(layout().weeks.flat().filter(Boolean)).toHaveLength(30)

    await user.click(previous)
    expect(title()).toBe('August 2026')

    await user.click(next)
    await user.click(next)
    expect(title()).toBe('October 2026')
    expect(next).toHaveAttribute('aria-disabled', 'true')
    await user.click(next)
    expect(title()).toBe('October 2026')
  })

  it('crosses the year boundary', async () => {
    const user = userEvent.setup()
    render(<Harness today="2026-01-15" />)

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(title()).toBe('December 2025')
    expect(day('2025-12-31')).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(title()).toBe('January 2026')
  })

  it('offers a way back to today only when away from it, and lands focus on today', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(day('2026-09-15'))
    await user.click(screen.getByRole('button', { name: 'Back to today' }))

    expect(title()).toBe('October 2026')
    expect(screen.getByRole('gridcell', { selected: true })).toContainElement(day(TODAY))
    expect(day(TODAY)).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })

  it('also offers it when another day of the current month is selected', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(day('2026-10-03'))
    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByRole('gridcell', { selected: true })).toContainElement(day(TODAY))
  })

  it.each<[Lang, string, string]>([
    ['en', 'Previous month', 'lucide-chevron-left'],
    ['en', 'Next month', 'lucide-chevron-right'],
    ['ar', 'الشهر السابق', 'lucide-chevron-right'],
    ['ar', 'الشهر التالي', 'lucide-chevron-left'],
  ])('in %s, points the "%s" chevron the way the page reads', (lang, name, icon) => {
    setLanguage(lang)
    render(<Harness />)
    expect(screen.getByRole('button', { name }).querySelector('svg')).toHaveClass(icon)
  })
})

describe('keyboard navigation', () => {
  it('is a single tab stop, on today to begin with', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(tabStops()).toEqual([day(TODAY)])

    await user.tab()
    await user.tab()
    await user.tab()
    expect(day(TODAY)).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('grid')).not.toContainElement(document.activeElement as HTMLElement)
  })

  it('moves by day with the left and right arrows', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day('2026-10-07'))

    await user.keyboard('{ArrowLeft}')
    expect(day('2026-10-06')).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(day('2026-10-08')).toHaveFocus()
    // The tab stop follows focus, and there is still only one.
    expect(tabStops()).toEqual([day('2026-10-08')])
  })

  it('moves by week with the up and down arrows', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day('2026-10-09'))

    await user.keyboard('{ArrowUp}')
    expect(day('2026-10-02')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(day('2026-10-09')).toHaveFocus()
  })

  it('goes to the edges of the week with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day('2026-10-07'))

    await user.keyboard('{Home}')
    expect(day('2026-10-04')).toHaveFocus()
    await user.keyboard('{End}')
    expect(day('2026-10-10')).toHaveFocus()
  })

  it('never moves focus onto a future day', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day(TODAY))

    await user.keyboard('{ArrowRight}')
    expect(day(TODAY)).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(day(TODAY)).toHaveFocus()
    await user.keyboard('{End}')
    expect(day(TODAY)).toHaveFocus()
    await user.keyboard('{PageDown}')
    expect(day(TODAY)).toHaveFocus()
    expect(title()).toBe('October 2026')

    // A move that would overshoot stops on today.
    await user.click(day('2026-10-08'))
    await user.keyboard('{ArrowDown}')
    expect(day(TODAY)).toHaveFocus()
  })

  it('walks into the neighbouring month and brings the view along', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day('2026-10-01'))

    await user.keyboard('{ArrowLeft}')
    expect(title()).toBe('September 2026')
    expect(day('2026-09-30')).toHaveFocus()
    expect(tabStops()).toEqual([day('2026-09-30')])

    await user.keyboard('{ArrowRight}')
    expect(title()).toBe('October 2026')
    expect(day('2026-10-01')).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(title()).toBe('September 2026')
    expect(day('2026-09-24')).toHaveFocus()
  })

  it('changes month with PageUp and PageDown', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day(TODAY))

    await user.keyboard('{PageUp}')
    expect(title()).toBe('September 2026')
    expect(day('2026-09-11')).toHaveFocus()
    await user.keyboard('{PageUp}')
    expect(title()).toBe('August 2026')
    expect(day('2026-08-11')).toHaveFocus()
    await user.keyboard('{PageDown}{PageDown}')
    expect(title()).toBe('October 2026')
    expect(day(TODAY)).toHaveFocus()
  })

  it('selects the focused day with Enter or Space, and not before', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const selected = () => screen.getByRole('gridcell', { selected: true })
    await user.click(day(TODAY))

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(selected()).toContainElement(day(TODAY))
    await user.keyboard('{Enter}')
    expect(selected()).toContainElement(day('2026-10-09'))

    await user.keyboard('{ArrowUp}')
    await user.keyboard(' ')
    expect(selected()).toContainElement(day('2026-10-02'))
  })

  it('leaves modified arrows to the browser', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(day('2026-10-07'))

    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    expect(day('2026-10-07')).toHaveFocus()
  })

  describe('right to left', () => {
    it('swaps the left and right arrows, so left goes forward in time', async () => {
      setLanguage('ar')
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(day('2026-10-07'))

      await user.keyboard('{ArrowLeft}')
      expect(day('2026-10-08')).toHaveFocus()
      await user.keyboard('{ArrowRight}{ArrowRight}')
      expect(day('2026-10-06')).toHaveFocus()

      // Up and down are the same in both directions.
      await user.keyboard('{ArrowUp}')
      expect(title()).toBe('سبتمبر ٢٠٢٦')
      expect(day('2026-09-29')).toHaveFocus()
    })

    it('takes Home and End to the Saturday and the Friday', async () => {
      setLanguage('ar')
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(day('2026-10-07'))

      await user.keyboard('{Home}')
      expect(day('2026-10-03')).toHaveFocus()
      await user.keyboard('{End}')
      expect(day('2026-10-09')).toHaveFocus()
    })

    it('still stops at today', async () => {
      setLanguage('ar')
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(day(TODAY))

      await user.keyboard('{ArrowLeft}')
      expect(day(TODAY)).toHaveFocus()
    })
  })
})
