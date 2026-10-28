import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { exportBackup } from '../../shared/storage'
import { getCollection } from './data'
import type { CollectionId } from './data'
import {
  AZKAR_PROGRESS_STORAGE_KEY,
  AZKAR_PROGRESS_VERSION,
  DETAIL_DAYS,
  pruneOlderThan,
  sanitizeProgress,
  SESSION_DAYS,
  useAzkarProgress,
} from './progressStore'
import type { ProgressData } from './progressStore'
import { sanitizeProgressV1 } from './progressV1'
import { summarize } from './session'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

const DAY = '2026-10-12'
const T0 = Date.parse(`${DAY}T06:00:00Z`)
const store = () => useAzkarProgress.getState()
const counts = (dateKey = DAY, collection: 'morning' | 'evening' = 'morning') =>
  store().days[dateKey]?.[collection]
const record = (dateKey = DAY, collection: CollectionId = 'morning') => store().sessions[dateKey]?.[collection]
const empty = (): ProgressData => ({ days: {}, sessions: {}, totals: {}, totalRecitations: 0 })

/** Finishes the fixture's morning session: tasbih ×3, hamd ×1, takbir ×10. */
function completeMorning(dateKey = DAY) {
  for (const id of ['tasbih', 'hamd', 'takbir']) store().complete(dateKey, 'morning', id)
}

/** Moves the clock on by `minutes`. */
function later(minutes: number) {
  vi.setSystemTime(Date.now() + minutes * 60_000)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  useAzkarProgress.setState(empty())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('counting', () => {
  it('counts one repetition at a time and stops at the target', () => {
    for (let i = 0; i < 5; i++) store().increment(DAY, 'morning', 'tasbih')
    expect(counts()).toEqual({ tasbih: 3 })
  })

  it('takes one back and forgets a dhikr that returns to zero', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'morning', 'tasbih')
    store().decrement(DAY, 'morning', 'tasbih')
    expect(counts()).toEqual({ tasbih: 1 })

    store().decrement(DAY, 'morning', 'tasbih')
    store().decrement(DAY, 'morning', 'tasbih')
    expect(store().days).toEqual({})
  })

  it('marks a dhikr done in one step', () => {
    store().complete(DAY, 'morning', 'takbir')
    expect(counts()).toEqual({ takbir: 10 })
  })

  it('keeps sessions and days apart', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'evening', 'tasbih')
    store().increment(DAY, 'evening', 'tasbih')
    store().increment('2026-10-13', 'morning', 'hamd')
    expect(store().days).toEqual({
      [DAY]: { morning: { tasbih: 1 }, evening: { tasbih: 2 } },
      '2026-10-13': { morning: { hamd: 1 } },
    })
  })

  it('ignores a dhikr outside the session, an unknown session or an impossible date', () => {
    store().increment(DAY, 'evening', 'takbir') // takbir is not in the evening fixture
    store().increment(DAY, 'sleep', 'tasbih') // no such session in the fixture
    store().increment(DAY, 'nope' as never, 'tasbih')
    store().increment('2026-02-30', 'morning', 'tasbih')
    store().increment('today', 'morning', 'tasbih')
    store().complete(DAY, 'morning', 'unknown')
    expect(store()).toMatchObject(empty())
  })

  it('clears one session for one day without touching the rest', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'evening', 'hamd')
    store().increment('2026-10-11', 'morning', 'tasbih')
    store().resetSession(DAY, 'morning')
    expect(store().days).toEqual({
      [DAY]: { evening: { hamd: 1 } },
      '2026-10-11': { morning: { tasbih: 1 } },
    })
  })
})

