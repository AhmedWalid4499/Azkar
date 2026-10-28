import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic } from '../../native'
import { usePrayerLog } from './store'
import { SunnahToggle } from './SunnahToggle'
import { freezeToday, resetApp, seedSunnah, setLanguage } from './test-utils'
import { SUNNAH_PRAYERS } from './types'

vi.mock('../../native', async (importOriginal) => ({ ...(await importOriginal<object>()), haptic: vi.fn() }))

const TODAY = '2026-10-11'
const NOON = Date.parse(`${TODAY}T12:00:00Z`)

const sunnah = () => usePrayerLog.getState().sunnah

beforeEach(() => {
  vi.mocked(haptic).mockClear()
  freezeToday(TODAY)
})

afterEach(() => {
  resetApp()
})

describe('SunnahToggle', () => {
  it('is a toggle button named after the prayer and its rak’ahs', () => {
    render(
      <div role="group" aria-label="Sunnah prayers">
        {SUNNAH_PRAYERS.map((prayer) => (
          <SunnahToggle key={prayer} sunnah={prayer} dateKey={TODAY} />
        ))}
      </div>,
    )
    const toggles = screen.getAllByRole('button')
    expect(toggles.map((toggle) => toggle.textContent)).toEqual([
      '2 before Fajr',
      'Duha',
      '4 before Dhuhr',
      '2 after Dhuhr',
      '2 after Maghrib',
      '2 after Isha',
      'Night prayer',
      'Witr',
    ])
    for (const toggle of toggles) expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks the prayer done with one tap and undoes it with another, each with a light haptic', async () => {
    const user = userEvent.setup()
    render(<SunnahToggle sunnah="beforeFajr" dateKey={TODAY} />)
    const toggle = screen.getByRole('button', { name: '2 before Fajr' })

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(sunnah()).toEqual({ [TODAY]: { beforeFajr: NOON } })
    expect(haptic).toHaveBeenCalledExactlyOnceWith('tick')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(sunnah()).toEqual({})
    expect(haptic).toHaveBeenCalledTimes(2)
    expect(haptic).toHaveBeenLastCalledWith('tick')
  })

  it('works from the keyboard', async () => {
    const user = userEvent.setup()
    render(<SunnahToggle sunnah="witr" dateKey={TODAY} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Witr' })).toHaveFocus()
    await user.keyboard(' ')
    expect(sunnah()).toEqual({ [TODAY]: { witr: NOON } })
    await user.keyboard('{Enter}')
    expect(sunnah()).toEqual({})
  })

  it('files the prayer under the day it is given, past days included', async () => {
    const user = userEvent.setup()
    render(<SunnahToggle sunnah="qiyam" dateKey="2025-12-31" />)
    await user.click(screen.getByRole('button', { name: 'Night prayer' }))
    expect(sunnah()).toEqual({ '2025-12-31': { qiyam: NOON } })
  })

  it('is disabled on a day that has not come yet', async () => {
    const user = userEvent.setup()
    render(<SunnahToggle sunnah="duha" dateKey="2026-10-12" />)
    const toggle = screen.getByRole('button', { name: 'Duha' })
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(sunnah()).toEqual({})
    expect(haptic).not.toHaveBeenCalled()
  })

  it('reflects a change made elsewhere', () => {
    render(<SunnahToggle sunnah="afterMaghrib" dateKey={TODAY} />)
    const toggle = screen.getByRole('button', { name: '2 after Maghrib' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    act(() => seedSunnah({ [TODAY]: { afterMaghrib: NOON } }))
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('is named in Arabic in the Arabic interface', async () => {
    setLanguage('ar')
    const user = userEvent.setup()
    render(
      <>
        {SUNNAH_PRAYERS.map((prayer) => (
          <SunnahToggle key={prayer} sunnah={prayer} dateKey={TODAY} />
        ))}
      </>,
    )
    expect(screen.getAllByRole('button').map((toggle) => toggle.textContent)).toEqual([
      'ركعتان قبل الفجر',
      'الضحى',
      'أربع ركعات قبل الظهر',
      'ركعتان بعد الظهر',
      'ركعتان بعد المغرب',
      'ركعتان بعد العشاء',
      'قيام الليل',
      'الوتر',
    ])
    await user.click(screen.getByRole('button', { name: 'الوتر' }))
    expect(screen.getByRole('button', { name: 'الوتر' })).toHaveAttribute('aria-pressed', 'true')
  })
})
