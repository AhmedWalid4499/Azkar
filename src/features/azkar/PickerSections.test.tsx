import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { azkarData } from './data'
import { useAzkarProgress } from './progressStore'
import { withAfterPrayer, withTasbih } from './testing/fixture'
import { renderRoute, resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

// After Fajr: three azkar (the third ×10). After Dhuhr, Asr and Isha: two. After Maghrib: three.
const DAY = '2026-10-12'
const progress = () => useAzkarProgress.getState()
const section = () => screen.getByRole('region', { name: 'After prayer' })
const row = (name: RegExp) => within(section()).getByRole('link', { name })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${DAY}T13:00:00Z`))
  resetStores()
  withAfterPrayer(azkarData)
  withTasbih(azkarData)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.afterPrayer
  delete azkarData.tasbih
})

describe('after prayer, in the picker', () => {
  it('lists the five prayers in order, each leading to its reader', () => {
    renderRoute('/azkar')
    const links = within(section()).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/azkar/after/fajr',
      '/azkar/after/dhuhr',
      '/azkar/after/asr',
      '/azkar/after/maghrib',
      '/azkar/after/isha',
    ])
    expect(row(/^Fajr/)).toHaveTextContent('Start')
  })

  it('shows where each prayer’s azkar stand today', () => {
    progress().completeAfterPrayer(DAY, 'fajr', 'after-once')
    progress().completeAfterPrayer(DAY, 'dhuhr', 'after-once')
    progress().completeAfterPrayer(DAY, 'dhuhr', 'after-thrice')
    progress().completeAfterPrayer('2026-10-11', 'asr', 'after-once')
    renderRoute('/azkar')
    expect(row(/^Fajr/)).toHaveTextContent('1 of 3 done')
    expect(row(/^Dhuhr/)).toHaveTextContent(/Done at 1:00\sPM/)
    // Yesterday's reading is not today's.
    expect(row(/^Asr/)).toHaveTextContent('Start')
  })

  it('shows last night’s readings until Fajr', () => {
    progress().completeAfterPrayer('2026-10-11', 'isha', 'after-once')
    vi.setSystemTime(new Date('2026-10-12T02:00:00Z'))
    renderRoute('/azkar')
    expect(row(/^Isha/)).toHaveTextContent('1 of 2 done')
  })

  it('is left out until the dataset has after-prayer azkar', () => {
    delete azkarData.afterPrayer
    renderRoute('/azkar')
    expect(screen.queryByRole('region', { name: 'After prayer' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('names the prayers in Arabic in the Arabic interface', () => {
    resetStores('ar')
    renderRoute('/azkar')
    const arabic = screen.getByRole('region', { name: 'بعد الصلاة' })
    expect(within(arabic).getByRole('link', { name: /^الفجر/ })).toHaveTextContent('بدء')
  })
})

describe('tasbih, in the picker', () => {
  it('leads to the counter', () => {
    renderRoute('/azkar')
    expect(screen.getByRole('link', { name: 'Tasbih' })).toHaveAttribute('href', '/azkar/tasbih')
    expect(screen.getByText('Count a dhikr of your choice, or count freely')).toBeInTheDocument()
  })

  it('says what was counted today, every preset and the free count together', () => {
    progress().countTasbih(DAY, 'preset-one')
    progress().countTasbih(DAY, 'preset-one')
    progress().countTasbih(DAY, null)
    renderRoute('/azkar')
    expect(screen.getByText('Today: 3')).toBeInTheDocument()
  })

  it('is there even before the dataset has presets', () => {
    delete azkarData.tasbih
    delete azkarData.afterPrayer
    renderRoute('/azkar')
    expect(screen.getByRole('link', { name: 'Tasbih' })).toBeInTheDocument()
  })
})
