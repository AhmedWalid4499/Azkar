import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../../shared/storage'
import type { PrayerName } from '../../shared/types'
import { PRAYER_LOG_STORAGE_KEY, PRAYER_LOG_VERSION, sanitizeEntries, usePrayerLog } from './store'
import type { PrayerStatus } from './types'

const { setStatus } = usePrayerLog.getState()
const entries = () => usePrayerLog.getState().entries
const stored = () => JSON.parse(localStorage.getItem(PRAYER_LOG_STORAGE_KEY) ?? 'null') as unknown

function store(value: unknown) {
  localStorage.setItem(PRAYER_LOG_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

beforeEach(() => {
  usePrayerLog.setState({ entries: {} })
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
    const before = entries()

    setStatus('2026-10-11', 'fajr', 'ontime')
    setStatus('2026-10-11', 'asr', null)
    setStatus('2026-10-09', 'asr', null)
    expect(entries()).toBe(before)
  })

  it('replaces objects instead of mutating them', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    const before = entries()
    const dayBefore = before['2026-10-11']

    setStatus('2026-10-11', 'dhuhr', 'ontime')
    expect(before).toEqual({ '2026-10-11': { fajr: 'ontime' } })
    expect(dayBefore).toEqual({ fajr: 'ontime' })
    expect(entries()).not.toBe(before)
  })

  it('refuses days, prayers and statuses that do not exist', () => {
    setStatus('2026-02-30', 'fajr', 'ontime')
    setStatus('11/10/2026', 'fajr', 'ontime')
    setStatus('__proto__', 'fajr', 'ontime')
    setStatus('2026-10-11', 'sunrise' as PrayerName, 'ontime')
    setStatus('2026-10-11', 'fajr', 'prayed' as PrayerStatus)
    expect(entries()).toEqual({})
  })
})

describe('persistence', () => {
  it('writes only the entries, versioned, under the app prefix', () => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    expect(PRAYER_LOG_STORAGE_KEY).toBe('azkar:prayer-log')
    expect(stored()).toEqual({ state: { entries: { '2026-10-11': { fajr: 'ontime' } } }, version: PRAYER_LOG_VERSION })
  })

  it('restores what was stored', async () => {
    store({ state: { entries: { '2026-10-10': { fajr: 'late', isha: 'excused' } } }, version: PRAYER_LOG_VERSION })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-10': { fajr: 'late', isha: 'excused' } })
    // The actions survive a rehydrate.
    usePrayerLog.getState().setStatus('2026-10-10', 'fajr', null)
    expect(entries()).toEqual({ '2026-10-10': { isha: 'excused' } })
  })

  it('survives a backup export and import', async () => {
    setStatus('2026-10-11', 'fajr', 'jamaah')
    setStatus('2026-10-10', 'maghrib', 'missed')
    const backup = JSON.parse(JSON.stringify(exportBackup())) as ReturnType<typeof exportBackup>
    expect(Object.keys(backup.data)).toContain(PRAYER_LOG_STORAGE_KEY)

    usePrayerLog.setState({ entries: {} })
    importBackup(backup)
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'jamaah' }, '2026-10-10': { maghrib: 'missed' } })
  })
})

describe('rehydrating untrusted data', () => {
  it('drops bad days, prayers and statuses but keeps the good ones', async () => {
    store({
      state: {
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
      },
      version: PRAYER_LOG_VERSION,
    })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime' }, '2026-10-10': { isha: 'excused' } })
  })

  it.each([
    ['an array', []],
    ['a string', 'everything'],
    ['a number', 42],
    ['null', null],
  ])('reads entries that are %s as an empty log', async (_name, bad) => {
    setStatus('2026-10-11', 'fajr', 'ontime')
    store({ state: { entries: bad }, version: PRAYER_LOG_VERSION })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({})
  })

  it('reads a state of the wrong shape as an empty log', async () => {
    store({ state: 'gibberish', version: PRAYER_LOG_VERSION })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({})

    store({ state: null, version: PRAYER_LOG_VERSION })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({})
  })

  it('is not fooled by prototype keys', async () => {
    store(
      '{"state":{"entries":{"__proto__":{"fajr":"ontime"},"constructor":{"fajr":"ontime"},' +
        '"2026-10-11":{"__proto__":{"fajr":"ontime"},"dhuhr":"late"}}},"version":1}',
    )
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { dhuhr: 'late' } })
    expect(({} as Record<string, unknown>).fajr).toBeUndefined()
  })

  it('keeps working when the stored value is not JSON at all', async () => {
    store('{"state": oops')
    await expect(Promise.resolve(usePrayerLog.persist.rehydrate())).resolves.not.toThrow()
    expect(entries()).toEqual({})

    usePrayerLog.getState().setStatus('2026-10-11', 'fajr', 'ontime')
    expect(stored()).toEqual({ state: { entries: { '2026-10-11': { fajr: 'ontime' } } }, version: PRAYER_LOG_VERSION })
  })

  it.each([0, 99])('validates data stamped with version %i rather than discarding it', async (version) => {
    store({ state: { entries: { '2026-10-11': { fajr: 'ontime', asr: 'bogus' }, junk: 1 } }, version })
    await usePrayerLog.persist.rehydrate()
    expect(entries()).toEqual({ '2026-10-11': { fajr: 'ontime' } })
    // A migrated store is written back in the current shape.
    expect(stored()).toEqual({ state: { entries: { '2026-10-11': { fajr: 'ontime' } } }, version: PRAYER_LOG_VERSION })
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
