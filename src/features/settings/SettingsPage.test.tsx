import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, useSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/settings'
import { SettingsPage } from './SettingsPage'

function renderSettings(settings: Partial<AppSettings>) {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en', ...settings })
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

// Written as an escape: the mark itself is invisible in an editor.
const LRM = '\u200e'

afterEach(() => {
  useSettings.setState(DEFAULT_SETTINGS)
})

describe('SettingsPage', () => {
  it('names each language in itself and marks it with its own lang', () => {
    renderSettings({ language: 'en' })
    const group = screen.getByRole('radiogroup', { name: 'Language' })
    expect(within(group).getByText('العربية').closest('[lang]')).toHaveAttribute('lang', 'ar')
    expect(within(group).getByText('English').closest('[lang]')).toHaveAttribute('lang', 'en')
    // The names still label their options.
    expect(within(group).getByRole('radio', { name: 'العربية' })).not.toBeChecked()
    expect(within(group).getByRole('radio', { name: 'English' })).toBeChecked()
  })

  it('marks English as English in the Arabic interface', () => {
    renderSettings({ language: 'ar' })
    const group = screen.getByRole('radiogroup', { name: 'اللغة' })
    expect(within(group).getByText('English').closest('[lang]')).toHaveAttribute('lang', 'en')
  })

  it('writes the time-format choices with the digits the reader chose', () => {
    const { unmount } = renderSettings({ language: 'ar', arabicDigits: false })
    let group = screen.getByRole('radiogroup', { name: 'صيغة الوقت' })
    expect(within(group).getByRole('radio', { name: '12 ساعة' })).toBeChecked()
    expect(within(group).getByRole('radio', { name: '24 ساعة' })).toBeInTheDocument()
    expect(group).not.toHaveTextContent(/[٠-٩]/)
    unmount()

    renderSettings({ language: 'ar', arabicDigits: true })
    group = screen.getByRole('radiogroup', { name: 'صيغة الوقت' })
    expect(within(group).getByRole('radio', { name: '١٢ ساعة' })).toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: '٢٤ ساعة' })).toBeInTheDocument()
  })

  it('keeps English time-format labels as they were', () => {
    renderSettings({ language: 'en' })
    const group = screen.getByRole('radiogroup', { name: 'Time format' })
    expect(within(group).getByRole('radio', { name: '12-hour' })).toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: '24-hour' })).toBeInTheDocument()
  })

  it('keeps the plus sign in front of a positive Hijri adjustment in Arabic with Western digits', () => {
    const offset = () => within(screen.getByRole('group', { name: 'تعديل التاريخ الهجري' })).getByRole('status')

    const { unmount } = renderSettings({ language: 'ar', arabicDigits: false, hijriOffset: 1 })
    // A bare "+1" is drawn as "1+" in a right-to-left line; the mark keeps the sign where it belongs.
    expect(offset().textContent).toBe(`${LRM}+1`)
    unmount()

    renderSettings({ language: 'ar', arabicDigits: false, hijriOffset: -1 })
    expect(offset().textContent).toBe(`${LRM}-1`)
  })

  it('formats the Hijri adjustment the locale’s way in every mode', async () => {
    renderSettings({ language: 'en', hijriOffset: 1 })
    const group = screen.getByRole('group', { name: 'Hijri date adjustment' })
    expect(within(group).getByRole('status')).toHaveTextContent('+1')

    // Two days is the limit: a further press changes nothing.
    for (let i = 0; i < 2; i++) await userEvent.click(within(group).getByRole('button', { name: 'Increase' }))
    expect(within(group).getByRole('status')).toHaveTextContent('+2')
    expect(useSettings.getState().hijriOffset).toBe(2)

    for (let i = 0; i < 2; i++) await userEvent.click(within(group).getByRole('button', { name: 'Decrease' }))
    expect(within(group).getByRole('status').textContent).toBe('0')
  })
})
