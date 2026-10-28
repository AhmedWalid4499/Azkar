import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dateKeyInZone, deviceTimeZone, shiftDateKey } from '../../shared/date'
import { exportBackup, importBackup } from '../../shared/storage'
import type { BackupFile } from '../../shared/storage'
import type { PrayerName } from '../../shared/types'
import {
  pickRange,
  PRAYER_LOG_STORAGE_KEY,
  PRAYER_LOG_VERSION,
  sanitizeEntries,
  useLogRange,
  usePrayerLog,
  usePrayerLoggedAt,
  useSunnahAt,
  useSunnahDone,
} from './store'
import { freezeToday, resetApp } from './test-utils'
import type { PrayerStatus, SunnahPrayer } from './types'

const TODAY = '2026-10-11'
/** The frozen clock: noon UTC on TODAY. */
const NOON = Date.parse(`${TODAY}T12:00:00Z`)

const { setStatus, setSunnah } = usePrayerLog.getState()
const entries = () => usePrayerLog.getState().entries
const loggedAt = () => usePrayerLog.getState().loggedAt
const sunnah = () => usePrayerLog.getState().sunnah
const stored = () => JSON.parse(localStorage.getItem(PRAYER_LOG_STORAGE_KEY) ?? 'null') as unknown

function store(value: unknown) {
  localStorage.setItem(PRAYER_LOG_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

/** The whole persisted state as version 2 writes it. */
function v2(state: { entries?: unknown; loggedAt?: unknown; sunnah?: unknown }) {
  return { state: { entries: {}, loggedAt: {}, sunnah: {}, ...state }, version: PRAYER_LOG_VERSION }
}

beforeEach(() => {
  freezeToday(TODAY, 'UTC')
  usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
})

afterEach(() => {
  resetApp()
})

describe('setStatus', () => {
  it('logs a prayer and changes it', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime' } })

    setStatus('2026-10-11', 'fajr', 'jamaah')
    setStatus('2026-10-11', 'isha', 'missed')
    setStatus('2026-10-10', 'asr', 'excused')
    expect(entries()).toEqual({
      '2026-10-11': { fajr: 'jamaah', isha: 'missed' },
      '2026-10-10': { asr: 'excused' },
    })
  })

  it('clears a prayer with null and removes a day left empty', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    setStatus('2026-10-11', 'dhuhr', 'late')

    setStatus('2026-10-11', 'fajr', null)
    expect(entries()).toEqual({ '2026-10-11': { dhuhr: 'late' } })

    setStatus('2026-10-11', 'dhuhr', null)
    expect(entries()).toEqual({})
    expect(Object.hasOwn(entries(), '2026-10-11')).toBe(false)
  })

  it('leaves the state untouched when nothing would change', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    const before = usePrayerLog.getState()

    setStatus('2026-10-11', 'fajr', 'ontime')
    setStatus('2026-10-11', 'asr', null)
    setStatus('2026-10-09', 'asr', null)
    expect(usePrayerLog.getState()).toBe(before)
  })

  it('replaces objects instead of mutating them', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    const before = entries()
    const dayBefore = before['2026-10-11']
    const stampsBefore = loggedAt()['2026-10-11']

    setStatus('2026-10-11', 'dhuhr', 'ontime')
    expect(before).toEqual({ '2026-10-11': { fajr: 'ontime' } })
    expect(dayBefore).toEqual({ fajr: 'ontime' })
    expect(stampsBefore).toEqual({ fajr: NOON })
    expect(entries()).not.toBe(before)
  })

  it('refuses days, prayers and statuses that do not exist', () => {
    setStatus('2026-02-30', 'fajr', 'ontime')
    setStatus('11/10/2026', 'fajr', 'ontime')
    setStatus('__proto__', 'fajr', 'ontime')
    setStatus('2026-10-11', 'sunrise' as PrayerName, 'ontime')
    setStatus('2026-10-11', 'fajr', 'prayed' as PrayerStatus)
    expect(entries()).toEqual({})
    expect(loggedAt()).toEqual({})
  })

  it('stamps the time of every change, and drops it with the status', () => {
    setStatus(TODAY, 'fajr', 'ontime')
    expect(loggedAt()).toEqual({ [TODAY]: { fajr: NOON } })

    vi.setSystemTime(NOON + 60_000)
    setStatus(TODAY, 'fajr', 'jamaah')
    setStatus('2026-10-01', 'isha', 'late')
    expect(loggedAt()).toEqual({ [TODAY]: { fajr: NOON + 60_000 }, '2026-10-01': { isha: NOON + 60_000 } })

    // Choosing the status it already has is not a change.
    vi.setSystemTime(NOON + 120_000)
    setStatus(TODAY, 'fajr', 'jamaah')
    expect(loggedAt()[TODAY]).toEqual({ fajr: NOON + 60_000 })

    setStatus(TODAY, 'fajr', null)
    expect(loggedAt()).toEqual({ '2026-10-01': { isha: NOON + 60_000 } })
    expect(Object.hasOwn(loggedAt(), TODAY)).toBe(false)
  })

  it('stamps an entry that had no time, as one carried over from version 1 has none', () => {
    usePrayerLog.setState({ entries: { '2026-09-01': { fajr: 'missed', dhuhr: 'ontime' } } })
    setStatus('2026-09-01', 'fajr', 'late')
    expect(entries()['2026-09-01']).toEqual({ fajr: 'late', dhuhr: 'ontime' })
    expect(loggedAt()).toEqual({ '2026-09-01': { fajr: NOON } })
  })

  it('refuses a day that has not begun where the user is, but lets an entry there be cleared', () => {
    setStatus('2026-10-12', 'fajr', 'ontime')
    setStatus('2027-01-01', 'fajr', 'ontime')
    expect(entries()).toEqual({})

    // Noon UTC on the 11th is already the 12th on Kiritimati (UTC+14), and the saved location decides.
    freezeToday(TODAY, 'Pacific/Kiritimati')
    setStatus('2026-10-12', 'fajr', 'ontime')
    setStatus('2026-10-13', 'fajr', 'ontime')
    expect(entries()).toEqual({ '2026-10-12': { fajr: 'ontime' } })

    // Back in UTC the 12th lies ahead again: what was logged there can still be taken off.
    freezeToday(TODAY, 'UTC')
    setStatus('2026-10-12', 'fajr', 'late')
    expect(entries()).toEqual({ '2026-10-12': { fajr: 'ontime' } })
    setStatus('2026-10-12', 'fajr', null)
    expect(entries()).toEqual({})
    expect(loggedAt()).toEqual({})
  })

  it('takes today from the device when no location is saved', () => {
    resetApp()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOON)
    const deviceToday = dateKeyInZone(new Date(NOON), deviceTimeZone())
    setStatus(deviceToday, 'asr', 'ontime')
    setStatus(shiftDateKey(deviceToday, 1), 'asr', 'ontime')
    expect(entries()).toEqual({ [deviceToday]: { asr: 'ontime' } })
  })
})

