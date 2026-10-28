import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import type { DateKey, PrayerName } from '../../shared/types'
import type { AfterPrayerDay } from './afterPrayerData'
import {
  afterPrayerCompletionRate,
  afterPrayerInRange,
  afterPrayerLifetime,
  computeAfterPrayerStreaks,
} from './afterPrayerTracking'
import type { AfterPrayerHistory } from './afterPrayerTracking'
import { azkarData } from './data'
import type { SessionRecord } from './progressData'
import { snippet } from './reader/text'
import { afterThrice, withAfterPrayer } from './testing/fixture'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

const TODAY = '2026-10-12'
const day = (offset: number): DateKey => shiftDateKey(TODAY, offset)
const finished: SessionRecord = { completed: true, done: 2, total: 2, recitations: 4 }
const begun: SessionRecord = { completed: false, done: 1, total: 2, recitations: 1 }
const FIVE = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

/** `{ [-1]: 'fdamI' }`: yesterday, each letter a prayer completed; an upper-case letter begun only. */
function history(description: Record<number, string>): AfterPrayerHistory {
  const letters: Record<string, PrayerName> = { f: 'fajr', d: 'dhuhr', a: 'asr', m: 'maghrib', i: 'isha' }
  const result: AfterPrayerHistory = {}
  for (const [offset, text] of Object.entries(description)) {
    const entry: AfterPrayerDay = {}
    for (const letter of text) {
      entry[letters[letter.toLowerCase()]!] = letter === letter.toLowerCase() ? finished : begun
    }
    result[day(Number(offset))] = entry
  }
  return result
}

beforeEach(() => {
  withAfterPrayer(azkarData)
})

afterEach(() => {
  delete azkarData.afterPrayer
})

describe('days in a range', () => {
  it('lists the days with a record, oldest first, both ends included', () => {
    const sessions = history({ [-9]: 'f', [-6]: 'fd', [-1]: 'I', 0: 'f' })
    expect(afterPrayerInRange(sessions, day(-6), day(-1))).toEqual([
      { dateKey: day(-6), prayers: { fajr: finished, dhuhr: finished } },
      { dateKey: day(-1), prayers: { isha: begun } },
    ])
    expect(afterPrayerInRange(sessions, 'nonsense', TODAY)).toEqual([])
  })
})

describe('streaks', () => {
  const now = (sessions: AfterPrayerHistory, phase: 'morning' | 'beforeDawn' = 'morning') =>
    computeAfterPrayerStreaks(sessions, TODAY, phase)

  it('is nothing at all for a new user, or while the dataset has no after-prayer azkar', () => {
    expect(now({}).all).toEqual({ current: 0, best: 0 })
    expect(now({}).byPrayer.fajr).toEqual({ current: 0, best: 0 })
    expect(computeAfterPrayerStreaks(history({ [-1]: 'fdami' }), TODAY, 'morning', []).all).toEqual({ current: 0, best: 0 })
  })

  it('counts days with every prayer’s azkar completed, and does not hold today against the user', () => {
    const sessions = history({ [-3]: 'fdami', [-2]: 'fdami', [-1]: 'fdami', 0: 'fD' })
    expect(now(sessions).all).toEqual({ current: 3, best: 3 })
    expect(now({ ...sessions, ...history({ 0: 'fdami' }) }).all).toEqual({ current: 4, best: 4 })
  })

  it('ends at a day with a prayer missed, and keeps a streak for each prayer', () => {
    const sessions = history({ [-4]: 'fdami', [-3]: 'fdami', [-2]: 'fdam', [-1]: 'fdami' })
    expect(now(sessions).all).toEqual({ current: 1, best: 2 })
    expect(now(sessions).byPrayer.fajr).toEqual({ current: 4, best: 4 })
    expect(now(sessions).byPrayer.isha).toEqual({ current: 1, best: 2 })
  })

  it('before Fajr, still counts yesterday as open', () => {
    const sessions = history({ [-3]: 'fdami', [-2]: 'fdami', [-1]: 'fdam' })
    // At 1 am the night of the 11th is not over: its Isha can still be read.
    expect(now(sessions, 'beforeDawn').all).toEqual({ current: 2, best: 2 })
    expect(now(sessions, 'morning').all).toEqual({ current: 0, best: 2 })
  })

  it('counts only the prayers that have after-prayer azkar', () => {
    const sessions = history({ [-2]: 'fm', [-1]: 'fm' })
    expect(computeAfterPrayerStreaks(sessions, TODAY, 'morning', ['fajr', 'maghrib']).all).toEqual({ current: 2, best: 2 })
    expect(computeAfterPrayerStreaks(sessions, TODAY, 'morning', ['fajr', 'maghrib']).byPrayer.dhuhr).toEqual({
      current: 0,
      best: 0,
    })
  })

  it('ignores records dated after today', () => {
    expect(now(history({ [-1]: 'fdami', 1: 'fdami' })).all).toEqual({ current: 1, best: 1 })
  })
})