describe('session records', () => {
  it('opens a record at the first count and follows the latest one', () => {
    store().increment(DAY, 'morning', 'tasbih')
    expect(record()).toEqual({ startedAt: T0, lastAt: T0, completed: false, done: 0, total: 3, recitations: 1 })

    later(2)
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'morning', 'tasbih')
    later(1)
    store().increment(DAY, 'morning', 'hamd')
    expect(record()).toEqual({
      startedAt: T0,
      lastAt: T0 + 3 * 60_000,
      completed: false,
      done: 2,
      total: 3,
      recitations: 4,
    })
  })

  it('counts an undo as activity and takes its repetition back', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'morning', 'tasbih')
    later(5)
    store().decrement(DAY, 'morning', 'tasbih')
    expect(record()).toMatchObject({ startedAt: T0, lastAt: T0 + 5 * 60_000, recitations: 1, done: 0 })
  })

  it('leaves no record behind when a stray tap is taken straight back', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().decrement(DAY, 'morning', 'tasbih')
    expect(store().sessions).toEqual({})

    // The next real start is the session's start.
    later(30)
    store().increment(DAY, 'morning', 'tasbih')
    expect(record()?.startedAt).toBe(T0 + 30 * 60_000)
  })

  it('records "mark all done" as every remaining repetition', () => {
    for (let i = 0; i < 4; i++) store().increment(DAY, 'morning', 'takbir')
    store().complete(DAY, 'morning', 'takbir')
    expect(record()).toMatchObject({ done: 1, recitations: 10 })
  })

  it('keeps one record per session and day', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'evening', 'hamd')
    store().increment('2026-10-13', 'morning', 'hamd')
    expect(Object.keys(store().sessions).sort()).toEqual([DAY, '2026-10-13'])
    expect(Object.keys(store().sessions[DAY]!).sort()).toEqual(['evening', 'morning'])
    expect(record(DAY, 'evening')).toMatchObject({ done: 1, total: 2, recitations: 1 })
    expect(record('2026-10-13')).toMatchObject({ done: 1, total: 3, recitations: 1 })
  })
})

describe('completion', () => {
  it('records a session, with its time, when its last dhikr reaches its count', () => {
    store().complete(DAY, 'morning', 'tasbih')
    store().complete(DAY, 'morning', 'hamd')
    expect(record()).toMatchObject({ completed: false, done: 2 })
    expect(record()).not.toHaveProperty('completedAt')

    later(12)
    store().complete(DAY, 'morning', 'takbir')
    expect(record()).toEqual({
      startedAt: T0,
      lastAt: T0 + 12 * 60_000,
      completedAt: T0 + 12 * 60_000,
      completed: true,
      done: 3,
      total: 3,
      recitations: 14,
    })
  })

  it('records each session of a day however they were finished', () => {
    store().complete(DAY, 'evening', 'hamd')
    store().complete(DAY, 'evening', 'tasbih')
    completeMorning()
    expect(record(DAY, 'morning')?.completed).toBe(true)
    expect(record(DAY, 'evening')?.completed).toBe(true)
  })

  it('withdraws the completion when the final count is undone, and restores it when redone', () => {
    completeMorning()
    later(1)
    store().decrement(DAY, 'morning', 'takbir')
    expect(record()).toMatchObject({ completed: false, done: 2, recitations: 13 })
    expect(record()).not.toHaveProperty('completedAt')

    later(1)
    store().increment(DAY, 'morning', 'takbir')
    expect(record()).toMatchObject({ completed: true, completedAt: T0 + 2 * 60_000, done: 3, recitations: 14 })
  })

  it('keeps the completion and its time when the session is started over and read again', () => {
    completeMorning()
    later(60)
    store().resetSession(DAY, 'morning')
    expect(counts()).toBeUndefined()
    // The reading begins again from nothing; what was recited stays recited.
    expect(record()).toEqual({
      startedAt: T0,
      lastAt: T0,
      completedAt: T0,
      completed: true,
      done: 0,
      total: 3,
      recitations: 14,
    })

    // Counting again from scratch is not an undo of the earlier completion.
    store().increment(DAY, 'morning', 'tasbih')
    store().decrement(DAY, 'morning', 'tasbih')
    expect(record()).toMatchObject({ completed: true, completedAt: T0, recitations: 14 })

    // Nor does finishing the second reading move the time of the first.
    completeMorning()
    expect(record()).toMatchObject({ completed: true, completedAt: T0, done: 3, recitations: 28 })
  })

  it('keeps one completion per session and day, so undoing the end of a second reading withdraws it', () => {
    // Known behaviour, documented rather than wanted: the record does not remember which
    // reading earned its completion.
    completeMorning()
    store().resetSession(DAY, 'morning')

    store().complete(DAY, 'morning', 'tasbih')
    store().complete(DAY, 'morning', 'hamd')
    for (let i = 0; i < 9; i++) store().increment(DAY, 'morning', 'takbir')
    expect(record()).toMatchObject({ completed: true, completedAt: T0 }) // second reading one count short: untouched

    store().increment(DAY, 'morning', 'takbir')
    expect(record()).toMatchObject({ completed: true, completedAt: T0 }) // second reading complete: still one

    later(1)
    store().decrement(DAY, 'morning', 'takbir')
    expect(record()?.completed).toBe(false) // the first reading's completion goes with it
    const stored = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!) as {
      state: { sessions: ProgressData['sessions'] }
    }
    expect(stored.state.sessions[DAY]?.morning?.completed).toBe(false)

    store().increment(DAY, 'morning', 'takbir')
    expect(record()).toMatchObject({ completed: true, completedAt: T0 + 60_000 }) // back, timed when redone
  })

  it('leaves a session that is reset before any count as it was', () => {
    store().resetSession(DAY, 'morning')
    expect(store()).toMatchObject(empty())
  })
})

