import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { availableAfterPrayers } from './afterPrayer'
import { azkarData, getAfterPrayerAzkar } from './data'
import { DETAIL_DAYS, emptyAzkarProgress, SESSION_DAYS, useAzkarProgress } from './progressStore'
import { withAfterPrayer } from './testing/fixture'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

// After Fajr: after-once ×1, after-thrice ×3, after-dawn-dusk ×10.
// After Dhuhr, Asr and Isha: after-once ×1, after-thrice ×3. After Maghrib: as Fajr, but ×7.
const DAY = '2026-10-12'
const T0 = Date.parse(`${DAY}T05:00:00Z`)
const store = () => useAzkarProgress.getState()
const record = (prayer: 'fajr' | 'dhuhr' | 'maghrib' = 'fajr', dateKey = DAY) =>
  store().afterPrayer.sessions[dateKey]?.[prayer]

function later(minutes: number) {
  vi.setSystemTime(Date.now() + minutes * 60_000)
}

function completeFajr(dateKey = DAY) {
  for (const id of ['after-once', 'after-thrice', 'after-dawn-dusk']) store().completeAfterPrayer(dateKey, 'fajr', id)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  useAzkarProgress.setState(emptyAzkarProgress())
  withAfterPrayer(azkarData)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.afterPrayer
})

describe('the after-prayer list of each prayer', () => {
  it('has each prayer’s own azkar and counts', () => {
    expect(getAfterPrayerAzkar('fajr').map((dhikr) => [dhikr.id, dhikr.repeat])).toEqual([
      ['after-once', 1],
      ['after-thrice', 3],
      ['after-dawn-dusk', 10],
    ])
    expect(getAfterPrayerAzkar('maghrib').at(-1)?.repeat).toBe(7)
    expect(getAfterPrayerAzkar('dhuhr').map((dhikr) => dhikr.id)).toEqual(['after-once', 'after-thrice'])
    expect(availableAfterPrayers()).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])
  })

  it('is empty, for every prayer, until the dataset has it', () => {
    delete azkarData.afterPrayer
    expect(availableAfterPrayers()).toEqual([])
    store().incrementAfterPrayer(DAY, 'fajr', 'after-once')
    expect(store().afterPrayer).toEqual(emptyAzkarProgress().afterPrayer)
  })
})

describe('counting after a prayer', () => {
  it('counts up to that prayer’s own count for the dhikr', () => {
    for (let i = 0; i < 12; i++) store().incrementAfterPrayer(DAY, 'fajr', 'after-dawn-dusk')
    for (let i = 0; i < 12; i++) store().incrementAfterPrayer(DAY, 'maghrib', 'after-dawn-dusk')
    expect(store().afterPrayer.days[DAY]).toEqual({ fajr: { 'after-dawn-dusk': 10 }, maghrib: { 'after-dawn-dusk': 7 } })
  })

  it('ignores a dhikr not said after that prayer, an unknown prayer or an impossible date', () => {
    store().incrementAfterPrayer(DAY, 'dhuhr', 'after-dawn-dusk')
    store().incrementAfterPrayer(DAY, 'sunrise' as never, 'after-once')
    store().incrementAfterPrayer('2026-02-30', 'fajr', 'after-once')
    store().incrementAfterPrayer(DAY, 'fajr', 'tasbih') // a morning dhikr, not after the prayer
    expect(store().afterPrayer).toEqual(emptyAzkarProgress().afterPrayer)
    expect(store().totalRecitations).toBe(0)
  })

  it('keeps each prayer and each day apart, and apart from the sessions', () => {
    store().incrementAfterPrayer(DAY, 'fajr', 'after-once')
    store().incrementAfterPrayer(DAY, 'dhuhr', 'after-thrice')
    store().incrementAfterPrayer('2026-10-13', 'fajr', 'after-once')
    expect(store().afterPrayer.days).toEqual({
      [DAY]: { fajr: { 'after-once': 1 }, dhuhr: { 'after-thrice': 1 } },
      '2026-10-13': { fajr: { 'after-once': 1 } },
    })
    expect(store().days).toEqual({})
    expect(store().sessions).toEqual({})
  })
})

