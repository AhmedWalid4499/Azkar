import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic } from '../../native'
import { useLocationStore } from '../../shared/location'
import type { SavedLocation } from '../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/settings'
import type { DateKey } from '../../shared/types'
import { usePrayerLog } from '../prayer-log'
import { DEFAULT_TODAY_LAYOUT, TODAY_LAYOUT_STORAGE_KEY, useTodayLayout } from './layoutStore'
import { SunnahCard } from './SunnahCard'

vi.mock('../../native', async (importOriginal) => ({ ...(await importOriginal<object>()), haptic: vi.fn() }))

// Fajr on Tuesday 13 October 2026 in Makkah is at 04:59 local (01:59 UTC).
const MAKKAH: SavedLocation = {
  latitude: 21.4225,
  longitude: 39.8262,
  timeZone: 'Asia/Riyadh',
  label: 'Makkah',
  countryCode: 'SA',
  source: 'manual',
  updatedAt: 0,
}
const TUESDAY = '2026-10-13'
const MONDAY = '2026-10-12'
/** 09:00 on Tuesday, well after Fajr. */
const MORNING = '2026-10-13T06:00:00Z'
/** 00:20 on Tuesday, before Fajr: the night of Monday is still going. */
const AFTER_MIDNIGHT = '2026-10-12T21:20:00Z'

const DAY_LABELS = ['2 before Fajr', 'Duha', '4 before Dhuhr', '2 after Dhuhr', '2 after Maghrib']
const NIGHT_LABELS = ['2 after Isha', 'Night prayer', 'Witr']

