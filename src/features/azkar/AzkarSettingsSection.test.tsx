import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AzkarSettingsSection } from './AzkarSettingsSection'
import { useAzkarSettings } from './settingsStore'
import { resetStores } from './testing/harness'

const settings = () => useAzkarSettings.getState()
const toggle = (name: string) => screen.getByRole('switch', { name })

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('AzkarSettingsSection', () => {
  it('steps the Arabic text size through five sizes with a live preview', () => {
    render(<AzkarSettingsSection />)
    const preview = screen.getByText('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ')
    expect(preview).toHaveAttribute('lang', 'ar')
    expect(preview.style.fontSize).toBe('1.75rem')

    const increase = screen.getByRole('button', { name: 'Increase' })
    fireEvent.click(increase)
    expect(settings().arabicScale).toBe(4)
    expect(preview.style.fontSize).toBe('2rem')

    fireEvent.click(increase)
    expect(settings().arabicScale).toBe(5)
    // At the limit the button is aria-disabled, not disabled, so a keyboard user's focus stays on it.
    expect(increase).toHaveAttribute('aria-disabled', 'true')
    expect(increase).toBeEnabled()
    fireEvent.click(increase)
    expect(settings().arabicScale).toBe(5)

    const decrease = screen.getByRole('button', { name: 'Decrease' })
    for (let i = 0; i < 5; i++) fireEvent.click(decrease)
    expect(settings().arabicScale).toBe(1)
    expect(decrease).toHaveAttribute('aria-disabled', 'true')
    expect(decrease).toBeEnabled()
    expect(preview.style.fontSize).toBe('1.375rem')
  })

  it('shows the reading aids as on in English and remembers a choice to hide them', () => {
    render(<AzkarSettingsSection />)
    expect(toggle('Show translation')).toBeChecked()
    expect(toggle('Show transliteration')).toBeChecked()
    expect(settings().showTranslation).toBeNull()

    fireEvent.click(toggle('Show translation'))
    expect(settings().showTranslation).toBe(false)
    expect(toggle('Show translation')).not.toBeChecked()
    expect(settings().showTransliteration).toBeNull()
  })

  it('shows the reading aids as off in Arabic and remembers a choice to show them', () => {
    resetStores('ar')
    render(<AzkarSettingsSection />)
    expect(toggle('إظهار الترجمة')).not.toBeChecked()
    fireEvent.click(toggle('إظهار الترجمة'))
    expect(settings().showTranslation).toBe(true)
    expect(toggle('إظهار الترجمة')).toBeChecked()
  })

  it('toggles auto-advance', () => {
    render(<AzkarSettingsSection />)
    expect(toggle('Auto-advance')).toBeChecked()
    fireEvent.click(toggle('Auto-advance'))
    expect(settings().autoAdvance).toBe(false)
  })

  it('offers haptics and the wake lock only where the device supports them', () => {
    const { unmount } = render(<AzkarSettingsSection />)
    expect(screen.queryByRole('switch', { name: 'Haptic feedback' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Keep screen awake' })).not.toBeInTheDocument()
    unmount()

    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {} })
    render(<AzkarSettingsSection />)
    fireEvent.click(toggle('Haptic feedback'))
    fireEvent.click(toggle('Keep screen awake'))
    expect(settings()).toMatchObject({ haptics: false, keepAwake: false })
  })
})