describe('after-prayer records', () => {
  it('opens a record at the first count, follows the latest one, and times the completion', () => {
    store().incrementAfterPrayer(DAY, 'fajr', 'after-once')
    expect(record()).toEqual({ startedAt: T0, lastAt: T0, completed: false, done: 1, total: 3, recitations: 1 })

    later(2)
    store().completeAfterPrayer(DAY, 'fajr', 'after-thrice')
    later(3)
    store().completeAfterPrayer(DAY, 'fajr', 'after-dawn-dusk')
    expect(record()).toEqual({
      startedAt: T0,
      lastAt: T0 + 5 * 60_000,
      completedAt: T0 + 5 * 60_000,
      completed: true,
      done: 3,
      total: 3,
      recitations: 14,
    })
  })

  it('records each prayer’s own total', () => {
    store().incrementAfterPrayer(DAY, 'dhuhr', 'after-once')
    store().completeAfterPrayer(DAY, 'dhuhr', 'after-thrice')
    expect(record('dhuhr')).toMatchObject({ completed: true, done: 2, total: 2, recitations: 4 })
  })

  it('withdraws the completion when its final count is undone, and keeps it through "Start over"', () => {
    completeFajr()
    later(1)
    store().decrementAfterPrayer(DAY, 'fajr', 'after-dawn-dusk')
    expect(record()).toMatchObject({ completed: false, done: 2, recitations: 13 })
    expect(record()).not.toHaveProperty('completedAt')

    later(1)
    store().incrementAfterPrayer(DAY, 'fajr', 'after-dawn-dusk')
    expect(record()).toMatchObject({ completed: true, completedAt: T0 + 2 * 60_000 })

    store().resetAfterPrayer(DAY, 'fajr')
    expect(store().afterPrayer.days[DAY]).toBeUndefined()
    expect(record()).toMatchObject({ completed: true, completedAt: T0 + 2 * 60_000, done: 0, recitations: 14 })
  })

  it('leaves no record behind when a stray tap is taken straight back', () => {
    store().incrementAfterPrayer(DAY, 'fajr', 'after-once')
    store().decrementAfterPrayer(DAY, 'fajr', 'after-once')
    expect(store().afterPrayer.sessions).toEqual({})
    expect(store().afterPrayer.totals).toEqual({})
    expect(store().totalRecitations).toBe(0)
  })
})

describe('lifetime totals', () => {
  it('adds every repetition after a prayer to its own totals and to every count in the reader', () => {
    store().increment(DAY, 'morning', 'tasbih')
    completeFajr()
    store().completeAfterPrayer(DAY, 'maghrib', 'after-dawn-dusk')
    expect(store().afterPrayer.totals).toEqual({ 'after-once': 1, 'after-thrice': 3, 'after-dawn-dusk': 17 })
    expect(store().totals).toEqual({ tasbih: 1, 'after-once': 1, 'after-thrice': 3, 'after-dawn-dusk': 17 })
    expect(store().totalRecitations).toBe(22)

    store().decrementAfterPrayer(DAY, 'maghrib', 'after-dawn-dusk')
    expect(store().afterPrayer.totals['after-dawn-dusk']).toBe(16)
    expect(store().totalRecitations).toBe(21)
  })

  it('keeps every repetition of a reading that is started over', () => {
    completeFajr()
    store().resetAfterPrayer(DAY, 'fajr')
    completeFajr()
    expect(store().afterPrayer.totals).toEqual({ 'after-once': 2, 'after-thrice': 6, 'after-dawn-dusk': 20 })
    expect(record()?.recitations).toBe(28)
  })
})

describe('pruning', () => {
  it('drops counts after a month and records after about ten years, never the totals', () => {
    const oldCounts = shiftDateKey(DAY, -DETAIL_DAYS - 1)
    const ancient = shiftDateKey(DAY, -SESSION_DAYS - 1)
    store().incrementAfterPrayer(ancient, 'fajr', 'after-once')
    store().incrementAfterPrayer(oldCounts, 'fajr', 'after-once')
    store().incrementAfterPrayer(DAY, 'fajr', 'after-once')
    expect(Object.keys(store().afterPrayer.days)).toEqual([DAY])
    expect(Object.keys(store().afterPrayer.sessions).sort()).toEqual([oldCounts, DAY])
    expect(store().afterPrayer.totals).toEqual({ 'after-once': 3 })
  })
})
