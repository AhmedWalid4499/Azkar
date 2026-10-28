import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllData, importBackup } from '../../shared/storage'
import type { BackupFile } from '../../shared/storage'
import { sanitizeProgressV1 } from './progressV1'
import { AZKAR_PROGRESS_SPARE_KEY } from './progressStorage'
import {
  AZKAR_PROGRESS_STORAGE_KEY,
  AZKAR_PROGRESS_VERSION,
  emptyAzkarProgress,
  sanitizeAzkarProgress,
  sanitizeProgress,
  useAzkarProgress,
} from './progressStore'
import { withAfterPrayer, withTasbih } from './testing/fixture'
import { azkarData } from './data'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

// Fixture: morning tasbih ×3, hamd ×1, takbir ×10; evening hamd ×1, tasbih ×3.
// After Fajr: after-once ×1, after-thrice ×3, after-dawn-dusk ×10. Presets: preset-one, preset-two.
const DAY = '2026-10-12'
const NOW = Date.parse(`${DAY}T16:00:00Z`)
const store = () => useAzkarProgress.getState()

/**
 * Exactly what a version 2 build left in localStorage, captured from that build's own store:
 * a pair of completions carried over from version 1 (no times), yesterday's morning completed
 * and then started over and read again in part, yesterday's evening read after midnight, and
 * today's morning half-way.
 */
const V2_STORED =
  '{"state":{"days":{"2026-10-11":{"morning":{"tasbih":1},"evening":{"hamd":1,"tasbih":3}},' +
  '"2026-10-12":{"morning":{"tasbih":2,"hamd":1}}},"sessions":{"2026-03-01":{"morning":{"completed":true,' +
  '"done":3,"total":3,"recitations":0},"evening":{"completed":true,"done":2,"total":2,"recitations":0}},' +
  '"2026-10-11":{"morning":{"startedAt":1791697200000,"completed":true,"done":0,"total":3,"recitations":15,' +
  '"lastAt":1791709200000,"completedAt":1791697200000},"evening":{"startedAt":1791765000000,"completed":true,' +
  '"done":2,"total":2,"recitations":4,"lastAt":1791765000000,"completedAt":1791765000000}},"2026-10-12":' +
  '{"morning":{"startedAt":1791785100000,"completed":false,"done":1,"total":3,"recitations":3,' +
  '"lastAt":1791785220000}}},"totals":{"tasbih":9,"hamd":3,"takbir":10},"totalRecitations":22,' +
  '"history":{"2026-03-01":["morning","evening"],"2026-10-11":["morning","evening"]}},"version":2}'

/** Version 3 data with the morning done, part of the azkar after Fajr, and two tasbih counters. */
const V3_STATE = {
  days: { [DAY]: { morning: { tasbih: 3, hamd: 1, takbir: 10 } } },
  sessions: {
    [DAY]: {
      morning: {
        startedAt: 1791784800000,
        completed: true,
        done: 3,
        total: 3,
        recitations: 14,
        lastAt: 1791785400000,
        completedAt: 1791785400000,
      },
    },
  },
  totals: { tasbih: 3, hamd: 1, takbir: 10, 'after-once': 1, 'after-thrice': 3 },
  totalRecitations: 18,
  afterPrayer: {
    days: { [DAY]: { fajr: { 'after-once': 1, 'after-thrice': 3 } } },
    sessions: {
      [DAY]: {
        fajr: { startedAt: 1791784200000, completed: false, done: 2, total: 3, recitations: 4, lastAt: 1791784260000 },
      },
    },
    totals: { 'after-once': 1, 'after-thrice': 3 },
  },
  tasbih: {
    days: {
      [DAY]: {
        presets: { 'preset-one': { startedAt: 1791790000000, lastAt: 1791790060000, count: 40, current: 7 } },
        free: { startedAt: 1791791000000, lastAt: 1791791000000, count: 5, current: 5 },
      },
    },
    totals: { 'preset-one': 40 },
    free: 5,
  },
  history: { [DAY]: ['morning'] },
}

// What older builds saved on opening V3_STATE, and after counting the evening's hamd there.
// Captured from those builds' own stores: they keep only what they understand.
const V2_OPENED_V3 =
  '{"state":{"days":{"2026-10-12":{"morning":{"tasbih":3,"hamd":1,"takbir":10}}},"sessions":{"2026-10-12":' +
  '{"morning":{"completed":true,"done":3,"total":3,"recitations":14,"startedAt":1791784800000,' +
  '"lastAt":1791785400000,"completedAt":1791785400000}}},"totals":{"tasbih":3,"hamd":1,"takbir":10,' +
  '"after-once":1,"after-thrice":3},"totalRecitations":18,"history":{"2026-10-12":["morning"]}},"version":2}'