describe('lifetime totals', () => {
  it('adds every repetition to its dhikr and to the lifetime total', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'morning', 'tasbih')
    store().complete(DAY, 'morning', 'takbir')
    // tasbih is in both sessions: one dhikr, one total.
    store().increment(DAY, 'evening', 'tasbih')
    store().increment('2026-10-13', 'morning', 'tasbih')
    expect(store().totals).toEqual({ tasbih: 4, takbir: 10 })
    expect(store().totalRecitations).toBe(14)
  })

  it('subtracts an undone repetition', () => {
    store().increment(DAY, 'morning', 'tasbih')
    store().increment(DAY, 'morning', 'hamd')
    store().decrement(DAY, 'morning', 'tasbih')
    expect(store().totals).toEqual({ hamd: 1 })
    expect(store().totalRecitations).toBe(1)
  })

  it('keeps every repetition of a reading that is started over', () => {
    completeMorning()
    store().resetSession(DAY, 'morning')
    expect(store().totals).toEqual({ tasbih: 3, hamd: 1, takbir: 10 })
    expect(store().totalRecitations).toBe(14)
    completeMorning()
    expect(store().totalRecitations).toBe(28)
  })

  it('never goes below zero for counts that were never in the totals', () => {
    // Counts with no totals behind them, as from an imported backup of a newer build.
    useAzkarProgress.setState({ days: { [DAY]: { morning: { tasbih: 2 } } } })
    store().decrement(DAY, 'morning', 'tasbih')
    expect(store().totals).toEqual({})
    expect(store().totalRecitations).toBe(0)
    expect(record()).toMatchObject({ recitations: 0, done: 0 })
  })
})