describe('setSunnah', () => {
  it('ticks a sunnah prayer with the time, and unticks it', () => {
    setSunnah(TODAY, 'witr', true)
    vi.setSystemTime(NOON + 5_000)
    setSunnah(TODAY, 'beforeFajr', true)
    setSunnah('2026-10-10', 'duha', true)
    expect(sunnah()).toEqual({
      [TODAY]: { witr: NOON, beforeFajr: NOON + 5_000 },
      '2026-10-10': { duha: NOON + 5_000 },
    })

    setSunnah(TODAY, 'witr', false)
    expect(sunnah()[TODAY]).toEqual({ beforeFajr: NOON + 5_000 })
    setSunnah(TODAY, 'beforeFajr', false)
    expect(Object.hasOwn(sunnah(), TODAY)).toBe(false)
    expect(sunnah()).toEqual({ '2026-10-10': { duha: NOON + 5_000 } })
  })

  it('keeps the first time when a ticked prayer is ticked again, and changes nothing', () => {
    setSunnah(TODAY, 'qiyam', true)
    const before = usePrayerLog.getState()
    vi.setSystemTime(NOON + 60_000)
    setSunnah(TODAY, 'qiyam', true)
    setSunnah(TODAY, 'duha', false)
    setSunnah('2026-10-01', 'duha', false)
    expect(usePrayerLog.getState()).toBe(before)
    expect(sunnah()).toEqual({ [TODAY]: { qiyam: NOON } })
  })

  it('leaves the obligatory log alone, and the other way round', () => {
    setStatus(TODAY, 'isha', 'jamaah')
    setSunnah(TODAY, 'afterIsha', true)
    setStatus(TODAY, 'isha', null)
    expect(sunnah()).toEqual({ [TODAY]: { afterIsha: NOON } })
    setSunnah(TODAY, 'afterIsha', false)
    expect(entries()).toEqual({})
  })

  it('refuses days, prayers and values that do not exist', () => {
    setSunnah('2026-02-30', 'witr', true)
    setSunnah('__proto__', 'witr', true)
    setSunnah(TODAY, 'tarawih' as SunnahPrayer, true)
    setSunnah(TODAY, 'fajr' as SunnahPrayer, true)
    setSunnah(TODAY, 'witr', 'yes' as unknown as boolean)
    expect(sunnah()).toEqual({})
  })

  it('refuses a day that has not begun, but lets it be unticked', () => {
    setSunnah('2026-10-12', 'witr', true)
    expect(sunnah()).toEqual({})

    usePrayerLog.setState({ sunnah: { '2026-10-12': { witr: NOON } } })
    setSunnah('2026-10-12', 'witr', false)
    expect(sunnah()).toEqual({})
  })
})

