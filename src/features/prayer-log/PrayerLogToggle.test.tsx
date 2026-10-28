import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic } from '../../native'
import { PrayerLogToggle } from './PrayerLogToggle'
import { usePrayerLog } from './store'
import { freezeToday, resetApp, seedLog, setLanguage } from './test-utils'

// Haptics go through the app's native layer, which picks the system's feedback or the browser's vibration.
vi.mock('../../native', async (importOriginal) => ({ ...(await importOriginal<object>()), haptic: vi.fn() }))

const TODAY = '2026-10-11'
const YESTERDAY = '2026-10-10'
const TOMORROW = '2026-10-12'
/** The frozen clock: noon UTC on TODAY. */
const NOON = Date.parse(`${TODAY}T12:00:00Z`)

const entries = () => usePrayerLog.getState().entries
const loggedAt = () => usePrayerLog.getState().loggedAt

beforeEach(() => {
  vi.mocked(haptic).mockClear()
  freezeToday(TODAY)
})

afterEach(() => {
  resetApp()
})

describe('an unlogged prayer', () => {
  it('is logged as on time with a single tap, with a light haptic', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)

    const toggle = screen.getByRole('button', { name: 'Fajr: not logged. Mark as prayed on time.' })
    expect(toggle).toHaveAttribute('data-status', 'none')
    await user.click(toggle)

    expect(entries()).toEqual({ [TODAY]: { fajr: 'ontime' } })
    expect(haptic).toHaveBeenCalledExactlyOnceWith('tick')
    expect(screen.getByRole('status')).toHaveTextContent('Fajr logged as prayed on time.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const logged = screen.getByRole('button', { name: 'Fajr: On time. Change status.' })
    expect(logged).toHaveAttribute('data-status', 'ontime')
  })

  it('is logged just the same on a device without vibration', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="asr" dateKey={TODAY} />)
    expect('vibrate' in navigator).toBe(false)

    await user.click(screen.getByRole('button', { name: /^Asr: not logged/ }))
    expect(entries()).toEqual({ [TODAY]: { asr: 'ontime' } })
  })

  it('records when it was logged', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="asr" dateKey={TODAY} />)

    await user.click(screen.getByRole('button', { name: /^Asr: not logged/ }))
    expect(entries()).toEqual({ [TODAY]: { asr: 'ontime' } })
    expect(loggedAt()).toEqual({ [TODAY]: { asr: NOON } })
  })

  it('can be logged with the keyboard', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="maghrib" dateKey={TODAY} />)

    await user.tab()
    expect(screen.getByRole('button', { name: /^Maghrib: not logged/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(entries()).toEqual({ [TODAY]: { maghrib: 'ontime' } })
  })

  it('confirms the log to screen readers once, then falls silent', () => {
    // This one needs the timers faked too, not just the date, so it clicks synchronously.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    fireEvent.click(screen.getByRole('button', { name: /^Fajr: not logged/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Fajr logged as prayed on time.')

    act(() => {
      vi.advanceTimersByTime(3900)
    })
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement()

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: /^Fajr: On time/ })).toBeInTheDocument()
  })

  it('only changes its own prayer', async () => {
    const user = userEvent.setup()
    render(
      <>
        <PrayerLogToggle prayer="fajr" dateKey={TODAY} />
        <PrayerLogToggle prayer="dhuhr" dateKey={TODAY} />
        <PrayerLogToggle prayer="fajr" dateKey={YESTERDAY} />
      </>,
    )

    await user.click(screen.getByRole('button', { name: /^Dhuhr: not logged/ }))
    expect(entries()).toEqual({ [TODAY]: { dhuhr: 'ontime' } })
    expect(screen.getAllByRole('button', { name: /^Fajr: not logged/ })).toHaveLength(2)
  })
})

