import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { exportBackup } from '../../shared/storage'
import {
  AZKAR_PROGRESS_STORAGE_KEY,
  DETAIL_DAYS,
  HISTORY_DAYS,
  pruneOlderThan,
  sanitizeProgress,
  useAzkarProgress,
} from './progressStore'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

const DAY = '2026-10-12'
const store = () => useAzkarProgress.getState()
const counts = (dateKey = DAY, collection: 'morning' | 'evening' = 'morning') =>
  store().days[dateKey]?.[collection]

/** Finishes the fixture's morning session: tasbih ×3, hamd ×1, takbir ×10. */
function completeMorning(dateKey = DAY) {
  for (const id of ['tasbih', 'hamd', 'takbir']) store().complete(dateKey, 'morning', id)
}

beforeEach(() => {
  useAzkarProgress.setState({ days: {}, history: {} })
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
    expect(store().days).toEqual({})
    expect(store().history).toEqual({})
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

describe('history', () => {
  it('records a session when its last dhikr reaches its count', () => {
    store().complete(DAY, 'morning', 'tasbih')
    store().complete(DAY, 'morning', 'hamd')
    expect(store().history).toEqual({})
    store().complete(DAY, 'morning', 'takbir')
    expect(store().history).toEqual({ [DAY]: ['morning'] })
  })

  it('lists a day’s sessions in a fixed order however they were finished', () => {
    store().complete(DAY, 'evening', 'hamd')
    store().complete(DAY, 'evening', 'tasbih')
    completeMorning()
    expect(store().history).toEqual({ [DAY]: ['morning', 'evening'] })
  })

  it('withdraws the record when the final count is undone, and restores it when redone', () => {
    completeMorning()
    store().decrement(DAY, 'morning', 'takbir')
    expect(store().history).toEqual({})
    store().increment(DAY, 'morning', 'takbir')
    expect(store().history).toEqual({ [DAY]: ['morning'] })
  })

  it('keeps the record when the session is started over and read again', () => {
    completeMorning()
    store().resetSession(DAY, 'morning')
    expect(counts()).toBeUndefined()
    expect(store().history).toEqual({ [DAY]: ['morning'] })

    // Counting again from scratch is not an undo of the earlier completion.
    store().increment(DAY, 'morning', 'tasbih')
    store().decrement(DAY, 'morning', 'tasbih')
    expect(store().history).toEqual({ [DAY]: ['morning'] })
  })
})

describe('pruning', () => {
  it('drops per-dhikr counts once they are more than a week old', () => {
    const lastKept = shiftDateKey(DAY, -DETAIL_DAYS)
    const firstDropped = shiftDateKey(DAY, -DETAIL_DAYS - 1)
    store().increment(firstDropped, 'morning', 'tasbih')
    store().increment(lastKept, 'morning', 'tasbih')
    expect(Object.keys(store().days).sort()).toEqual([firstDropped, lastKept])

    store().increment(DAY, 'morning', 'tasbih')
    expect(Object.keys(store().days).sort()).toEqual([lastKept, DAY])
  })

  it('keeps completed sessions for about 400 days, then lets them go', () => {
    const lastKept = shiftDateKey(DAY, -HISTORY_DAYS)
    const firstDropped = shiftDateKey(DAY, -HISTORY_DAYS - 1)
    useAzkarProgress.setState({
      history: { [firstDropped]: ['morning'], [lastKept]: ['evening'], '2026-10-01': ['morning', 'evening'] },
    })
    completeMorning()
    expect(store().history).toEqual({
      [lastKept]: ['evening'],
      '2026-10-01': ['morning', 'evening'],
      [DAY]: ['morning'],
    })
  })

  it('never prunes entries dated after the day being written', () => {
    // If the device clock was wrong for a while, coming back must not erase anything.
    store().increment('2027-06-01', 'morning', 'tasbih')
    useAzkarProgress.setState({ history: { '2027-06-01': ['evening'] } })
    completeMorning()
    expect(store().days['2027-06-01']).toEqual({ morning: { tasbih: 1 } })
    expect(store().history['2027-06-01']).toEqual(['evening'])
  })

  it('returns the same object when there is nothing to prune', () => {
    const entries = { [DAY]: 1, '2026-10-10': 2 }
    expect(pruneOlderThan(entries, DAY, 7)).toBe(entries)
    expect(pruneOlderThan(entries, '2026-10-20', 7)).toEqual({})
  })
})

describe('sanitizeProgress', () => {
  it('returns empty progress for anything that is not an object', () => {
    for (const value of [undefined, null, 'x', 7, [], true]) {
      expect(sanitizeProgress(value)).toEqual({ days: {}, history: {} })
    }
  })

  it('keeps well-formed progress untouched', () => {
    const data = {
      days: { [DAY]: { morning: { tasbih: 2 }, evening: { hamd: 1 } } },
      history: { '2026-10-11': ['morning', 'evening'] },
    }
    expect(sanitizeProgress(data)).toEqual(data)
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
      history: {
        [DAY]: ['evening', 'brunch', 'morning', 'morning', 7],
        '2026-10-11': 'morning',
        '2026-10-10': [],
        '10/09/2026': ['morning'],
      },
    })
    expect(cleaned).toEqual({
      days: { [DAY]: { morning: { tasbih: 2 } } },
      history: { [DAY]: ['morning', 'evening'] },
    })
  })

  it('is not fooled by keys that shadow Object.prototype', () => {
    const hostile: unknown = JSON.parse(
      `{"days":{"${DAY}":{"morning":{"__proto__":5,"constructor":2}},"__proto__":{"morning":{"tasbih":1}}},"history":{"__proto__":["morning"]}}`,
    )
    const cleaned = sanitizeProgress(hostile)
    expect(Object.keys(cleaned.days)).toEqual([DAY])
    expect(Object.getPrototypeOf(cleaned.days[DAY]!.morning)).toBe(Object.prototype)
    expect(cleaned.history).toEqual({})
    expect(({} as Record<string, unknown>).morning).toBeUndefined()
  })
})