const V2_COUNTED_IN_V3 =
  '{"state":{"days":{"2026-10-12":{"morning":{"tasbih":3,"hamd":1,"takbir":10},"evening":{"hamd":1}}},' +
  '"sessions":{"2026-10-12":{"morning":{"completed":true,"done":3,"total":3,"recitations":14,' +
  '"startedAt":1791784800000,"lastAt":1791785400000,"completedAt":1791785400000},"evening":' +
  '{"startedAt":1791820800000,"completed":false,"done":1,"total":2,"recitations":1,"lastAt":1791820800000}}},' +
  '"totals":{"tasbih":3,"hamd":2,"takbir":10,"after-once":1,"after-thrice":3},"totalRecitations":19,' +
  '"history":{"2026-10-12":["morning"]}},"version":2}'
const V1_COUNTED_IN_V3 =
  '{"state":{"days":{"2026-10-12":{"morning":{"tasbih":3,"hamd":1,"takbir":10},"evening":{"hamd":1}}},' +
  '"history":{"2026-10-12":["morning"]}},"version":1}'

const sections = (state: { afterPrayer: unknown; tasbih: unknown }) => ({
  afterPrayer: state.afterPrayer,
  tasbih: state.tasbih,
})

async function load(raw: string) {
  localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, raw)
  await useAzkarProgress.persist.rehydrate()
}

function stored(): { state: Record<string, unknown>; version: number } {
  return JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!) as { state: Record<string, unknown>; version: number }
}

/** As the version 3 app runs: V3_STATE loaded, then saved once more, which also writes the spare copy. */
async function runVersion3() {
  await load(JSON.stringify({ state: V3_STATE, version: 3 }))
  useAzkarProgress.setState({})
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  useAzkarProgress.setState(emptyAzkarProgress())
  localStorage.clear()
  withAfterPrayer(azkarData)
  withTasbih(azkarData)
})

afterEach(() => {
  vi.useRealTimers()
  delete azkarData.afterPrayer
  delete azkarData.tasbih
})

describe('migrating a real version 2 payload', () => {
  it('keeps every count, record, time and total as it was, and starts the new parts empty', async () => {
    await load(V2_STORED)
    const before = JSON.parse(V2_STORED).state as Record<string, unknown>
    expect(store().days).toEqual(before.days)
    expect(store().sessions).toEqual(before.sessions)
    expect(store().totals).toEqual(before.totals)
    expect(store().totalRecitations).toBe(22)
    expect(sections(store())).toEqual({
      afterPrayer: { days: {}, sessions: {}, totals: {} },
      tasbih: { days: {}, totals: {}, free: 0 },
    })
  })

  it('writes it back as version 3 straight away, with the completions still in version 1’s shape', async () => {
    await load(V2_STORED)
    expect(AZKAR_PROGRESS_VERSION).toBe(3)
    const { state, version } = stored()
    expect(version).toBe(3)
    const { history, ...data } = state
    expect(data).toEqual(sanitizeAzkarProgress(store()))
    expect(history).toEqual(JSON.parse(V2_STORED).state.history)
    // Nothing to spare yet.
    expect(localStorage.getItem(AZKAR_PROGRESS_SPARE_KEY)).toBeNull()
  })

  it('loses nothing version 2 could show, and carries on from it', async () => {
    await load(V2_STORED)
    const before = sanitizeProgress(JSON.parse(V2_STORED).state)
    expect(sanitizeProgress(store())).toEqual(before)

    store().increment(DAY, 'morning', 'tasbih')
    expect(store().sessions[DAY]?.morning).toMatchObject({ startedAt: 1791785100000, lastAt: NOW, recitations: 4 })
    store().incrementAfterPrayer(DAY, 'asr', 'after-once')
    expect(store().afterPrayer.sessions[DAY]?.asr).toMatchObject({ completed: false, done: 1, total: 2 })
    expect(store().totalRecitations).toBe(24)
  })

  it('arrives the same way from a version 2 backup file', async () => {
    const backup: BackupFile = {
      app: 'azkar',
      version: 1,
      exportedAt: '2026-10-12T07:00:00.000Z',
      data: { [AZKAR_PROGRESS_STORAGE_KEY]: JSON.parse(V2_STORED) },
    }
    importBackup(backup)
    await useAzkarProgress.persist.rehydrate()
    expect(sanitizeProgress(store())).toEqual(sanitizeProgress(JSON.parse(V2_STORED).state))
    expect(store().afterPrayer.sessions).toEqual({})
  })
})