describe('a logged prayer', () => {
  beforeEach(() => {
    seedLog({ [TODAY]: { fajr: 'ontime', dhuhr: 'missed' } })
  })

  it('opens a sheet with every status instead of changing at once', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)

    await user.click(screen.getByRole('button', { name: 'Fajr: On time. Change status.' }))

    const sheet = screen.getByRole('dialog', { name: 'Fajr, Sunday, October 11' })
    const names = ['On time', 'Jamaah', 'Late', 'Missed', 'Excused']
    for (const name of names) expect(within(sheet).getByRole('button', { name })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'On time' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: 'Jamaah' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(sheet).getByRole('button', { name: 'Late' })).toHaveAccessibleDescription(
      'Made up after its time (qada)',
    )
    expect(entries()[TODAY]).toEqual({ fajr: 'ontime', dhuhr: 'missed' })
  })

  it.each([
    ['Jamaah', 'jamaah'],
    ['Late', 'late'],
    ['Missed', 'missed'],
    ['Excused', 'excused'],
  ] as const)('changes to %s through the sheet', async (name, status) => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)

    await user.click(screen.getByRole('button', { name: /^Fajr: On time/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name }))

    expect(entries()[TODAY]).toEqual({ fajr: status, dhuhr: 'missed' })
    expect(loggedAt()[TODAY]).toEqual({ fajr: NOON })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Fajr: ${name}. Change status.` })).toHaveAttribute('data-status', status)
  })

  it('clears the entry through the sheet', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="dhuhr" dateKey={TODAY} />)

    usePrayerLog.setState({ loggedAt: { [TODAY]: { fajr: NOON - 1000, dhuhr: NOON - 500 } } })
    await user.click(screen.getByRole('button', { name: 'Dhuhr: Missed. Change status.' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear entry' }))

    expect(entries()).toEqual({ [TODAY]: { fajr: 'ontime' } })
    expect(loggedAt()).toEqual({ [TODAY]: { fajr: NOON - 1000 } })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Dhuhr: not logged/ })).toBeEnabled()
  })

  it('removes the day when its last entry is cleared', async () => {
    seedLog({ [TODAY]: { isha: 'late' } })
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="isha" dateKey={TODAY} />)

    await user.click(screen.getByRole('button', { name: /^Isha: Late/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear entry' }))
    expect(entries()).toEqual({})
  })

  it('keeps the status when the sheet is closed without choosing', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)

    await user.click(screen.getByRole('button', { name: /^Fajr: On time/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(entries()[TODAY]).toEqual({ fajr: 'ontime', dhuhr: 'missed' })
    expect(loggedAt()).toEqual({})
    expect(haptic).not.toHaveBeenCalled()
  })

  it('reflects a change made elsewhere', () => {
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)
    expect(screen.getByRole('button', { name: /^Fajr: On time/ })).toBeInTheDocument()

    act(() => seedLog({ [TODAY]: { fajr: 'excused' } }))
    expect(screen.getByRole('button', { name: 'Fajr: Excused. Change status.' })).toHaveAttribute(
      'data-status',
      'excused',
    )
  })
})

describe('which days can be logged', () => {
  it('disables a day that has not come yet', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="fajr" dateKey={TOMORROW} />)

    const toggle = screen.getByRole('button', { name: 'Fajr: not logged. This day has not come yet.' })
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(entries()).toEqual({})
    expect(haptic).not.toHaveBeenCalled()
  })

  it('allows past days', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="isha" dateKey="2025-12-31" />)

    await user.click(screen.getByRole('button', { name: /^Isha: not logged\. Mark/ }))
    expect(entries()).toEqual({ '2025-12-31': { isha: 'ontime' } })
  })

  it('does not wait for a prayer of today to begin', async () => {
    // One minute past midnight: none of today's prayers has started.
    vi.setSystemTime(new Date(`${TODAY}T00:01:00Z`))
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="isha" dateKey={TODAY} />)

    const toggle = screen.getByRole('button', { name: /^Isha: not logged\. Mark/ })
    expect(toggle).toBeEnabled()
    await user.click(toggle)
    expect(entries()).toEqual({ [TODAY]: { isha: 'ontime' } })
  })

  it('takes today from the saved location, not from UTC or the device', () => {
    // Noon UTC on the 11th is already 2 a.m. on the 12th on Kiritimati (UTC+14)...
    freezeToday(TODAY, 'Pacific/Kiritimati')
    const { unmount } = render(
      <>
        <PrayerLogToggle prayer="fajr" dateKey="2026-10-12" />
        <PrayerLogToggle prayer="dhuhr" dateKey="2026-10-13" />
      </>,
    )
    expect(screen.getByRole('button', { name: /^Fajr/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Dhuhr/ })).toBeDisabled()
    unmount()

    // ...and still 1 a.m. on the 11th in Honolulu (UTC-10), where the 12th has not begun.
    freezeToday(TODAY, 'Pacific/Honolulu')
    render(
      <>
        <PrayerLogToggle prayer="fajr" dateKey="2026-10-11" />
        <PrayerLogToggle prayer="dhuhr" dateKey="2026-10-12" />
      </>,
    )
    expect(screen.getByRole('button', { name: /^Fajr/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Dhuhr/ })).toBeDisabled()
  })
})

describe('in Arabic', () => {
  beforeEach(() => {
    setLanguage('ar')
  })

  it('names the prayer, its status and the action', async () => {
    const user = userEvent.setup()
    render(<PrayerLogToggle prayer="fajr" dateKey={TODAY} />)

    await user.click(screen.getByRole('button', { name: 'الفجر: غير مسجَّلة. تسجيلها «في وقتها».' }))
    await user.click(screen.getByRole('button', { name: 'الفجر: في وقتها. تغيير الحالة.' }))

    const sheet = screen.getByRole('dialog', { name: 'الفجر، الأحد، ١١ أكتوبر' })
    await user.click(within(sheet).getByRole('button', { name: 'جماعة' }))
    expect(entries()).toEqual({ [TODAY]: { fajr: 'jamaah' } })
    expect(screen.getByRole('button', { name: 'الفجر: جماعة. تغيير الحالة.' })).toBeInTheDocument()
  })
})