describe('persistence', () => {
  it('stores only the data, under the app’s prefix, so backups include it', () => {
    store().increment(DAY, 'morning', 'tasbih')
    const raw: unknown = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!)
    expect(raw).toEqual({ state: { days: { [DAY]: { morning: { tasbih: 1 } } }, history: {} }, version: 1 })
    expect(exportBackup().data[AZKAR_PROGRESS_STORAGE_KEY]).toEqual(raw)
  })

  it('validates what it loads, as after importing a backup', async () => {
    localStorage.setItem(
      AZKAR_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        state: {
          days: { [DAY]: { morning: { tasbih: 2, hamd: 'lots' } }, 'not-a-date': { morning: { tasbih: 1 } } },
          history: { '2026-10-11': ['morning', 'unknown'] },
          increment: 'not a function',
        },
        version: 1,
      }),
    )
    await useAzkarProgress.persist.rehydrate()
    expect(store().days).toEqual({ [DAY]: { morning: { tasbih: 2 } } })
    expect(store().history).toEqual({ '2026-10-11': ['morning'] })
    expect(typeof store().increment).toBe('function')
  })

  it('reads data stamped with another version as far as it can', async () => {
    localStorage.setItem(
      AZKAR_PROGRESS_STORAGE_KEY,
      JSON.stringify({ state: { days: { [DAY]: { evening: { hamd: 1 } } }, extra: true }, version: 7 }),
    )
    await useAzkarProgress.persist.rehydrate()
    expect(store().days).toEqual({ [DAY]: { evening: { hamd: 1 } } })
    expect(store().history).toEqual({})
  })

  it('survives a stored value that is not usable at all', async () => {
    for (const broken of ['{not json', '"a string"', '{"state":null,"version":1}', '{"state":[1,2],"version":1}']) {
      useAzkarProgress.setState({ days: {}, history: {} })
      localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, broken)
      await useAzkarProgress.persist.rehydrate()
      expect(store().days).toEqual({})
      expect(store().history).toEqual({})

      store().increment(DAY, 'morning', 'tasbih')
      expect(counts()).toEqual({ tasbih: 1 })
    }
  })
})
