import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { NextPrayerCard } from './NextPrayerCard'
import { CAIRO, resetStores, TROMSO, zonedInstant } from './test-helpers'

const TODAY = '2026-10-12'
const cairo = (clock: string, dateKey = TODAY) => zonedInstant(dateKey, clock, 'Africa/Cairo')

function renderCard() {
  return render(
    <MemoryRouter>
      <NextPrayerCard />
    </MemoryRouter>,
  )
}

/** What a sighted user sees ticking: hidden from assistive tech. */
function countdown(): string {
  const digits = Array.from(document.querySelectorAll('[aria-hidden="true"] [dir="ltr"]'))
  expect(digits).toHaveLength(1)
  return digits[0]?.textContent ?? ''
}

beforeEach(() => {
  vi.useFakeTimers()
  // Cairo that day: Fajr 05:28, sunrise 06:55, Dhuhr 12:43, Asr 15:59, Maghrib 18:28, Isha 19:45.
  vi.setSystemTime(cairo('14:46:55'))
  resetStores({ location: CAIRO })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NextPrayerCard', () => {
  it('names the next prayer, its time and how long is left', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: 'Next prayer' })).toBeInTheDocument()
    expect(screen.getByText('Asr')).toBeInTheDocument()
    expect(screen.getByText('15:59')).toBeInTheDocument()
    expect(countdown()).toBe('1:12:05')
    expect(screen.getByText('It is Dhuhr time now')).toBeInTheDocument()
  })

  it('ticks every second', () => {
    renderCard()
    act(() => void vi.advanceTimersByTime(1_000))
    expect(countdown()).toBe('1:12:04')
    act(() => void vi.advanceTimersByTime(65_000))
    expect(countdown()).toBe('1:10:59')
  })

  it('hides the ticking text from screen readers and gives them a sentence to the minute', () => {
    renderCard()
    const digits = document.querySelector('[dir="ltr"]')
    expect(digits?.closest('[aria-hidden="true"]')).not.toBeNull()

    const sentence = screen.getByText('Asr at 15:59, in 1 hour and 12 minutes.')
    expect(sentence).toHaveClass('visually-hidden')
    expect(sentence.closest('[aria-hidden="true"]')).toBeNull()
    expect(sentence.closest('[aria-live]')).toBeNull()

    // Fifty seconds on it reads the same; only the minute boundary changes it.
    act(() => void vi.advanceTimersByTime(4_000))
    expect(screen.getByText('Asr at 15:59, in 1 hour and 12 minutes.')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(2_000))
    expect(screen.getByText('Asr at 15:59, in 1 hour and 11 minutes.')).toBeInTheDocument()
  })

  it('phrases short and whole-hour waits naturally', () => {
    vi.setSystemTime(cairo('15:58:30'))
    renderCard()
    expect(screen.getByText('Asr at 15:59, in less than a minute.')).toBeInTheDocument()
    expect(countdown()).toBe('0:00:30')

    act(() => void vi.setSystemTime(cairo('17:28:00')))
    act(() => void vi.advanceTimersByTime(1_000))
    expect(screen.getByText('Maghrib at 18:28, in 59 minutes.')).toBeInTheDocument()
  })

  it('moves to the following prayer at the moment one begins, and announces it once', () => {
    vi.setSystemTime(cairo('15:58:58'))
    renderCard()
    const live = document.querySelector('[aria-live="polite"]')
    expect(live).toBeEmptyDOMElement()

    act(() => void vi.advanceTimersByTime(3_000))
    expect(screen.getByText('Maghrib')).toBeInTheDocument()
    expect(screen.getByText('It is Asr time now')).toBeInTheDocument()
    expect(live).toHaveTextContent('Next prayer: Maghrib at 18:28')

    // The announcement does not change again with the clock.
    act(() => void vi.advanceTimersByTime(120_000))
    expect(live).toHaveTextContent('Next prayer: Maghrib at 18:28')
  })

  it('shows tomorrow’s Fajr after Isha and says it is tomorrow', () => {
    vi.setSystemTime(cairo('21:00:00'))
    renderCard()
    expect(screen.getByText('Fajr')).toBeInTheDocument()
    expect(screen.getByText('05:29')).toBeInTheDocument()
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
    expect(countdown()).toBe('8:29:00')
    expect(screen.getByText('Fajr tomorrow at 05:29, in 8 hours and 29 minutes.')).toBeInTheDocument()
    expect(screen.getByText('It is Isha time now')).toBeInTheDocument()
  })

  it('drops "tomorrow" once midnight has passed', () => {
    vi.setSystemTime(cairo('00:30:00', '2026-10-13'))
    renderCard()
    expect(screen.getByText('Fajr')).toBeInTheDocument()
    expect(screen.queryByText('Tomorrow')).toBeNull()
    expect(screen.getByText('Fajr at 05:29, in 4 hours and 59 minutes.')).toBeInTheDocument()
  })

  it('says nothing about a current period between sunrise and Dhuhr', () => {
    vi.setSystemTime(cairo('09:00:00'))
    renderCard()
    expect(screen.getByText('Dhuhr')).toBeInTheDocument()
    expect(screen.queryByText(/time now/)).toBeNull()
  })

  it('uses the 12-hour clock when chosen', () => {
    resetStores({ location: CAIRO, settings: { timeFormat: '12h' } })
    renderCard()
    expect(screen.getByText(/^3:59\sPM$/)).toBeInTheDocument()
  })

  describe('in Arabic', () => {
    it('renders names, digits and plural forms in Arabic, keeping the countdown left-to-right', () => {
      resetStores({ location: CAIRO, settings: { language: 'ar', timeFormat: '12h' } })
      renderCard()
      expect(screen.getByRole('heading', { name: 'الصلاة القادمة' })).toBeInTheDocument()
      expect(screen.getByText('العصر')).toBeInTheDocument()
      expect(countdown()).toBe('١:١٢:٠٥')
      expect(screen.getByText('صلاة العصر في الساعة ٣:٥٩ م، أي بعد ساعة واحدة و١٢ دقيقة.')).toBeInTheDocument()
      expect(screen.getByText('الآن وقت الظهر')).toBeInTheDocument()
    })

    it('picks the dual and the few forms', () => {
      resetStores({ location: CAIRO, settings: { language: 'ar', timeFormat: '24h' } })
      vi.setSystemTime(cairo('13:56:30'))
      renderCard()
      expect(screen.getByText('صلاة العصر في الساعة ١٥:٥٩، أي بعد ساعتين ودقيقتين.')).toBeInTheDocument()
      act(() => void vi.setSystemTime(cairo('12:50:30')))
      act(() => void vi.advanceTimersByTime(1_000))
      expect(screen.getByText('صلاة العصر في الساعة ١٥:٥٩، أي بعد ٣ ساعات و٨ دقائق.')).toBeInTheDocument()
    })
  })

  describe('when there is nothing to count down to', () => {
    it('counts down to the times that do exist on a polar day, without a broken one', () => {
      // Midnight sun in Tromsø: only Dhuhr and Asr can be computed.
      vi.setSystemTime(zonedInstant('2026-06-21', '20:00', 'Europe/Oslo'))
      resetStores({ location: TROMSO })
      renderCard()
      expect(screen.getByText('Dhuhr')).toBeInTheDocument()
      expect(screen.getByText('Tomorrow')).toBeInTheDocument()
      expect(countdown()).toMatch(/^16:\d\d:\d\d$/)
      expect(screen.queryByText(/time now/)).toBeNull()
      expect(document.body).not.toHaveTextContent(/invalid|NaN/i)
    })

    it('does not call it Asr time before sunrise on a day the sun barely rises', () => {
      // 24 November in Tromsø: sunrise 10:32, Dhuhr 11:32, sunset 12:29. adhan alone puts Asr at 08:31.
      vi.setSystemTime(zonedInstant('2026-11-24', '08:40', 'Europe/Oslo'))
      resetStores({ location: TROMSO })
      renderCard()
      expect(screen.getByText('Dhuhr')).toBeInTheDocument()
      expect(screen.getByText('11:32')).toBeInTheDocument()
      expect(screen.queryByText(/time now/)).toBeNull()
      expect(document.body).not.toHaveTextContent(/invalid|NaN/i)
    })

    it('asks for the location again when the saved one is unusable', () => {
      useLocationStore.setState({ location: { ...CAIRO, latitude: 'north' } as unknown as SavedLocation })
      renderCard()
      expect(screen.getByText('The saved location can’t be read. Please set it again.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/settings')
      expect(document.body).not.toHaveTextContent(/invalid|NaN/i)
    })
  })
})