describe('persistence', () => {
  it('writes the entries, their times and the sunnah prayers, versioned, under the app prefix', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    setSunnah('2026-10-11', 'beforeFajr', true)
    expect(PRAYER_LOG_STORAGE_KEY).toBe('azkar:prayer-log')
    expect(PRAYER_LOG_VERSION).toBe(2)
    expect(stored()).toEqual(
      v2({
        entries: { '2026-10-11': { fajr: 'ontime' } },
        loggedAt: { '2026-10-11': { fajr: NOON } },
        sunnah: { '2026-10-11': { beforeFajr: NOON } },
      }),
    )
  })

  it('restores what was stored', async () => {
    store(
      v2({
        entries: { '2026-10-10': { fajr: 'late', isha: 'excused' } },
        loggedAt: { '2026-10-10': { fajr: 1_790_000_000_000 } },
        sunnah: { '2026-10-10': { witr: 1_790_000_000_001, duha: 1_790_000_000_002 } },
      }),
    )
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-10': { fajr: 'late', isha: 'excused' } })
    expect(loggedAt()).toEqual({ '2026-10-10': { fajr: 1_790_000_000_000 } })
    expect(sunnah()).toEqual({ '2026-10-10': { witr: 1_790_000_000_001, duha: 1_790_000_000_002 } })
    // The actions survive a rehydrate.
    usePrayerLog.getState().setStatus('2026-10-10', 'fajr', null)
    usePrayerLog.getState().setSunnah('2026-10-10', 'witr', false)
    expect(entries()).toEqual({ '2026-10-10': { isha: 'excused' } })
    expect(loggedAt()).toEqual({})
    expect(sunnah()).toEqual({ '2026-10-10': { duha: 1_790_000_000_002 } })
  })

  it('survives a backup export and import', async () => {
    setStatus('2026-10-11', 'fajr', 'jamaah')
    setStatus('2026-10-10', 'maghrib', 'missed')
    setSunnah('2026-10-10', 'afterMaghrib', true)
    const before = { entries: entries(), loggedAt: loggedAt(), sunnah: sunnah() }
    const backup = JSON.parse(JSON.stringify(exportBackup())) as ReturnType<typeof exportBackup>
    expect(Object.keys(backup.data)).toContain(PRAYER_LOG_STORAGE_KEY)

    usePrayerLog.setState({ entries: {}, loggedAt: {}, sunnah: {} })
    importBackup(backup)
    await usePrayerLog.persist.rehydrate()
    expect({ entries: entries(), loggedAt: loggedAt(), sunnah: sunnah() }).toEqual(before)
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'jamaah' }, '2026-10-10': { maghrib: 'missed' } })
  })

  it('keeps days after today on load: a trip across the date line can put real entries there', async () => {
    store(v2({ entries: { '2026-10-20': { fajr: 'ontime' } }, sunnah: { '2026-10-20': { witr: NOON } } }))
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-20': { fajr: 'ontime' } })
    expect(sunnah()).toEqual({ '2026-10-20': { witr: NOON } })
  })
})

