import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { azkarData } from '../data'
import { useAzkarProgress } from '../progressStore'
import { useAzkarSettings } from '../settingsStore'
import { presetOne, presetTwo, withTasbih } from '../testing/fixture'
import { renderRoute, resetStores } from '../testing/harness'

vi.mock('../data', async () => (await import('../testing/fixture')).createDataModule())
vi.mock('../../prayer-times', () => ({ usePrayerDay: () => null }))

// Presets: preset-one, then preset-two. Without a location, Fajr stands at 04:00.
const DAY = '2026-10-12'
const vibrate = vi.fn(() => true)
const progress = () => useAzkarProgress.getState()
const settings = () => useAzkarSettings.getState()
const counter = () => screen.getByRole('button', { name: /^Tap to count/ })
const undo = () => screen.getByRole('button', { name: 'Undo one count' })
const reset = () => screen.getByRole('button', { name: 'Reset' })
const status = () => screen.getByRole('status')
const record = (slot = 'preset-one', dateKey = DAY) => progress().tasbih.days[dateKey]?.presets[slot]
const at = (time: string, day = DAY) => vi.setSystemTime(new Date(`${day}T${time}:00Z`))
const dialog = () => screen.getByRole('dialog')

function tap(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(counter())
}

beforeEach(() => {
  vi.useFakeTimers()
  at('14:00')
  resetStores()
  withTasbih(azkarData)
  vibrate.mockClear()
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.tasbih
  Reflect.deleteProperty(navigator, 'vibrate')
  Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('the counter', () => {
  it('counts the first preset, showing its Arabic, transliteration and meaning', () => {
    renderRoute('/azkar/tasbih')
    expect(screen.getByRole('heading', { level: 1, name: 'Tasbih' })).toBeInTheDocument()
    expect(screen.getByText(presetOne.arabic)).toHaveAttribute('lang', 'ar')
    expect(screen.getByText(presetOne.transliteration!)).toBeInTheDocument()
    expect(screen.getByText(presetOne.translation)).toBeInTheDocument()
    expect(counter()).toHaveAccessibleName('Tap to count: 0 of 33')
  })

  it('counts one per tap, on the counter, for the day and for all time', () => {
    renderRoute('/azkar/tasbih')
    tap(3)
    expect(counter()).toHaveAccessibleName('Tap to count: 3 of 33')
    expect(record()).toMatchObject({ count: 3, current: 3 })
    expect(screen.getByText('Today').closest('div')).toHaveTextContent(/^Today3$/)
    expect(screen.getByText('All time').closest('div')).toHaveTextContent(/^All time3$/)
  })

  it('ticks on each tap', () => {
    renderRoute('/azkar/tasbih')
    tap(2)
    expect(vibrate).toHaveBeenCalledTimes(2)
    expect(vibrate.mock.calls[0]).toEqual([12])
  })

  it('stays silent when haptics are off', () => {
    settings().update({ haptics: false })
    renderRoute('/azkar/tasbih')
    tap(33)
    expect(vibrate).not.toHaveBeenCalled()
  })
})

describe('the target', () => {
  it('gives the done feedback, a gentle sign and one announcement at the target, then counts on', () => {
    renderRoute('/azkar/tasbih')
    tap(32)
    expect(status()).toHaveTextContent('')
    tap()
    expect(vibrate).toHaveBeenCalledTimes(33)
    expect(vibrate.mock.calls[32]).not.toEqual(vibrate.mock.calls[0])
    expect(status()).toHaveTextContent('33 reached')
    // Shown on the counter too, in words, so the sign is not left to colour alone.
    expect(within(counter()).getByText('33 reached')).toBeInTheDocument()
    expect(within(counter()).getByText('1 round done')).toBeInTheDocument()

    tap()
    expect(counter()).toHaveAccessibleName('Tap to count: 34, 1 of 33 in this round')
    expect(status()).toHaveTextContent('')
    expect(within(counter()).getByText('1 of 33 in this round')).toBeInTheDocument()
    tap(32)
    expect(status()).toHaveTextContent('33 reached')
    expect(within(counter()).getByText('2 rounds done')).toBeInTheDocument()
  })

  it('offers 33, 99, 100, a custom count or none, and applies the choice at once', () => {
    renderRoute('/azkar/tasbih')
    fireEvent.click(screen.getByRole('button', { name: 'Target: 33' }))
    const group = within(dialog()).getByRole('radiogroup', { name: 'Target' })
    expect(within(group).getAllByRole('radio').map((radio) => radio.closest('label')!.textContent)).toEqual([
      '33',
      '99',
      '100',
      'Custom',
      'None',
    ])
    fireEvent.click(within(group).getByLabelText('100'))
    expect(settings().tasbihTarget).toBe(100)

    fireEvent.click(within(group).getByLabelText('None'))
    expect(settings().tasbihTarget).toBeNull()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'No target' })).toBeInTheDocument()
  })

  it('counts on with no target and no signal along the way', () => {
    settings().update({ tasbihTarget: null })
    renderRoute('/azkar/tasbih')
    tap(33)
    expect(counter()).toHaveAccessibleName('Tap to count: 33')
    expect(status()).toHaveTextContent('')
    expect(new Set(vibrate.mock.calls.map((call) => JSON.stringify(call))).size).toBe(1)
  })

  it('takes a custom target, typed in either digits, and refuses one out of range', () => {
    renderRoute('/azkar/tasbih')
    fireEvent.click(screen.getByRole('button', { name: 'Target: 33' }))
    fireEvent.click(within(dialog()).getByLabelText('Custom'))
    const input = within(dialog()).getByLabelText('Custom target')
    fireEvent.change(input, { target: { value: '0' } })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a whole number from 1 to 100000.')
    expect(settings().tasbihTarget).toBe(33)

    fireEvent.change(input, { target: { value: '٧' } })
    expect(settings().tasbihTarget).toBe(7)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    tap(7)
    expect(status()).toHaveTextContent('7 reached')
  })

  it('opens on the custom target as it is', () => {
    settings().update({ tasbihTarget: 50 })
    renderRoute('/azkar/tasbih')
    fireEvent.click(screen.getByRole('button', { name: 'Target: 50' }))
    expect(within(dialog()).getByLabelText('Custom')).toBeChecked()
    expect(within(dialog()).getByLabelText('Custom target')).toHaveValue('50')
  })
})

