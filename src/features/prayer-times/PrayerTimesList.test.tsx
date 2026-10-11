import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrayerTimesStore } from './config'
import { PrayerTimesList } from './PrayerTimesList'
import { CAIRO, resetStores, restoreDeviceZone, setDeviceZone, TROMSO, zonedInstant } from './test-helpers'

const TODAY = '2026-10-12'

function rows() {
  return screen.getAllByRole('listitem')
}

function rowTexts() {
  return rows().map((row) => row.textContent)
}

beforeEach(() => {
  vi.useFakeTimers()
  // Cairo that day: Fajr 05:28, sunrise 06:55, Dhuhr 12:43, Asr 15:59, Maghrib 18:28, Isha 19:45.
  vi.setSystemTime(zonedInstant(TODAY, '14:00', 'Africa/Cairo'))
  resetStores({ location: CAIRO })
})

afterEach(() => {
  vi.useRealTimers()
  restoreDeviceZone()
})

describe('PrayerTimesList', () => {
  it('lists the six times in order, in the location’s zone and 24-hour clock', () => {
    // A device on the far side of the world must not shift what Cairo's clocks say.
    setDeviceZone('Pacific/Auckland')
    render(<PrayerTimesList dateKey="2026-10-15" />)
    expect(rowTexts()).toEqual(['Fajr05:30', 'Sunrise06:57', 'Dhuhr12:42', 'Asr15:57', 'Maghrib18:24', 'Isha19:42'])
  })

  it('switches to a 12-hour clock with the setting', () => {
    resetStores({ location: CAIRO, settings: { timeFormat: '12h' } })
    render(<PrayerTimesList dateKey="2026-10-15" />)
    const [fajr, , , asr] = rowTexts()
    expect(fajr).toMatch(/^Fajr5:30\sAM$/)
    expect(asr).toMatch(/^Asr3:57\sPM$/)
  })

  it('carries machine-readable instants', () => {
    render(<PrayerTimesList dateKey="2026-10-15" />)
    const dhuhr = within(rows()[2] as HTMLElement).getByText('12:42')
    expect(dhuhr.tagName).toBe('TIME')
    expect(dhuhr).toHaveAttribute('datetime', '2026-10-15T09:42:00.000Z')
  })

  it('renders nothing until a location is saved', () => {
    resetStores()
    const { container } = render(<PrayerTimesList dateKey={TODAY} />)
    expect(container).toBeEmptyDOMElement()
  })

  describe('trailing slot', () => {
    it('is filled for the five prayers and left empty, but present, for sunrise', () => {
      const renderTrailing = vi.fn((prayer: string) => <button type="button">log {prayer}</button>)
      render(<PrayerTimesList dateKey={TODAY} renderTrailing={renderTrailing} />)

      expect(renderTrailing.mock.calls.map(([prayer]) => prayer)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
        'log fajr',
        'log dhuhr',
        'log asr',
        'log maghrib',
        'log isha',
      ])

      const [fajr, sunrise] = rows() as [HTMLElement, HTMLElement]
      expect(within(sunrise).queryByRole('button')).toBeNull()
      // Same number of cells on every row, so the time column cannot shift.
      expect(sunrise.children).toHaveLength(fajr.children.length)
      expect(sunrise.lastElementChild).toBeEmptyDOMElement()
    })

    it('keeps the cell when the control renders nothing yet', () => {
      render(<PrayerTimesList dateKey={TODAY} renderTrailing={() => null} />)
      for (const row of rows()) expect(row.lastElementChild).toBeEmptyDOMElement()
      expect(rows().every((row) => row.children.length === (rows()[0] as HTMLElement).children.length)).toBe(true)
    })

    it('adds no cell when no control is asked for', () => {
      render(<PrayerTimesList dateKey={TODAY} />)
      for (const row of rows()) expect(row.lastElementChild?.tagName).toBe('TIME')
    })
  })

  describe('markers', () => {
    it('labels the current period and the next prayer in words on today’s list', () => {
      render(<PrayerTimesList dateKey={TODAY} />)
      const [fajr, sunrise, dhuhr, asr, maghrib, isha] = rows() as HTMLElement[]

      expect(within(dhuhr as HTMLElement).getByText('Now')).toBeInTheDocument()
      expect(dhuhr).toHaveAttribute('aria-current', 'time')
      expect(within(asr as HTMLElement).getByText('Next')).toBeInTheDocument()
      expect(asr).not.toHaveAttribute('aria-current')

      for (const row of [fajr, sunrise, maghrib, isha]) {
        expect(within(row as HTMLElement).queryByText(/^(Now|Next)$/)).toBeNull()
        expect(row).not.toHaveAttribute('aria-current')
      }
    })

    it('moves them when the next prayer arrives', () => {
      render(<PrayerTimesList dateKey={TODAY} />)
      act(() => void vi.advanceTimersByTime(2 * 60 * 60_000))
      const [, , dhuhr, asr, maghrib] = rows() as HTMLElement[]
      expect(within(dhuhr as HTMLElement).queryByText('Now')).toBeNull()
      expect(within(asr as HTMLElement).getByText('Now')).toBeInTheDocument()
      expect(within(maghrib as HTMLElement).getByText('Next')).toBeInTheDocument()
    })

    it('shows only "Now" on Isha once the next prayer is tomorrow’s Fajr', () => {
      vi.setSystemTime(zonedInstant(TODAY, '21:00', 'Africa/Cairo'))
      render(<PrayerTimesList dateKey={TODAY} />)
      expect(within(rows()[5] as HTMLElement).getByText('Now')).toBeInTheDocument()
      expect(screen.queryByText('Next')).toBeNull()
    })

    it('marks no current period between sunrise and Dhuhr', () => {
      vi.setSystemTime(zonedInstant(TODAY, '09:00', 'Africa/Cairo'))
      render(<PrayerTimesList dateKey={TODAY} />)
      expect(screen.queryByText('Now')).toBeNull()
      expect(within(rows()[2] as HTMLElement).getByText('Next')).toBeInTheDocument()
    })

    it('leaves other days unmarked', () => {
      render(<PrayerTimesList dateKey="2026-10-11" />)
      expect(screen.queryByText(/^(Now|Next)$/)).toBeNull()
      expect(document.querySelector('[aria-current]')).toBeNull()
    })

    it('does not re-render the rows on every tick', () => {
      const renderTrailing = vi.fn(() => null)
      render(<PrayerTimesList dateKey={TODAY} renderTrailing={renderTrailing} />)
      const calls = renderTrailing.mock.calls.length
      act(() => void vi.advanceTimersByTime(10_000))
      expect(renderTrailing).toHaveBeenCalledTimes(calls)
    })
  })

  describe('in Arabic', () => {
    beforeEach(() => resetStores({ location: CAIRO, settings: { language: 'ar', timeFormat: '12h' } }))

    it('uses Arabic names, Arabic-Indic digits and translated markers', () => {
      render(<PrayerTimesList dateKey={TODAY} />)
      const [fajr, sunrise, dhuhr, asr] = rows() as HTMLElement[]
      expect(fajr).toHaveTextContent('الفجر')
      expect(fajr).toHaveTextContent('٥:٢٨')
      expect(sunrise).toHaveTextContent('الشروق')
      expect(within(dhuhr as HTMLElement).getByText('الآن')).toBeInTheDocument()
      expect(within(asr as HTMLElement).getByText('التالية')).toBeInTheDocument()
      expect(asr).toHaveTextContent('٣:٥٩ م')
      expect(document.body).not.toHaveTextContent(/[0-9]/)
    })

    it('uses Latin digits when Arabic-Indic numerals are switched off', () => {
      resetStores({ location: CAIRO, settings: { language: 'ar', timeFormat: '24h', arabicDigits: false } })
      render(<PrayerTimesList dateKey={TODAY} />)
      expect(rows()[0]).toHaveTextContent('05:28')
    })
  })

  describe('where a time does not exist', () => {
    beforeEach(() => {
      vi.setSystemTime(zonedInstant('2026-06-21', '14:00', 'Europe/Oslo'))
      resetStores({ location: TROMSO })
    })

    it('shows a dash with a spoken label, never "Invalid Date", and points to the setting', () => {
      render(
        <MemoryRouter>
          <PrayerTimesList dateKey="2026-06-21" renderTrailing={(prayer) => <span>{prayer}</span>} />
        </MemoryRouter>,
      )
      const [fajr, sunrise, dhuhr, , maghrib, isha] = rows() as HTMLElement[]
      for (const row of [fajr, sunrise, maghrib, isha]) {
        expect(row).toHaveTextContent('—')
        expect(within(row as HTMLElement).getByText('Not available')).toBeInTheDocument()
      }
      expect(dhuhr).toHaveTextContent(/\d\d:\d\d/)
      expect(document.body).not.toHaveTextContent(/invalid/i)
      expect(document.body).not.toHaveTextContent('NaN')

      expect(screen.getByText(/can’t be calculated here today/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open the high-latitude settings' })).toHaveAttribute('href', '/settings')
    })

    it('fills the times in once the nearest-latitude option is on', () => {
      render(
        <MemoryRouter>
          <PrayerTimesList dateKey="2026-06-21" />
        </MemoryRouter>,
      )
      act(() => usePrayerTimesStore.getState().setPolar('nearestLatitude'))
      expect(screen.queryByText('Not available')).toBeNull()
      expect(screen.queryByRole('link')).toBeNull()
      for (const row of rows()) expect(row).toHaveTextContent(/\d\d:\d\d/)
    })
  })
})