describe('migrating version 1', () => {
  // Exactly what the version 1 build wrote: entries only.
  const V1_LOG =
    '{"state":{"entries":{"2026-10-10":{"fajr":"jamaah","dhuhr":"ontime","asr":"late","maghrib":"missed","isha":"excused"},' +
    '"2026-10-09":{"isha":"ontime"},"2025-12-31":{"fajr":"missed"}}},"version":1}'
  const V1_ENTRIES = {
    '2026-10-10': { fajr: 'jamaah', dhuhr: 'ontime', asr: 'late', maghrib: 'missed', isha: 'excused' },
    '2026-10-09': { isha: 'ontime' },
    '2025-12-31': { fajr: 'missed' },
  }

  it('keeps every entry, adds the two new maps empty and writes the result back as version 2', async () => {
    store(V1_LOG)
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual(V1_ENTRIES)
    expect(loggedAt()).toEqual({})
    expect(sunnah()).toEqual({})
    expect(stored()).toEqual(v2({ entries: V1_ENTRIES }))
  })

  it('keeps a long history in full', async () => {
    const history: Record<string, Record<string, string>> = {}
    const statuses = ['ontime', 'jamaah', 'late', 'missed', 'excused']
    for (let i = 0; i < 800; i++) {
      const key = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10)
      history[key] = { fajr: statuses[i % 5]!, isha: statuses[(i + 2) % 5]! }
    }
    store({ state: { entries: history }, version: 1 })
    await usePrayerLog.persist.rehydrate()
    expect(Object.keys(entries())).toHaveLength(800)
    expect(entries()).toEqual(history)
  })

  it('migrates a version 1 log that arrives in an imported backup', async () => {
    const backup: BackupFile = {
      app: 'azkar',
      version: 1,
      exportedAt: '2026-10-01T08:00:00.000Z',
      data: {
        [PRAYER_LOG_STORAGE_KEY]: JSON.parse(V1_LOG) as unknown,
        'azkar:settings': { state: { language: 'ar' }, version: 1 },
      },
    }
    setSunnah(TODAY, 'witr', true)
    importBackup(JSON.parse(JSON.stringify(backup)) as BackupFile)
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual(V1_ENTRIES)
    // The backup replaces what was there, so nothing of the old state survives it.
    expect(sunnah()).toEqual({})
    expect(stored()).toEqual(v2({ entries: V1_ENTRIES }))
  })

  it('validates a version 1 log from a hand-edited backup like any other', async () => {
    store(
      '{"state":{"entries":{"__proto__":{"fajr":"ontime"},"2026-10-10":{"fajr":"ontime","asr":"done"},' +
        '"2026-13-01":{"fajr":"ontime"},"2026-10-09":[]}},"version":1}',
    )
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-10': { fajr: 'ontime' } })
    expect(({} as Record<string, unknown>).fajr).toBeUndefined()
  })

  it('reads whatever later fields a version 1 payload happens to carry, as far as they are valid', async () => {
    store({
      state: {
        entries: { '2026-10-10': { fajr: 'ontime' } },
        loggedAt: { '2026-10-10': { fajr: 1_790_000_000_000, dhuhr: 1_790_000_000_000 } },
        sunnah: { '2026-10-10': { witr: 1_790_000_000_000, tarawih: 1 } },
      },
      version: 1,
    })
    await usePrayerLog.persist.rehydrate()
    expect(loggedAt()).toEqual({ '2026-10-10': { fajr: 1_790_000_000_000 } })
    expect(sunnah()).toEqual({ '2026-10-10': { witr: 1_790_000_000_000 } })
  })

  it('reads an empty version 1 log as an empty log', async () => {
    store('{"state":{"entries":{}},"version":1}')
    await usePrayerLog.persist.rehydrate()
    expect(usePrayerLog.getState()).toMatchObject({ entries: {}, loggedAt: {}, sunnah: {} })
    expect(stored()).toEqual(v2({}))
  })
})