describe('completion rate', () => {
  it('is nothing for a new user', () => {
    expect(afterPrayerCompletionRate({}, TODAY, 'morning', 7).all).toEqual({ completed: 0, due: 0, rate: null })
  })

  it('measures from the first day with a record, every prayer of a closed day being due', () => {
    // Started two days ago: Fajr only that day, every prayer yesterday.
    const rates = afterPrayerCompletionRate(history({ [-2]: 'f', [-1]: 'fdami' }), TODAY, 'morning', 7)
    expect(rates.all).toEqual({ completed: 6, due: 10, rate: 0.6 })
    expect(rates.byPrayer.fajr).toEqual({ completed: 2, due: 2, rate: 1 })
    expect(rates.byPrayer.dhuhr).toEqual({ completed: 1, due: 2, rate: 0.5 })
  })

  it('counts today’s prayers only once completed', () => {
    const rates = afterPrayerCompletionRate(history({ [-1]: 'fdami', 0: 'fD' }), TODAY, 'morning', 7)
    expect(rates.all).toEqual({ completed: 6, due: 6, rate: 1 })
  })

  it('looks back over the window only, today included', () => {
    const sessions = history({ [-40]: 'fdami', [-6]: 'f', [-1]: 'f' })
    // Window of 7: days -6 to 0. Fajr on -6 and -1; nothing on -5 to -2.
    expect(afterPrayerCompletionRate(sessions, TODAY, 'morning', 7).byPrayer.fajr).toEqual({
      completed: 2,
      due: 6,
      rate: 2 / 6,
    })
    expect(afterPrayerCompletionRate(sessions, TODAY, 'morning', 30).all.due).toBe(29 * FIVE.length)
  })

  it('before Fajr, leaves yesterday open', () => {
    const rates = afterPrayerCompletionRate(history({ [-2]: 'fdami', [-1]: 'fdam' }), TODAY, 'beforeDawn', 7)
    expect(rates.all).toEqual({ completed: 9, due: 9, rate: 1 })
  })
})

describe('lifetime', () => {
  it('counts completed readings per prayer, and every repetition after the prayers by dhikr', () => {
    const lifetime = afterPrayerLifetime({
      sessions: history({ [-2]: 'fdami', [-1]: 'fM', 0: 'f' }),
      totals: { 'after-thrice': 21, 'after-once': 7, gone: 2 },
    })
    expect(lifetime.completed).toEqual({ fajr: 3, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 })
    expect(lifetime.completedAll).toBe(7)
    expect(lifetime.recitations).toBe(30)
    expect(lifetime.byDhikr).toEqual([
      { id: 'after-thrice', recitations: 21, snippet: snippet(afterThrice.arabic) },
      { id: 'after-once', recitations: 7, snippet: expect.any(String) },
      { id: 'gone', recitations: 2, snippet: null },
    ])
  })
})