describe('every count path keeps the records consistent', () => {
  /** A small deterministic generator (mulberry32), so a failure can be replayed. */
  function random(seed: number) {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
    }
  }

  it('after any sequence of taps, undos, "mark all done" and "start over"', () => {
    const next = random(20261012)
    function pick<T>(list: readonly T[]): T {
      return list[Math.floor(next() * list.length)]!
    }
    const dates = [DAY, '2026-10-13']
    const collections = ['morning', 'evening'] as const
    // What version 1's history would hold, worked out independently of the store.
    const completed = new Set<string>()
    const recited = new Map<string, number>()
    const perDhikr = new Map<string, number>()

    for (let step = 0; step < 2000; step++) {
      later(1)
      const dateKey = pick(dates)
      const collection = pick(collections)
      const items = getCollection(collection)
      const dhikr = pick(items)
      const before = store().days[dateKey]?.[collection]
      const wasComplete = summarize(items, before).status === 'complete'
      const action = pick(['increment', 'increment', 'increment', 'decrement', 'complete', 'resetSession'] as const)

      if (action === 'resetSession') store().resetSession(dateKey, collection)
      else store()[action](dateKey, collection, dhikr.id)

      const after = store().days[dateKey]?.[collection]
      const slot = `${dateKey}:${collection}`
      const change = (after?.[dhikr.id] ?? 0) - (before?.[dhikr.id] ?? 0)
      if (action !== 'resetSession') {
        recited.set(slot, (recited.get(slot) ?? 0) + change)
        perDhikr.set(dhikr.id, (perDhikr.get(dhikr.id) ?? 0) + change)
        const isComplete = summarize(items, after).status === 'complete'
        if (isComplete !== wasComplete) {
          if (isComplete) completed.add(slot)
          else completed.delete(slot)
        }
      }

      const state = store()
      for (const date of dates) {
        for (const name of collections) {
          const kept = state.sessions[date]?.[name]
          const dayCounts = state.days[date]?.[name]
          const key = `${date}:${name}`
          const summary = summarize(getCollection(name), dayCounts)
          if (!kept) {
            expect(dayCounts).toBeUndefined()
            expect(completed.has(key)).toBe(false)
            expect(recited.get(key) ?? 0).toBe(0)
            continue
          }
          expect(kept.done).toBe(summary.done)
          expect(kept.total).toBe(summary.total)
          expect(kept.completed).toBe(completed.has(key))
          expect(kept.completedAt !== undefined).toBe(kept.completed)
          expect(kept.recitations).toBe(recited.get(key) ?? 0)
          // Start over clears counts, never recitations.
          expect(kept.recitations).toBeGreaterThanOrEqual(Object.values(dayCounts ?? {}).reduce((a, b) => a + b, 0))
          expect(kept.startedAt).toBeLessThanOrEqual(kept.lastAt!)
        }
      }
      expect(state.totals).toEqual(Object.fromEntries([...perDhikr].filter(([, n]) => n > 0)))
      const sessionSum = Object.values(state.sessions)
        .flatMap((day) => Object.values(day))
        .reduce((sum, kept) => sum + kept.recitations, 0)
      expect(state.totalRecitations).toBe(sessionSum)
    }
    // The walk did reach every kind of state.
    expect(completed.size).toBeGreaterThan(0)
    expect(store().totalRecitations).toBeGreaterThan(100)
  })
})