describe('rehydrating untrusted data', () => {
  it('drops bad days, prayers and statuses but keeps the good ones', async () => {
    store(
      v2({
        entries: {
          '2026-10-11': { fajr: 'ontime', dhuhr: 'prayed', asr: 3, maghrib: null, sunrise: 'ontime', extra: 'late' },
          '2026-10-10': { isha: 'excused' },
          '2026-02-30': { fajr: 'ontime' },
          '2026-1-5': { fajr: 'ontime' },
          'not a date': { fajr: 'ontime' },
          '2026-10-09': 'ontime',
          '2026-10-08': ['ontime', 'ontime'],
          '2026-10-07': null,
          '2026-10-06': {},
          '2026-10-05': { fajr: 'nope' },
        },
      }),
    )
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime' }, '2026-10-10': { isha: 'excused' } })
  })

  it('keeps only real times, and only beside a status', async () => {
    store(
      v2({
        entries: { '2026-10-11': { fajr: 'ontime', dhuhr: 'late', asr: 'missed' }, '2026-10-10': { isha: 'ontime' } },
        loggedAt: {
          '2026-10-11': {
            fajr: 1_790_000_000_000,
            dhuhr: '1790000000000',
            asr: 1.5,
            maghrib: 1_790_000_000_000,
            sunrise: 1_790_000_000_000,
          },
          '2026-10-10': { isha: -5 },
          '2026-10-09': { fajr: 1_790_000_000_000 },
          '2026-10-08': 1_790_000_000_000,
        },
      }),
    )
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime', dhuhr: 'late', asr: 'missed' }, '2026-10-10': { isha: 'ontime' } })
    // Maghrib has no status that day, 2026-10-09 no entries at all.
    expect(loggedAt()).toEqual({ '2026-10-11': { fajr: 1_790_000_000_000 } })
  })

  it('keeps only known sunnah prayers with real times on real days', async () => {
    store(
      v2({
        sunnah: {
          '2026-10-11': { witr: 1_790_000_000_000, duha: true, qiyam: '1790000000000', tarawih: 1_790_000_000_000 },
          '2026-10-10': { beforeFajr: 1_790_000_000_000, afterIsha: 0, afterMaghrib: 9e15, beforeDhuhr: null },
          '2026-10-09': { duha: 1.25 },
          '2026-10-08': [1_790_000_000_000],
          '2026-10-07': 'witr',
          '2026-02-30': { witr: 1_790_000_000_000 },
          'not a date': { witr: 1_790_000_000_000 },
        },
      }),
    )
    await usePrayerLog.persist.rehydrate()
    expect(sunnah()).toEqual({ '2026-10-11': { witr: 1_790_000_000_000 }, '2026-10-10': { beforeFajr: 1_790_000_000_000 } })
  })

  it.each([
    ['an array', []],
    ['a string', 'everything'],
    ['a number', 42],
    ['null', null],
  ])('reads entries that are %s as an empty log', async (_name, bad) => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    setSunnah('2026-10-11', 'witr', true)
    store(v2({ entries: bad, loggedAt: bad, sunnah: bad }))
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({})
    expect(loggedAt()).toEqual({})
    expect(sunnah()).toEqual({})
  })

  it('reads a state of the wrong shape as an empty log', async () => {
    store({ state: 'gibberish', version: PRAYER_LOG_VERSION })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({})

    store({ state: null, version: PRAYER_LOG_VERSION })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({})
    expect(sunnah()).toEqual({})
  })

  it('is not fooled by prototype keys', async () => {
    store(
      '{"state":{"entries":{"__proto__":{"fajr":"ontime"},"constructor":{"fajr":"ontime"},' +
        '"2026-10-11":{"__proto__":{"fajr":"ontime"},"dhuhr":"late"}},' +
        '"loggedAt":{"__proto__":{"dhuhr":1790000000000},"2026-10-11":{"__proto__":{"dhuhr":1790000000000}}},' +
        '"sunnah":{"__proto__":{"witr":1790000000000},"2026-10-11":{"__proto__":{"witr":1790000000000},"duha":1790000000000}}},"version":2}',
    )
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { dhuhr: 'late' } })
    expect(loggedAt()).toEqual({})
    expect(sunnah()).toEqual({ '2026-10-11': { duha: 1_790_000_000_000 } })
    expect(({} as Record<string, unknown>).fajr).toBeUndefined()
    expect(({} as Record<string, unknown>).witr).toBeUndefined()
  })

  it('keeps working when the stored value is not JSON at all', async () => {
    store('{"state": oops')
    await expect(Promise.resolve(usePrayerLog.persist.rehydrate())).resolves.not.toThrow()
    expect(entries()).toEqual({})

    usePrayerLog.getState().setStatus('2026-10-11', 'fajr', 'ontime')
    expect(stored()).toEqual(v2({ entries: { '2026-10-11': { fajr: 'ontime' } }, loggedAt: { '2026-10-11': { fajr: NOON } } }))
  })

  it.each([0, 99])('validates data stamped with version %i rather than discarding it', async (version) => {
    store({
      state: {
        entries: { '2026-10-11': { fajr: 'ontime', asr: 'bogus' }, junk: 1 },
        sunnah: { '2026-10-11': { witr: 1_790_000_000_000, bogus: 1 } },
      },
      version,
    })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime' } })
    // A migrated store is written back in the current shape.
    expect(stored()).toEqual(
      v2({ entries: { '2026-10-11': { fajr: 'ontime' } }, sunnah: { '2026-10-11': { witr: 1_790_000_000_000 } } }),
    )
  })

  it('validates data that carries no version at all', async () => {
    store({ state: { entries: { '2026-10-11': { fajr: 'ontime', asr: 'bogus' } }, sunnah: { '2026-10-11': { witr: 'x' } } } })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime' } })
    expect(sunnah()).toEqual({})
  })
})

