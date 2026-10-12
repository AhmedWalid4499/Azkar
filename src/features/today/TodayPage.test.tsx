import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/settings'
import { usePrayerLog } from '../prayer-log'
import { TodayPage } from './TodayPage'

const CAIRO: SavedLocation = {
  latitude: 30.044,
  longitude: 31.236,
  timeZone: 'Africa/Cairo',
  label: 'Cairo, Egypt',
  countryCode: 'EG',
  source: 'manual',
  updatedAt: 0,
}
const MAKKAH: SavedLocation = { ...CAIRO, latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh', label: 'Makkah', countryCode: 'SA' }

function renderToday(options: { location?: SavedLocation | null; settings?: Partial<AppSettings> } = {}) {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', ...options.settings })
  useLocationStore.setState({ location: options.location ?? null })
  return render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  )
}

/** Only `Date` is faked, so timers and user-event keep working. */
function setClock(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

const announcement = () => screen.getAllByRole('status').find((node) => /Location set|حُدِّد الموقع/.test(node.textContent ?? ''))

beforeEach(() => {
  usePrayerLog.setState({ entries: {} })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (navigator as { geolocation?: unknown }).geolocation
  useSettings.setState(DEFAULT_SETTINGS)
  useLocationStore.setState({ location: null })
  usePrayerLog.setState({ entries: {} })
})

describe('location link', () => {
  it('exposes the saved place in its accessible name, starting with the visible text', () => {
    renderToday({ location: CAIRO })

    const link = screen.getByRole('link', { name: /Cairo/ })
    expect(link).toHaveAccessibleName('Cairo, Egypt. Change location')
    expect(link).toHaveTextContent(/^Cairo, Egypt$/)
    expect(link).toHaveAttribute('href', '/settings')
    // The name keeps the language it was saved in and must set its own direction.
    expect(within(link).getByText('Cairo, Egypt')).toHaveAttribute('dir', 'auto')
  })

  it('shows coordinates for a place saved without a name', () => {
    renderToday({ location: { ...CAIRO, label: '' } })
    expect(screen.getByRole('link', { name: '30.04° N, 31.24° E. Change location' })).toHaveTextContent('30.04° N, 31.24° E')
  })

  it('says so when no location is set', () => {
    renderToday()
    expect(screen.getByRole('link', { name: 'Location not set. Change location' })).toHaveTextContent('Location not set')
  })

  it('is named in Arabic in the Arabic interface', () => {
    renderToday({ location: CAIRO, settings: { language: 'ar' } })
    expect(screen.getByRole('link', { name: 'Cairo, Egypt. تغيير الموقع' })).toBeInTheDocument()
  })
})

describe('setting the first location', () => {
  it('announces the outcome and moves the focus to what replaced the prompt', async () => {
    const user = userEvent.setup()
    // Offline: the position is saved, its name cannot be looked up.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: (position: { coords: { latitude: number; longitude: number } }) => void) =>
          success({ coords: { latitude: 30.0444196, longitude: 31.2357116 } }),
      },
    })
    renderToday()
    expect(announcement()).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Use my location' }))

    await waitFor(() => expect(announcement()).toHaveTextContent('Location set: 30.04° N, 31.24° E'))
    expect(screen.queryByRole('button', { name: 'Use my location' })).toBeNull()
    // Not left on <body> with the removed button: the focus is on the next-prayer card's container.
    const card = screen.getByRole('heading', { name: 'Next prayer' }).closest('section')!
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toContainElement(card)
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
  })

  it('does the same when a city is picked in the search sheet, which goes away with the prompt', async () => {
    const user = userEvent.setup()
    const cairo = { id: 360630, name: 'Cairo', latitude: 30.06263, longitude: 31.24967, country_code: 'EG', timezone: 'Africa/Cairo', country: 'Egypt' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [cairo] }) }))
    renderToday()

    await user.click(screen.getByRole('button', { name: 'Search for a city' }))
    const sheet = await screen.findByRole('dialog', { name: 'Search for a city' })
    await user.type(within(sheet).getByRole('searchbox'), 'Cairo')
    await user.click(await within(sheet).findByRole('button', { name: /Egypt/ }))

    await waitFor(() => expect(announcement()).toHaveTextContent('Location set: Cairo, Egypt'))
    // The sheet and the button that opened it are both gone; the focus is not left behind with them.
    expect(screen.queryByRole('dialog', { name: 'Search for a city' })).toBeNull()
    const card = screen.getByRole('heading', { name: 'Next prayer' }).closest('section')!
    expect(document.activeElement).toContainElement(card)
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
  })

  it('follows the name when the lookup answers, then clears the announcement', async () => {
    vi.useFakeTimers()
    renderToday()

    act(() => useLocationStore.getState().setLocation({ ...CAIRO, label: '30.04° N, 31.24° E' }))
    expect(announcement()).toHaveTextContent('Location set: 30.04° N, 31.24° E')

    act(() => useLocationStore.getState().setLocation(CAIRO))
    expect(announcement()).toHaveTextContent('Location set: Cairo, Egypt')

    act(() => void vi.advanceTimersByTime(6000))
    expect(announcement()).toBeUndefined()
  })

  it('announces it in Arabic in the Arabic interface', () => {
    renderToday({ settings: { language: 'ar' } })
    act(() => useLocationStore.getState().setLocation(CAIRO))
    // Worded like the other notices about the location ("حُفظ الموقع").
    expect(announcement()).toHaveTextContent('حُدِّد الموقع: Cairo, Egypt')
  })

  it('stays quiet and leaves the focus alone when a location is already saved', () => {
    renderToday({ location: CAIRO })
    expect(announcement()).toBeUndefined()
    expect(document.body).toHaveFocus()

    // Changing an existing location is not the first-run flow either.
    act(() => useLocationStore.getState().setLocation(MAKKAH))
    expect(announcement()).toBeUndefined()
    expect(document.body).toHaveFocus()
  })
})