describe('pruning', () => {
  it('drops per-dhikr counts once they are more than a month old', () => {
    const lastKept = shiftDateKey(DAY, -DETAIL_DAYS)
    const firstDropped = shiftDateKey(DAY, -DETAIL_DAYS - 1)
    expect(DETAIL_DAYS).toBe(30)
    store().increment(firstDropped, 'morning', 'tasbih')
    store().increment(lastKept, 'morning', 'tasbih')
    expect(Object.keys(store().days).sort()).toEqual([firstDropped, lastKept])

    store().increment(DAY, 'morning', 'tasbih')
    expect(Object.keys(store().days).sort()).toEqual([lastKept, DAY])
    // The session records of those days stay.
    expect(Object.keys(store().sessions).sort()).toEqual([firstDropped, lastKept, DAY])
  })

  it('keeps session records for about ten years, then lets them go', () => {
    const lastKept = shiftDateKey(DAY, -SESSION_DAYS)
    const firstDropped = shiftDateKey(DAY, -SESSION_DAYS - 1)
    expect(SESSION_DAYS).toBeGreaterThanOrEqual(3652)
    const done = { completed: true, done: 3, total: 3, recitations: 14 }
    useAzkarProgress.setState({
      sessions: { [firstDropped]: { morning: done }, [lastKept]: { evening: done }, '2026-10-01': { morning: done } },
    })
    completeMorning()
    expect(Object.keys(store().sessions).sort()).toEqual([lastKept, '2026-10-01', DAY])
  })

  it('never prunes the lifetime totals', () => {
    store().increment(shiftDateKey(DAY, -SESSION_DAYS - 10), 'morning', 'tasbih')
    store().increment(DAY, 'morning', 'tasbih')
    expect(Object.keys(store().sessions)).toEqual([DAY])
    expect(store().totals).toEqual({ tasbih: 2 })
    expect(store().totalRecitations).toBe(2)
  })

  it('never prunes entries dated after the day being written', () => {
    // If the device clock was wrong for a while, coming back must not erase anything.
    store().increment('2027-06-01', 'morning', 'tasbih')
    completeMorning()
    expect(store().days['2027-06-01']).toEqual({ morning: { tasbih: 1 } })
    expect(store().sessions['2027-06-01']?.morning).toMatchObject({ recitations: 1 })
  })

  it('returns the same object when there is nothing to prune', () => {
    const entries = { [DAY]: 1, '2026-10-10': 2 }
    expect(pruneOlderThan(entries, DAY, 7)).toBe(entries)
    expect(pruneOlderThan(entries, '2026-10-20', 7)).toEqual({})
  })
})