describe('in an older web view', () => {
  // The iOS app supports iOS 15.0, whose web view has no Object.hasOwn (it came in 15.4). If loading
  // threw there, the store would keep its empty start state and the next tap would save it over the log.
  it('loads the stored log where Object.hasOwn does not exist', () => {
    const persisted = {
      entries: { '2026-10-10': { fajr: 'jamaah', isha: 'missed' } },
      loggedAt: { '2026-10-10': { fajr: 1_790_000_000_000 } },
      sunnah: { '2026-10-10': { witr: 1_790_000_000_000 } },
    }
    // What the store runs on load, called directly: jsdom's own Storage needs Object.hasOwn.
    const { migrate, merge } = usePrayerLog.persist.getOptions()
    const hasOwn = Object.hasOwn
    Reflect.deleteProperty(Object, 'hasOwn')
    let loaded: unknown
    try {
      loaded = merge!(migrate!(persisted, 1) as unknown, usePrayerLog.getState())
    } finally {
      Object.hasOwn = hasOwn
    }
    expect(loaded).toMatchObject(persisted)
  })
})

describe('sanitizeEntries', () => {
  it('returns an empty log for anything that is not an object', () => {
    for (const value of [undefined, null, 'x', 5, true, [], [{ '2026-10-11': { fajr: 'ontime' } }]]) {
      expect(sanitizeEntries(value)).toEqual({})
    }
  })

  it('returns a fresh object and does not touch its input', () => {
    const input = { '2026-10-11': { fajr: 'ontime', other: 1 } }
    const output = sanitizeEntries(input)
    expect(output).toEqual({ '2026-10-11': { fajr: 'ontime' } })
    expect(input).toEqual({ '2026-10-11': { fajr: 'ontime', other: 1 } })
    expect(output['2026-10-11']).not.toBe(input['2026-10-11'])
  })
})

describe('selectors', () => {
  it('pick the days of a range, both ends included', () => {
    const map = { '2026-09-30': 1, '2026-10-01': 2, '2026-10-15': 3, '2026-10-31': 4, '2026-11-01': 5, nope: 6 }
    expect(pickRange(map, '2026-10-01', '2026-10-31')).toEqual({ '2026-10-01': 2, '2026-10-15': 3, '2026-10-31': 4 })
    expect(pickRange(map, '2026-12-01', '2026-12-31')).toEqual({})
  })

  it('read one prayer’s time and one sunnah prayer’s state', () => {
    const time = renderHook(() => usePrayerLoggedAt(TODAY, 'fajr'))
    const at = renderHook(() => useSunnahAt(TODAY, 'witr'))
    const done = renderHook(() => useSunnahDone(TODAY, 'witr'))
    expect([time.result.current, at.result.current, done.result.current]).toEqual([null, null, false])

    act(() => {
      setStatus(TODAY, 'fajr', 'ontime')
      setSunnah(TODAY, 'witr', true)
    })
    expect([time.result.current, at.result.current, done.result.current]).toEqual([NOON, NOON, true])
  })

  it('give a range that keeps its identity until something in it changes', () => {
    setStatus('2026-10-05', 'fajr', 'ontime')
    setSunnah('2026-09-20', 'duha', true)
    const { result } = renderHook(() => useLogRange('2026-10-01', '2026-10-31'))
    expect(result.current).toEqual({
      entries: { '2026-10-05': { fajr: 'ontime' } },
      loggedAt: { '2026-10-05': { fajr: NOON } },
      sunnah: {},
    })
    const first = result.current

    act(() => setSunnah('2026-09-21', 'duha', true))
    expect(result.current).toBe(first)

    act(() => setSunnah('2026-10-06', 'witr', true))
    expect(result.current).not.toBe(first)
    expect(result.current.entries).toBe(first.entries)
    expect(result.current.sunnah).toEqual({ '2026-10-06': { witr: NOON } })
  })
})
