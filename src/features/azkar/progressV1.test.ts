import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importBackup } from '../../shared/storage'
import type { BackupFile } from '../../shared/storage'
import { AZKAR_PROGRESS_STORAGE_KEY, sanitizeAzkarProgress, sanitizeProgress, useAzkarProgress } from './progressStore'
import type { ProgressData } from './progressStore'
import { migrateProgressV1, sanitizeProgressV1 } from './progressV1'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

// The fixture's morning session: tasbih ×3, hamd ×1, takbir ×10. Evening: hamd ×1, tasbih ×3.
const TODAY = '2026-10-12'
const NOW = Date.parse(`${TODAY}T07:30:00Z`)
const store = () => useAzkarProgress.getState()

/**
 * Exactly what a version 1 build left in localStorage: the morning finished and the evening
 * half read today, yesterday's morning finished, last week's evening only begun, and a
 * year of completions whose counts were pruned long ago.
 */
const V1_STORED =
  '{"state":{"days":{' +
  '"2026-10-12":{"morning":{"tasbih":3,"hamd":1,"takbir":10},"evening":{"hamd":1}},' +
  '"2026-10-11":{"morning":{"tasbih":3,"hamd":1,"takbir":10}},' +
  '"2026-10-06":{"evening":{"tasbih":2}}},' +
  '"history":{' +
  '"2026-10-12":["morning"],' +
  '"2026-10-11":["morning"],' +
  '"2026-10-01":["morning","evening"],' +
  '"2025-09-20":["evening"]}},' +
  '"version":1}'

const empty = (): ProgressData => ({ days: {}, sessions: {}, totals: {}, totalRecitations: 0 })