describe('version 3 data', () => {
  it('reads back exactly what it stored, every part of it', async () => {
    await load(JSON.stringify({ state: V3_STATE, version: 3 }))
    const { history, ...data } = V3_STATE
    expect(sanitizeAzkarProgress(store())).toEqual(data)
    expect(history).toEqual({ [DAY]: ['morning'] })
  })

  it('validates the new parts on every load, as after importing a backup', async () => {
    await load(
      JSON.stringify({
        state: {
          ...V3_STATE,
          afterPrayer: {
            days: { [DAY]: { fajr: { 'after-once': 1, bad: -1 }, brunch: { 'after-once': 1 } }, 'not-a-date': {} },
            sessions: {
              [DAY]: { fajr: { completed: 'yes', done: 0, total: 3, recitations: 0 }, isha: V3_STATE.afterPrayer.sessions[DAY]!.fajr },
            },
            totals: { 'after-once': 2, x: 'many' },
          },
          tasbih: {
            days: {
              [DAY]: {
                presets: {
                  'preset-one': { count: 4, current: 9 }, // more on the counter than counted
                  'preset-two': { count: 3, current: 1, startedAt: 'today', lastAt: 1791790000000 },
                },
                free: { count: 0, current: 0 },
              },
              '2026-02-30': { presets: { 'preset-one': { count: 1, current: 1 } } },
            },
            totals: { 'preset-one': 4, 'preset-two': -3 },
            free: 'lots',
          },
        },
        version: 3,
      }),
    )
    expect(store().afterPrayer).toEqual({
      days: { [DAY]: { fajr: { 'after-once': 1 } } },
      sessions: { [DAY]: { isha: V3_STATE.afterPrayer.sessions[DAY]!.fajr } },
      totals: { 'after-once': 2 },
    })
    expect(store().tasbih).toEqual({
      days: { [DAY]: { presets: { 'preset-two': { count: 3, current: 1, lastAt: 1791790000000 } } } },
      totals: { 'preset-one': 4 },
      free: 0,
    })
  })

  it('reads data stamped with a newer version as far as it can', async () => {
    await load(JSON.stringify({ state: { ...V3_STATE, somethingNew: true }, version: 9 }))
    expect(sections(store())).toEqual(sections(V3_STATE))
    expect(store().sessions).toEqual(V3_STATE.sessions)
  })
})

describe('opened by an older build', () => {
  it('keeps a spare copy of the after-prayer and tasbih records under a key of its own', async () => {
    await runVersion3()
    expect(JSON.parse(localStorage.getItem(AZKAR_PROGRESS_SPARE_KEY)!)).toEqual(sections(V3_STATE))

    store().countTasbih(DAY, null)
    expect(JSON.parse(localStorage.getItem(AZKAR_PROGRESS_SPARE_KEY)!).tasbih.free).toBe(6)
  })

  it('gets everything back after a version 2 build opened the data', async () => {
    await runVersion3()
    await load(V2_OPENED_V3)
    expect(sections(store())).toEqual(sections(V3_STATE))
    expect(store().sessions).toEqual(V3_STATE.sessions)
    expect(stored().version).toBe(3)
    expect(sections(stored().state as never)).toEqual(sections(V3_STATE))
  })

  it('also keeps what the version 2 build counted meanwhile', async () => {
    await runVersion3()
    await load(V2_COUNTED_IN_V3)
    expect(store().days[DAY]?.evening).toEqual({ hamd: 1 })
    expect(store().sessions[DAY]?.evening).toMatchObject({ done: 1, recitations: 1 })
    expect(store().totalRecitations).toBe(19)
    expect(sections(store())).toEqual(sections(V3_STATE))
  })

  it('gets the new records back after a version 1 build, and the completions from its history', async () => {
    await runVersion3()
    await load(V1_COUNTED_IN_V3)
    expect(sections(store())).toEqual(sections(V3_STATE))
    expect(store().sessions[DAY]?.morning?.completed).toBe(true)
    expect(store().days[DAY]?.evening).toEqual({ hamd: 1 })
    // Version 1's own history is still written for it.
    expect(stored().state.history).toEqual(sanitizeProgressV1(JSON.parse(V1_COUNTED_IN_V3).state).history)
  })

  it('never lets the spare copy override records saved by version 3 itself', async () => {
    await runVersion3()
    store().countTasbih(DAY, 'preset-two')
    const kept = stored().state
    localStorage.setItem(AZKAR_PROGRESS_SPARE_KEY, JSON.stringify({ afterPrayer: {}, tasbih: { free: 99 } }))
    await load(JSON.stringify({ state: kept, version: 3 }))
    expect(store().tasbih.free).toBe(5)
    expect(store().tasbih.totals).toEqual({ 'preset-one': 40, 'preset-two': 1 })
  })

  it('ignores a spare copy that cannot be read', async () => {
    await runVersion3()
    localStorage.setItem(AZKAR_PROGRESS_SPARE_KEY, '{not json')
    await load(V2_OPENED_V3)
    expect(sections(store())).toEqual(sections(emptyAzkarProgress()))
    expect(store().sessions).toEqual(V3_STATE.sessions)
  })

  it('brings nothing back after the data was erased or replaced by a backup', async () => {
    await runVersion3()
    clearAllData()
    expect(localStorage.getItem(AZKAR_PROGRESS_SPARE_KEY)).toBeNull()

    await runVersion3()
    importBackup({ app: 'azkar', version: 1, exportedAt: '', data: { [AZKAR_PROGRESS_STORAGE_KEY]: JSON.parse(V2_STORED) } })
    expect(localStorage.getItem(AZKAR_PROGRESS_SPARE_KEY)).toBeNull()
    useAzkarProgress.setState(emptyAzkarProgress())
    await useAzkarProgress.persist.rehydrate()
    expect(sections(store())).toEqual(sections(emptyAzkarProgress()))
  })

  it('removes the spare copy with the store’s own data', async () => {
    await runVersion3()
    useAzkarProgress.persist.clearStorage()
    expect(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(AZKAR_PROGRESS_SPARE_KEY)).toBeNull()
  })
})