/** Only `Date` is faked, so timers and user-event keep working. */
function setClock(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

function renderCard(today: DateKey = TUESDAY, settings: Partial<AppSettings> = {}) {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', ...settings })
  useLocationStore.setState({ location: MAKKAH })
  return render(<SunnahCard today={today} />)
}

const sunnah = () => usePrayerLog.getState().sunnah
/** The button in the card's heading that folds and unfolds it. */
const disclosure = () => within(screen.getByRole('heading', { level: 3 })).getByRole('button')
const names = (group: HTMLElement) => within(group).getAllByRole('button').map((button) => button.textContent)

beforeEach(() => {
  vi.mocked(haptic).mockClear()
  usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
  useTodayLayout.setState(DEFAULT_TODAY_LAYOUT)
})

afterEach(() => {
  vi.useRealTimers()
  useSettings.setState(DEFAULT_SETTINGS)
  useLocationStore.setState({ location: null })
  usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
  useTodayLayout.setState(DEFAULT_TODAY_LAYOUT)
})

describe('during the day', () => {
  beforeEach(() => setClock(MORNING))

  it('offers the eight sunnah prayers of today as a group of toggle buttons under a heading', () => {
    renderCard()

    const heading = screen.getByRole('heading', { level: 3, name: /^Sunnah prayers/ })
    expect(within(heading).getByRole('button')).toHaveAccessibleName('Sunnah prayers 0 of 8')
    expect(within(heading).getByRole('button')).toHaveAttribute('aria-expanded', 'true')

    const group = screen.getByRole('group', { name: 'Sunnah prayers' })
    expect(names(group)).toEqual([...DAY_LABELS, ...NIGHT_LABELS])
    for (const toggle of within(group).getAllByRole('button')) expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('group', { name: /^Last night/ })).toBeNull()
  })

  it('ticks one off in a single tap, with a light haptic, and counts it', async () => {
    const user = userEvent.setup()
    renderCard()

    const fajr = screen.getByRole('button', { name: '2 before Fajr' })
    await user.click(fajr)
    expect(fajr).toHaveAttribute('aria-pressed', 'true')
    expect(sunnah()).toEqual({ [TUESDAY]: { beforeFajr: Date.parse(MORNING) } })
    expect(haptic).toHaveBeenCalledExactlyOnceWith('tick')
    expect(disclosure()).toHaveAccessibleName('Sunnah prayers 1 of 8')

    // The night prayers of a day that is under way are that day's own.
    await user.click(screen.getByRole('button', { name: 'Witr' }))
    expect(sunnah()[TUESDAY]).toMatchObject({ witr: Date.parse(MORNING) })
    expect(disclosure()).toHaveAccessibleName('Sunnah prayers 2 of 8')

    await user.click(fajr)
    expect(fajr).toHaveAttribute('aria-pressed', 'false')
    expect(sunnah()).toEqual({ [TUESDAY]: { witr: Date.parse(MORNING) } })
    expect(haptic).toHaveBeenCalledTimes(3)
  })

  it('shows what was ticked elsewhere, and nothing of other days', () => {
    usePrayerLog.setState({ sunnah: { [TUESDAY]: { duha: 1 }, [MONDAY]: { witr: 1, beforeFajr: 1 } } })
    renderCard()
    expect(screen.getByRole('button', { name: 'Duha' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Witr' })).toHaveAttribute('aria-pressed', 'false')
    expect(disclosure()).toHaveAccessibleName('Sunnah prayers 1 of 8')
  })
})

describe('folding the card', () => {
  beforeEach(() => setClock(MORNING))

  it('hides the chips but keeps the count, and remembers it the next time the page opens', async () => {
    const user = userEvent.setup()
    usePrayerLog.setState({ sunnah: { [TUESDAY]: { duha: 1 } } })
    const { unmount } = renderCard()

    await user.click(disclosure())
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure()).toHaveAccessibleName('Sunnah prayers 1 of 8')
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Duha' })).toBeNull()
    expect(JSON.parse(localStorage.getItem(TODAY_LAYOUT_STORAGE_KEY)!)).toEqual({
      state: { sunnahCollapsed: true },
      version: 1,
    })

    unmount()
    renderCard()
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false')

    await user.click(disclosure())
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Duha' })).toHaveAttribute('aria-pressed', 'true')
    expect(useTodayLayout.getState().sunnahCollapsed).toBe(false)
  })

  it('controls the region it opens, and works from the keyboard', async () => {
    const user = userEvent.setup()
    renderCard()
    const button = disclosure()
    const region = document.getElementById(button.getAttribute('aria-controls')!)
    expect(region).toContainElement(screen.getByRole('group', { name: 'Sunnah prayers' }))

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(region).not.toBeVisible()
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(haptic).not.toHaveBeenCalled()
  })
})

describe('between midnight and Fajr', () => {
  it('files the night prayers under the night that is ending, and the rest under today', async () => {
    setClock(AFTER_MIDNIGHT)
    const user = userEvent.setup()
    renderCard()

    expect(names(screen.getByRole('group', { name: 'Sunnah prayers' }))).toEqual(DAY_LABELS)
    const night = screen.getByRole('group', { name: /^Last night/ })
    expect(night).toHaveAccessibleName('Last night Counts for Monday, October 12')
    expect(names(night)).toEqual(NIGHT_LABELS)

    await user.click(within(night).getByRole('button', { name: 'Witr' }))
    await user.click(within(night).getByRole('button', { name: 'Night prayer' }))
    await user.click(screen.getByRole('button', { name: '2 before Fajr' }))
    const at = Date.parse(AFTER_MIDNIGHT)
    expect(sunnah()).toEqual({ [MONDAY]: { witr: at, qiyam: at }, [TUESDAY]: { beforeFajr: at } })
    expect(disclosure()).toHaveAccessibleName('Sunnah prayers 3 of 8')
  })

  it('shows last night’s prayers as they were ticked, and counts them', () => {
    setClock(AFTER_MIDNIGHT)
    usePrayerLog.setState({ sunnah: { [MONDAY]: { witr: 1, afterIsha: 1 }, [TUESDAY]: { witr: 1 } } })
    renderCard()
    const night = screen.getByRole('group', { name: /^Last night/ })
    expect(within(night).getByRole('button', { name: 'Witr' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(night).getByRole('button', { name: '2 after Isha' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(night).getByRole('button', { name: 'Night prayer' })).toHaveAttribute('aria-pressed', 'false')
    expect(disclosure()).toHaveAccessibleName('Sunnah prayers 2 of 8')
  })

  it('hands the night prayers back to the new day at Fajr while the page stays open', async () => {
    setClock('2026-10-13T01:58:00Z') // 04:58
    renderCard()
    expect(screen.getByRole('group', { name: /^Last night/ })).toBeInTheDocument()

    // Looked at again after Fajr (04:59): returning to the tab reads the clock afresh.
    vi.setSystemTime(new Date('2026-10-13T02:00:00Z'))
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(screen.queryByRole('group', { name: /^Last night/ })).toBeNull()
    expect(names(screen.getByRole('group', { name: 'Sunnah prayers' }))).toEqual([...DAY_LABELS, ...NIGHT_LABELS])

    await userEvent.click(screen.getByRole('button', { name: 'Witr' }))
    expect(sunnah()).toEqual({ [TUESDAY]: { witr: Date.parse('2026-10-13T02:00:00Z') } })
  })
})

describe('in Arabic', () => {
  it('names the card, the chips and the night in Arabic, with Arabic digits', async () => {
    setClock(AFTER_MIDNIGHT)
    const user = userEvent.setup()
    renderCard(TUESDAY, { language: 'ar' })

    expect(disclosure()).toHaveAccessibleName('السنن والنوافل ٠ من ٨')
    expect(names(screen.getByRole('group', { name: 'السنن والنوافل' }))).toEqual([
      'ركعتان قبل الفجر',
      'الضحى',
      'أربع ركعات قبل الظهر',
      'ركعتان بعد الظهر',
      'ركعتان بعد المغرب',
    ])
    const night = screen.getByRole('group', { name: /^الليلة الماضية/ })
    expect(night).toHaveAccessibleName('الليلة الماضية من صلوات يوم الاثنين، ١٢ أكتوبر')
    expect(names(night)).toEqual(['ركعتان بعد العشاء', 'قيام الليل', 'الوتر'])

    await user.click(within(night).getByRole('button', { name: 'الوتر' }))
    expect(sunnah()).toEqual({ [MONDAY]: { witr: Date.parse(AFTER_MIDNIGHT) } })
    expect(disclosure()).toHaveAccessibleName('السنن والنوافل ١ من ٨')
    expect(haptic).toHaveBeenCalledExactlyOnceWith('tick')
  })

  it('shows every chip in one group once Fajr has come', () => {
    setClock(MORNING)
    renderCard(TUESDAY, { language: 'ar', arabicDigits: false })
    expect(disclosure()).toHaveAccessibleName('السنن والنوافل 0 من 8')
    expect(names(screen.getByRole('group', { name: 'السنن والنوافل' }))).toHaveLength(8)
    expect(screen.queryByRole('group', { name: /^الليلة الماضية/ })).toBeNull()
  })
})
