import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { azkarData } from './data'
import { AZKAR_PROGRESS_STORAGE_KEY, emptyAzkarProgress, SESSION_DAYS, useAzkarProgress } from './progressStore'
import { tasbihDayCount } from './tasbihData'
import { tasbihCountSince, tasbihDateKey, tasbihInRange, tasbihLifetime } from './tasbihTracking'
import { presetOne, withTasbih } from './testing/fixture'
import { snippet } from './reader/text'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

const DAY = '2026-10-12'
const T0 = Date.parse(`${DAY}T06:00:00Z`)
const store = () => useAzkarProgress.getState()
const tasbih = () => store().tasbih

function count(times: number, slot: string | null = 'preset-one', dateKey = DAY) {
  for (let i = 0; i < times; i++) store().countTasbih(dateKey, slot)
}

function later(minutes: number) {
  vi.setSystemTime(Date.now() + minutes * 60_000)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  useAzkarProgress.setState(emptyAzkarProgress())
  localStorage.clear()
  withTasbih(azkarData)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.tasbih
})

describe('counting', () => {
  it('records each day’s count per preset, with its first and latest time', () => {
    count(1)
    later(3)
    count(32)
    expect(tasbih().days[DAY]).toEqual({
      presets: { 'preset-one': { startedAt: T0, lastAt: T0 + 3 * 60_000, count: 33, current: 33 } },
    })
  })

  it('keeps presets, the free count and days apart', () => {
    count(2)
    count(5, 'preset-two')
    count(3, null)
    count(1, 'preset-one', '2026-10-13')
    expect(tasbih().days[DAY]?.presets).toMatchObject({ 'preset-one': { count: 2 }, 'preset-two': { count: 5 } })
    expect(tasbih().days[DAY]?.free).toMatchObject({ count: 3, current: 3 })
    expect(tasbih().days['2026-10-13']).toEqual({
      presets: { 'preset-one': { startedAt: T0, lastAt: T0, count: 1, current: 1 } },
    })
    expect(tasbihDayCount(tasbih().days[DAY])).toBe(10)
  })

  it('adds to the lifetime totals per preset and of the free count, and nothing to the reader’s', () => {
    count(33)
    count(4, null)
    count(1, 'preset-one', '2026-10-13')
    expect(tasbih().totals).toEqual({ 'preset-one': 34 })
    expect(tasbih().free).toBe(4)
    expect(store().totals).toEqual({})
    expect(store().totalRecitations).toBe(0)
  })

  it('ignores a preset the dataset does not offer, or an impossible date', () => {
    count(1, 'tasbih') // a morning dhikr, not a preset
    count(1, 'preset-one', '2026-13-01')
    delete azkarData.tasbih
    count(1, 'preset-one')
    expect(tasbih()).toEqual(emptyAzkarProgress().tasbih)
    // The free count needs no dataset.
    count(1, null)
    expect(tasbih().free).toBe(1)
  })
})

describe('undo and reset', () => {
  it('takes back the counter’s last count, from the day and the lifetime totals', () => {
    count(3)
    later(1)
    store().undoTasbih(DAY, 'preset-one')
    expect(tasbih().days[DAY]?.presets['preset-one']).toEqual({ startedAt: T0, lastAt: T0 + 60_000, count: 2, current: 2 })
    expect(tasbih().totals['preset-one']).toBe(2)
  })

  it('leaves nothing behind when every count is taken back, and does nothing at zero', () => {
    count(1)
    store().undoTasbih(DAY, 'preset-one')
    store().undoTasbih(DAY, 'preset-one')
    expect(tasbih()).toEqual(emptyAzkarProgress().tasbih)
  })

  it('puts the counter back to 0 and keeps what was counted that day', () => {
    count(40)
    later(5)
    store().resetTasbih(DAY, 'preset-one')
    expect(tasbih().days[DAY]?.presets['preset-one']).toEqual({ startedAt: T0, lastAt: T0, count: 40, current: 0 })
    // Undo cannot reach behind a reset.
    store().undoTasbih(DAY, 'preset-one')
    expect(tasbih().days[DAY]?.presets['preset-one']?.count).toBe(40)

    count(2)
    expect(tasbih().days[DAY]?.presets['preset-one']).toMatchObject({ count: 42, current: 2 })
    expect(tasbih().totals['preset-one']).toBe(42)
  })
})

describe('persistence', () => {
  it('is saved with the rest of the progress and read back as it was', async () => {
    count(7)
    count(2, null)
    const raw = localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!
    const saved = JSON.parse(raw) as { state: { tasbih: unknown } }
    expect(saved.state.tasbih).toEqual(tasbih())

    const before = tasbih()
    useAzkarProgress.setState(emptyAzkarProgress())
    localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, raw)
    await useAzkarProgress.persist.rehydrate()
    expect(tasbih()).toEqual(before)
  })

  it('keeps the daily records about ten years, and the lifetime totals for good', () => {
    const ancient = shiftDateKey(DAY, -SESSION_DAYS - 1)
    count(5, 'preset-one', ancient)
    count(1)
    expect(Object.keys(tasbih().days)).toEqual([DAY])
    expect(tasbih().totals['preset-one']).toBe(6)
  })
})

describe('tracking', () => {
  it('files a count before Fajr under the night before', () => {
    expect(tasbihDateKey(DAY, 'beforeDawn')).toBe('2026-10-11')
    expect(tasbihDateKey(DAY, 'morning')).toBe(DAY)
  })

  it('lists the days counted in a range with their totals, and the counts of the last days', () => {
    count(10, 'preset-one', '2026-10-01')
    count(3, null, '2026-10-10')
    count(33)
    expect(tasbihInRange(tasbih().days, '2026-10-05', DAY).map(({ dateKey, count: total }) => [dateKey, total])).toEqual([
      ['2026-10-10', 3],
      [DAY, 33],
    ])
    expect(tasbihCountSince(tasbih(), DAY, 7)).toBe(36)
    expect(tasbihCountSince(tasbih(), DAY, 30)).toBe(46)
  })

  it('gives the lifetime count by preset and free, and the days counted', () => {
    count(10, 'preset-one', '2026-10-01')
    count(3, null, '2026-10-10')
    count(2, 'preset-two')
    const lifetime = tasbihLifetime(tasbih())
    expect(lifetime).toEqual({
      count: 15,
      free: 3,
      byPreset: [
        { id: 'preset-one', recitations: 10, snippet: snippet(presetOne.arabic) },
        { id: 'preset-two', recitations: 2, snippet: expect.any(String) },
      ],
      days: 3,
    })
  })
})