describe('sanitizeProgress', () => {
  const kept = {
    startedAt: T0,
    lastAt: T0 + 60_000,
    completedAt: T0 + 60_000,
    completed: true,
    done: 3,
    total: 3,
    recitations: 14,
  }

  it('returns empty progress for anything that is not an object', () => {
    for (const value of [undefined, null, 'x', 7, [], true]) {
      expect(sanitizeProgress(value)).toEqual(empty())
    }
  })

  it('keeps well-formed progress untouched', () => {
    const data: ProgressData = {
      days: { [DAY]: { morning: { tasbih: 2 }, evening: { hamd: 1 } } },
      sessions: {
        [DAY]: { morning: kept, evening: { completed: false, done: 1, total: 2, recitations: 1 } },
        '2026-10-11': { sleep: { completed: true, done: 0, total: 0, recitations: 0 } },
      },
      totals: { tasbih: 2, hamd: 1 },
      totalRecitations: 3,
    }
    expect(sanitizeProgress(data)).toEqual(data)
    expect(sanitizeProgress(JSON.parse(JSON.stringify(data)))).toEqual(data)
  })

  it('drops impossible dates, unknown sessions and counts that are not positive whole numbers', () => {
    const cleaned = sanitizeProgress({
      days: {
        [DAY]: {
          morning: { tasbih: 2, hamd: -1, takbir: 1.5, zero: 0, text: '3', huge: 1e9, nothing: null },
          midnight: { tasbih: 1 },
          evening: 'all of them',
        },
        '2026-13-01': { morning: { tasbih: 1 } },
        yesterday: { morning: { tasbih: 1 } },
        '2026-10-11': { morning: {} },
        '2026-10-10': null,
      },
    })
    expect(cleaned.days).toEqual({ [DAY]: { morning: { tasbih: 2 } } })
  })

  it('drops a session record that lacks a sound required field, and keeps the others', () => {
    const cleaned = sanitizeProgress({
      sessions: {
        [DAY]: {
          morning: { ...kept, completed: 'yes' },
          evening: { ...kept, done: 4 }, // more done than there are
          sleep: { ...kept, recitations: -1 },
        },
        '2026-10-11': {
          morning: { ...kept, total: 2.5 },
          evening: kept,
          brunch: kept,
        },
        '2026-10-10': { morning: null, evening: [] },
        '2026-02-30': { morning: kept },
      },
    })
    expect(cleaned.sessions).toEqual({ '2026-10-11': { evening: kept } })
  })

  it('drops a time that is not a plausible instant, keeping the record without it', () => {
    const cleaned = sanitizeProgress({
      sessions: {
        [DAY]: {
          morning: { ...kept, startedAt: '06:00', lastAt: -5, completedAt: 1.5 },
          evening: { ...kept, startedAt: Date.UTC(1970, 0, 2), lastAt: Date.UTC(2300, 0, 1) },
          // A completion time on a record that is not completed belongs to nothing.
          sleep: { ...kept, completed: false },
        },
      },
    })
    expect(cleaned.sessions[DAY]).toEqual({
      morning: { completed: true, done: 3, total: 3, recitations: 14 },
      evening: { completedAt: kept.completedAt, completed: true, done: 3, total: 3, recitations: 14 },
      sleep: { startedAt: kept.startedAt, lastAt: kept.lastAt, completed: false, done: 3, total: 3, recitations: 14 },
    })
  })

  it('keeps sound totals, and never takes the lifetime total as less than they add up to', () => {
    expect(
      sanitizeProgress({
        totals: { tasbih: 5, hamd: 0, takbir: -2, text: '4', half: 0.5, '': 3 },
        totalRecitations: 2,
      }),
    ).toMatchObject({ totals: { tasbih: 5 }, totalRecitations: 5 })
    expect(sanitizeProgress({ totals: { tasbih: 5 }, totalRecitations: 9 }).totalRecitations).toBe(9)
    expect(sanitizeProgress({ totals: { tasbih: 5 }, totalRecitations: 'lots' }).totalRecitations).toBe(5)
    expect(sanitizeProgress({ totals: 'all', totalRecitations: 3 })).toMatchObject({ totals: {}, totalRecitations: 3 })
  })

  it('is not fooled by keys that shadow Object.prototype', () => {
    const hostile: unknown = JSON.parse(
      `{"days":{"${DAY}":{"morning":{"__proto__":5,"constructor":2}},"__proto__":{"morning":{"tasbih":1}}},` +
        `"sessions":{"__proto__":{"morning":{"completed":true,"done":0,"total":0,"recitations":0}}},` +
        `"totals":{"__proto__":4}}`,
    )
    const cleaned = sanitizeProgress(hostile)
    expect(Object.keys(cleaned.days)).toEqual([DAY])
    expect(Object.getPrototypeOf(cleaned.days[DAY]!.morning)).toBe(Object.prototype)
    expect(cleaned.sessions).toEqual({})
    expect(Object.getPrototypeOf(cleaned.totals)).toBe(Object.prototype)
    expect(cleaned.totalRecitations).toBe(4)
    expect(({} as Record<string, unknown>).morning).toBeUndefined()
  })
})