describe('undo and reset', () => {
  it('takes back the last count, and cannot go below zero', () => {
    renderRoute('/azkar/tasbih')
    expect(undo()).toHaveAttribute('aria-disabled', 'true')
    tap(2)
    fireEvent.click(undo())
    expect(counter()).toHaveAccessibleName('Tap to count: 1 of 33')
    fireEvent.click(undo())
    fireEvent.click(undo())
    expect(counter()).toHaveAccessibleName('Tap to count: 0 of 33')
    expect(progress().tasbih.days).toEqual({})
  })

  it('resets the counter after asking, and keeps the day’s total recorded', () => {
    renderRoute('/azkar/tasbih')
    expect(reset()).toHaveAttribute('aria-disabled', 'true')
    tap(40)
    fireEvent.click(reset())
    expect(within(dialog()).getByText('The counter goes back to 0. Today’s total of 40 stays recorded.')).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(counter()).toHaveAccessibleName('Tap to count: 40, 7 of 33 in this round')

    fireEvent.click(reset())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Reset' }))
    expect(counter()).toHaveAccessibleName('Tap to count: 0 of 33')
    expect(counter()).toHaveFocus()
    expect(record()).toMatchObject({ count: 40, current: 0 })
  })
})

describe('presets', () => {
  it('lists every preset with its Arabic, transliteration and meaning, and the free count', () => {
    renderRoute('/azkar/tasbih')
    fireEvent.click(screen.getByRole('button', { name: 'Change what you are counting' }))
    const sheet = within(dialog())
    expect(sheet.getByRole('heading', { name: 'Choose a dhikr' })).toBeInTheDocument()
    const options = sheet.getAllByRole('button').filter((button) => button.getAttribute('aria-label') !== 'Close')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveAttribute('aria-current', 'true')
    expect(within(options[1]!).getByText(presetTwo.arabic)).toHaveAttribute('lang', 'ar')
    expect(within(options[1]!).getByText(presetTwo.transliteration!)).toBeInTheDocument()
    expect(within(options[1]!).getByText(presetTwo.translation)).toBeInTheDocument()
    expect(options[2]).toHaveTextContent('Free count')
  })

  it('counts each preset and the free count apart, and remembers the choice', () => {
    renderRoute('/azkar/tasbih')
    tap(2)
    fireEvent.click(screen.getByRole('button', { name: 'Change what you are counting' }))
    fireEvent.click(within(dialog()).getByText(presetTwo.arabic))
    expect(screen.getByText(presetTwo.arabic)).toBeInTheDocument()
    expect(counter()).toHaveAccessibleName('Tap to count: 0 of 33')
    tap(5)
    expect(settings()).toMatchObject({ tasbihPreset: 'preset-two', tasbihFree: false })

    fireEvent.click(screen.getByRole('button', { name: 'Change what you are counting' }))
    fireEvent.click(within(dialog()).getByText('Free count'))
    expect(screen.getByText('Free count')).toBeInTheDocument()
    tap(3)
    expect(settings().tasbihFree).toBe(true)

    expect(progress().tasbih.days[DAY]).toMatchObject({
      presets: { 'preset-one': { count: 2 }, 'preset-two': { count: 5 } },
      free: { count: 3, current: 3 },
    })
    expect(progress().tasbih.totals).toEqual({ 'preset-one': 2, 'preset-two': 5 })
    expect(progress().tasbih.free).toBe(3)
  })

  it('falls back to the first preset when the one chosen is no longer offered', () => {
    settings().update({ tasbihPreset: 'retired' })
    renderRoute('/azkar/tasbih')
    expect(screen.getByText(presetOne.arabic)).toBeInTheDocument()
  })

  it('counts freely, with nothing to choose, until the dataset has presets', () => {
    delete azkarData.tasbih
    renderRoute('/azkar/tasbih')
    expect(screen.getByText('Free count')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change what you are counting' })).not.toBeInTheDocument()
    tap(4)
    expect(progress().tasbih.days[DAY]?.free).toMatchObject({ count: 4, current: 4 })
  })
})

describe('days', () => {
  it('resumes the day’s counter after leaving the page', () => {
    const { unmount } = renderRoute('/azkar/tasbih')
    tap(12)
    unmount()
    renderRoute('/azkar/tasbih')
    expect(counter()).toHaveAccessibleName('Tap to count: 12 of 33')
  })

  it('files counts before Fajr under the night before, and starts afresh after Fajr', () => {
    at('23:58')
    renderRoute('/azkar/tasbih')
    tap(5)
    act(() => {
      vi.setSystemTime(new Date('2026-10-13T01:00:00Z'))
      vi.advanceTimersByTime(15_000)
    })
    tap(2)
    expect(record()).toMatchObject({ count: 7, current: 7 })

    act(() => {
      vi.setSystemTime(new Date('2026-10-13T06:00:00Z'))
      vi.advanceTimersByTime(15_000)
    })
    expect(counter()).toHaveAccessibleName('Tap to count: 0 of 33')
    tap()
    expect(record('preset-one', '2026-10-13')).toMatchObject({
      startedAt: Date.parse('2026-10-13T06:00:15Z'),
      count: 1,
    })
    expect(progress().tasbih.totals['preset-one']).toBe(8)
  })
})

describe('keyboard and screen', () => {
  it('counts with Space or Enter from the page, but not from a control or a sheet', () => {
    renderRoute('/azkar/tasbih')
    fireEvent.keyDown(document.body, { key: ' ' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.keyDown(document.body, { key: ' ', repeat: true })
    expect(record()?.count).toBe(2)

    fireEvent.keyDown(undo(), { key: ' ' })
    fireEvent.click(screen.getByRole('button', { name: 'Target: 33' }))
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(record()?.count).toBe(2)
  })

  it('keeps the screen awake while counting, and lets go on leaving', async () => {
    const release = vi.fn(() => Promise.resolve())
    const request = vi.fn(() => Promise.resolve({ release, addEventListener: () => {} }))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const { unmount } = renderRoute('/azkar/tasbih')
    await act(async () => {})
    expect(request).toHaveBeenCalledExactlyOnceWith('screen')
    unmount()
    expect(release).toHaveBeenCalledOnce()
  })

  it('leaves the screen alone when keep-awake is off', async () => {
    const request = vi.fn(() => Promise.resolve({ release: () => Promise.resolve(), addEventListener: () => {} }))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    settings().update({ keepAwake: false })
    renderRoute('/azkar/tasbih')
    await act(async () => {})
    expect(request).not.toHaveBeenCalled()
  })

  it('speaks Arabic in the Arabic interface', () => {
    resetStores('ar')
    renderRoute('/azkar/tasbih')
    expect(screen.getByRole('heading', { level: 1, name: 'التسبيح' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^اضغط للعدّ/ })).toHaveAccessibleName('اضغط للعدّ: ٠ من ٣٣')
    expect(screen.getByRole('button', { name: 'تصفير' })).toBeInTheDocument()
  })
})