describe('last night’s Isha', () => {
  const lastNight = () => screen.queryByRole('group', { name: /Last night’s Isha/ })
  const todaysIsha = () => {
    const list = screen.getByRole('list')
    return within(list).getByRole('button', { name: /^Isha:/ })
  }

  it('is offered after midnight and files the prayer under yesterday', async () => {
    // 00:20 on Tuesday 13 October in Makkah; Fajr is at 04:59.
    setClock('2026-10-12T21:20:00Z')
    usePrayerLog.setState({
      entries: { '2026-10-12': { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime' } },
    })
    renderToday({ location: MAKKAH })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tuesday, October 13')

    const row = lastNight()!
    expect(row).toHaveAccessibleName('Last night’s Isha Counts for Monday, October 12')
    const unlogged = todaysIsha().getAttribute('aria-label')
    await userEvent.click(within(row).getByRole('button', { name: /^Isha:/ }))

    // Filed under the 12th, completing it; tonight's Isha is a different prayer and is still to come.
    expect(usePrayerLog.getState().entries).toEqual({
      '2026-10-12': { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime', isha: 'ontime' },
    })
    expect(todaysIsha()).toHaveAccessibleName(unlogged!)

    // The tap shows its result, keeps the focus and can be corrected for the rest of the visit.
    const logged = within(lastNight()!).getByRole('button', { name: /^Isha:/ })
    expect(logged).toHaveFocus()
    expect(logged).not.toHaveAccessibleName(unlogged!)
  })

  it('is not shown again once that Isha is logged', () => {
    setClock('2026-10-12T21:20:00Z')
    usePrayerLog.setState({ entries: { '2026-10-12': { isha: 'late' } } })
    renderToday({ location: MAKKAH })
    expect(lastNight()).toBeNull()
  })

  it('is gone after Fajr and during the day', () => {
    usePrayerLog.setState({ entries: {} })
    setClock('2026-10-13T02:05:00Z') // 05:05, after Fajr at 04:59
    const { unmount } = renderToday({ location: MAKKAH })
    expect(lastNight()).toBeNull()
    unmount()

    setClock('2026-10-13T17:00:00Z') // 20:00
    renderToday({ location: MAKKAH })
    expect(lastNight()).toBeNull()
  })

  it('comes and goes with the clock while the page stays open', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T20:59:30Z')) // 23:59:30 on Monday the 12th
    renderToday({ location: MAKKAH })
    expect(lastNight()).toBeNull()

    // Midnight: the timetable moves on to Tuesday, and Monday's Isha is the one still open.
    act(() => void vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tuesday, October 13')
    expect(lastNight()).toHaveAccessibleName('Last night’s Isha Counts for Monday, October 12')

    // Looked at again after Fajr (04:59): returning to the tab reads the clock afresh.
    vi.setSystemTime(new Date('2026-10-13T02:00:00Z'))
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(lastNight()).toBeNull()
  })

  it('needs a location, like the rest of the timetable', () => {
    setClock('2026-10-12T21:20:00Z')
    renderToday()
    expect(lastNight()).toBeNull()
  })

  it('is labelled in Arabic in the Arabic interface', () => {
    setClock('2026-10-12T21:20:00Z')
    renderToday({ location: MAKKAH, settings: { language: 'ar', arabicDigits: false } })
    expect(screen.getByRole('group', { name: /عشاء الليلة الماضية/ })).toHaveTextContent('من صلوات يوم الاثنين، 12 أكتوبر')
  })
})