async function loadStored(raw: string) {
  localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, raw)
  await useAzkarProgress.persist.rehydrate()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  useAzkarProgress.setState(empty())
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('migrating version 1', () => {
  it('keeps every count and turns every day into session records, inventing no times', async () => {
    await loadStored(V1_STORED)

    expect(store().days).toEqual({
      '2026-10-12': { morning: { tasbih: 3, hamd: 1, takbir: 10 }, evening: { hamd: 1 } },
      '2026-10-11': { morning: { tasbih: 3, hamd: 1, takbir: 10 } },
      '2026-10-06': { evening: { tasbih: 2 } },
    })
    expect(store().sessions).toEqual({
      '2026-10-12': {
        morning: { completed: true, done: 3, total: 3, recitations: 14 },
        evening: { completed: false, done: 1, total: 2, recitations: 1 },
      },
      '2026-10-11': { morning: { completed: true, done: 3, total: 3, recitations: 14 } },
      '2026-10-06': { evening: { completed: false, done: 0, total: 2, recitations: 2 } },
      // Completed, so every dhikr was done; how often each was counted was not kept.
      '2026-10-01': {
        morning: { completed: true, done: 3, total: 3, recitations: 0 },
        evening: { completed: true, done: 2, total: 2, recitations: 0 },
      },
      '2025-09-20': { evening: { completed: true, done: 2, total: 2, recitations: 0 } },
    })
    for (const day of Object.values(store().sessions)) {
      for (const kept of Object.values(day)) {
        expect(kept).not.toHaveProperty('startedAt')
        expect(kept).not.toHaveProperty('lastAt')
        expect(kept).not.toHaveProperty('completedAt')
      }
    }
  })

  it('starts the lifetime totals from the counts that were still kept', async () => {
    await loadStored(V1_STORED)
    expect(store().totals).toEqual({ tasbih: 8, hamd: 3, takbir: 20 })
    expect(store().totalRecitations).toBe(31)
  })

  it('writes the result back as the current version straight away', async () => {
    await loadStored(V1_STORED)
    const stored = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!) as {
      state: Record<string, unknown>
      version: number
    }
    expect(stored.version).toBe(3)
    const { history, ...data } = stored.state
    expect(data).toEqual(sanitizeAzkarProgress(store()))
    // The completions are kept in version 1's shape too, as they were, should an older build open the data.
    expect(history).toEqual(sanitizeProgressV1(JSON.parse(V1_STORED).state).history)
  })

  it('loses nothing a version 1 build could show', async () => {
    await loadStored(V1_STORED)
    const before = sanitizeProgressV1(JSON.parse(V1_STORED).state)
    for (const [dateKey, list] of Object.entries(before.history)) {
      for (const collection of list) expect(store().sessions[dateKey]?.[collection]?.completed).toBe(true)
    }
    for (const [dateKey, day] of Object.entries(before.days)) expect(store().days[dateKey]).toEqual(day)
  })

  it('carries on from a migrated session without making up its start', async () => {
    await loadStored(V1_STORED)
    store().increment(TODAY, 'evening', 'tasbih')
    expect(store().sessions[TODAY]?.evening).toEqual({
      lastAt: NOW,
      completed: false,
      done: 1,
      total: 2,
      recitations: 2,
    })

    vi.setSystemTime(NOW + 60_000)
    store().complete(TODAY, 'evening', 'tasbih')
    expect(store().sessions[TODAY]?.evening).toEqual({
      lastAt: NOW + 60_000,
      completedAt: NOW + 60_000,
      completed: true,
      done: 2,
      total: 2,
      recitations: 4,
    })
    expect(store().totalRecitations).toBe(34)
  })

  it('withdraws a migrated completion only as version 1 would have', async () => {
    await loadStored(V1_STORED)
    store().decrement(TODAY, 'morning', 'takbir')
    expect(store().sessions[TODAY]?.morning).toMatchObject({ completed: false, done: 2, recitations: 13 })
    store().increment(TODAY, 'morning', 'takbir')
    expect(store().sessions[TODAY]?.morning).toMatchObject({ completed: true, completedAt: NOW, recitations: 14 })
  })

  it('arrives the same way from a version 1 backup file', async () => {
    const backup: BackupFile = {
      app: 'azkar',
      version: 1,
      exportedAt: '2026-10-12T07:00:00.000Z',
      data: { [AZKAR_PROGRESS_STORAGE_KEY]: JSON.parse(V1_STORED) },
    }
    importBackup(backup)
    await useAzkarProgress.persist.rehydrate()
    expect(Object.keys(store().sessions).sort()).toEqual([
      '2025-09-20',
      '2026-10-01',
      '2026-10-06',
      '2026-10-11',
      TODAY,
    ])
    expect(store().totalRecitations).toBe(31)
  })

  it('validates version 1 data as version 1 did before migrating it', async () => {
    await loadStored(
      JSON.stringify({
        state: {
          days: {
            [TODAY]: { morning: { tasbih: 2, hamd: -1, text: '3' }, midnight: { tasbih: 1 } },
            'not-a-date': { morning: { tasbih: 1 } },
          },
          history: { [TODAY]: ['evening', 'brunch', 'evening', 7], '2026-10-11': 'morning', '10/09/2026': ['morning'] },
        },
        version: 1,
      }),
    )
    expect(store().days).toEqual({ [TODAY]: { morning: { tasbih: 2 } } })
    expect(store().sessions).toEqual({
      [TODAY]: {
        morning: { completed: false, done: 0, total: 3, recitations: 2 },
        evening: { completed: true, done: 2, total: 2, recitations: 0 },
      },
    })
    expect(store().totals).toEqual({ tasbih: 2 })
  })

  it('reads version 0, or a version 1 shape with no version at all, as version 1', async () => {
    const completedToday = { [TODAY]: { morning: { completed: true, done: 3, total: 3, recitations: 0 } } }
    await loadStored(`{"state":{"history":{"${TODAY}":["morning"]}},"version":0}`)
    expect(store().sessions).toEqual(completedToday)

    useAzkarProgress.setState(empty())
    await loadStored(`{"state":{"days":{},"history":{"${TODAY}":["morning"]}}}`)
    expect(store().sessions).toEqual(completedToday)
  })

  it('never reads data that has session records as version 1, whatever its stamp', async () => {
    const record = { startedAt: NOW - 600_000, lastAt: NOW, completedAt: NOW, completed: true, done: 3, total: 3, recitations: 14 }
    const v2State = {
      days: { [TODAY]: { morning: { tasbih: 3, hamd: 1, takbir: 10 } } },
      sessions: { [TODAY]: { morning: record }, '2026-01-05': { evening: { completed: true, done: 2, total: 2, recitations: 4 } } },
      totals: { tasbih: 5, hamd: 3, takbir: 10 },
      totalRecitations: 18,
    }
    for (const version of [0, 1]) {
      useAzkarProgress.setState(empty())
      await loadStored(JSON.stringify({ state: v2State, version }))
      expect(store().sessions).toEqual(v2State.sessions)
      expect(store().totals).toEqual(v2State.totals)
      expect(store().totalRecitations).toBe(18)
    }
  })

  it('reads completions in `history` as version 1 when `sessions` is not a set of records', async () => {
    await loadStored(`{"state":{"days":{},"history":{"${TODAY}":["morning"]},"sessions":null},"version":2}`)
    expect(store().sessions).toEqual({ [TODAY]: { morning: { completed: true, done: 3, total: 3, recitations: 0 } } })
  })

  it('migrates empty or unusable version 1 data to empty progress', async () => {
    for (const state of [{}, { days: {}, history: {} }, null, 'x', [1]]) {
      expect(migrateProgressV1(state)).toEqual(empty())
    }
    await loadStored('{"state":{"days":{},"history":{}},"version":1}')
    expect(store()).toMatchObject(empty())
  })

  it('keeps an id that shadows Object.prototype as an ordinary key', () => {
    const migrated = migrateProgressV1(JSON.parse(`{"days":{"${TODAY}":{"morning":{"__proto__":2,"tasbih":1}}}}`))
    expect(Object.getPrototypeOf(migrated.totals)).toBe(Object.prototype)
    expect(Object.keys(migrated.totals).sort()).toEqual(['__proto__', 'tasbih'])
    expect(migrated.totalRecitations).toBe(3)
    expect(sanitizeProgress(migrated)).toEqual(migrated)
  })

  it('produces data that version 2 validation leaves untouched', () => {
    const migrated = migrateProgressV1(JSON.parse(V1_STORED).state)
    expect(sanitizeProgress(migrated)).toEqual(migrated)
  })
})