describe('persistence', () => {
  it('stores only the data, under the app’s prefix and version 3, so backups include it', () => {
    store().increment(DAY, 'morning', 'tasbih')
    const raw: unknown = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!)
    // Version 3 added the after-prayer azkar and the tasbih counter, and left the rest as it was.
    expect(AZKAR_PROGRESS_VERSION).toBe(3)
    expect(raw).toEqual({
      state: {
        days: { [DAY]: { morning: { tasbih: 1 } } },
        sessions: {
          [DAY]: { morning: { startedAt: T0, lastAt: T0, completed: false, done: 0, total: 3, recitations: 1 } },
        },
        totals: { tasbih: 1 },
        totalRecitations: 1,
        afterPrayer: { days: {}, sessions: {}, totals: {} },
        tasbih: { days: {}, totals: {}, free: 0 },
        // Nothing completed yet: see the next test.
        history: {},
      },
      version: 3,
    })
    expect(exportBackup().data[AZKAR_PROGRESS_STORAGE_KEY]).toEqual(raw)
  })

  it('also stores the completions in version 1’s shape, so an older build that opens the data keeps them', async () => {
    completeMorning()
    store().complete('2026-10-11', 'evening', 'hamd')
    store().complete('2026-10-11', 'evening', 'tasbih')
    store().increment(DAY, 'evening', 'tasbih')
    const stored = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!) as { state: { history: unknown } }
    expect(stored.state.history).toEqual({ [DAY]: ['morning'], '2026-10-11': ['evening'] })

    // A version 1 build reads only `days` and `history`, and saves just those at version 1.
    useAzkarProgress.setState(empty())
    localStorage.setItem(
      AZKAR_PROGRESS_STORAGE_KEY,
      JSON.stringify({ state: sanitizeProgressV1(stored.state), version: 1 }),
    )
    await useAzkarProgress.persist.rehydrate()
    expect(store().sessions[DAY]?.morning?.completed).toBe(true)
    expect(store().sessions['2026-10-11']?.evening?.completed).toBe(true)
    expect(store().sessions[DAY]?.evening).toMatchObject({ completed: false, recitations: 1 })
  })

  it('never reads its own copy of the completions back: the session records are what counts', async () => {
    completeMorning()
    const stored = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!) as {
      state: Record<string, unknown>
      version: number
    }
    stored.state.history = { '2026-10-01': ['evening'] }
    localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, JSON.stringify(stored))
    await useAzkarProgress.persist.rehydrate()
    expect(Object.keys(store().sessions)).toEqual([DAY])
    expect(store()).not.toHaveProperty('history')
  })

  it('reads back exactly what it stored', async () => {
    completeMorning()
    store().increment(DAY, 'evening', 'tasbih')
    const before = sanitizeProgress(store())
    const raw = localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!
    useAzkarProgress.setState(empty())
    localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, raw)
    await useAzkarProgress.persist.rehydrate()
    expect(sanitizeProgress(store())).toEqual(before)
  })

  it('validates what it loads, as after importing a backup', async () => {
    localStorage.setItem(
      AZKAR_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        state: {
          days: { [DAY]: { morning: { tasbih: 2, hamd: 'lots' } }, 'not-a-date': { morning: { tasbih: 1 } } },
          sessions: { '2026-10-11': { morning: { completed: true, done: 3, total: 3, recitations: 14 }, unknown: {} } },
          totals: { tasbih: 16, hamd: 'x' },
          totalRecitations: 16,
          increment: 'not a function',
        },
        version: 2,
      }),
    )
    await useAzkarProgress.persist.rehydrate()
    expect(store().days).toEqual({ [DAY]: { morning: { tasbih: 2 } } })
    expect(store().sessions).toEqual({
      '2026-10-11': { morning: { completed: true, done: 3, total: 3, recitations: 14 } },
    })
    expect(store().totals).toEqual({ tasbih: 16 })
    expect(store().totalRecitations).toBe(16)
    expect(typeof store().increment).toBe('function')
  })

  it('reads data stamped with a newer version as far as it can', async () => {
    localStorage.setItem(
      AZKAR_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        state: { days: { [DAY]: { evening: { hamd: 1 } } }, totals: { hamd: 1 }, extra: true },
        version: 7,
      }),
    )
    await useAzkarProgress.persist.rehydrate()
    expect(store().days).toEqual({ [DAY]: { evening: { hamd: 1 } } })
    expect(store().sessions).toEqual({})
    expect(store().totals).toEqual({ hamd: 1 })
    expect(store().totalRecitations).toBe(1)
  })

  it('survives a stored value that is not usable at all', async () => {
    for (const broken of ['{not json', '"a string"', '{"state":null,"version":2}', '{"state":[1,2],"version":2}']) {
      useAzkarProgress.setState(empty())
      localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, broken)
      await useAzkarProgress.persist.rehydrate()
      expect(store()).toMatchObject(empty())

      store().increment(DAY, 'morning', 'tasbih')
      expect(counts()).toEqual({ tasbih: 1 })
    }
  })
})
