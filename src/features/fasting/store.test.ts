import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { exportBackup } from '../../shared/storage'
import { OWED_BEFORE_MAX } from './sanitize'
import { FASTING_STORAGE_KEY, FASTING_VERSION, pickFastingRange, useFast, useFasting, useFastingRange } from './store'
import { freezeToday, resetFasting } from './test-utils'
import type { FastKind, FastStatus } from './types'

const TODAY = '2026-10-29'
/** The frozen clock: noon UTC on TODAY. */
const NOON = Date.parse(`${TODAY}T12:00:00Z`)

const { setFast, setOwedBefore } = useFasting.getState()
const days = () => useFasting.getState().days
const stored = () => JSON.parse(localStorage.getItem(FASTING_STORAGE_KEY) ?? 'null') as unknown

function store(value: unknown) {
  localStorage.setItem(FASTING_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

/** The whole persisted state as version 1 writes it. */
function v1(state: { days?: unknown; owedBefore?: unknown }) {
  return { state: { days: {}, owedBefore: 0, ...state }, version: FASTING_VERSION }
}

beforeEach(() => {
  freezeToday(TODAY)
  useFasting.setState({ days: {}, owedBefore: 0 })
})

afterEach(() => {
  resetFasting()
})

describe('setFast', () => {
  it('logs a fast with the time, and changes it', () => {
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    expect(days()).toEqual({ [TODAY]: { kind: 'voluntary', status: 'fasted', at: NOON } })

    vi.setSystemTime(NOON + 60_000)
    setFast(TODAY, { kind: 'qada', status: 'fasted' })
    setFast('2026-03-01', { kind: 'ramadan', status: 'excused' })
    expect(days()).toEqual({
      [TODAY]: { kind: 'qada', status: 'fasted', at: NOON + 60_000 },
      '2026-03-01': { kind: 'ramadan', status: 'excused', at: NOON + 60_000 },
    })
  })

  it('changes nothing, the time included, when the same fast is chosen again', () => {
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    const before = useFasting.getState()
    vi.setSystemTime(NOON + 60_000)
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    setFast('2026-10-01', null)
    expect(useFasting.getState()).toBe(before)
    expect(days()[TODAY]?.at).toBe(NOON)
  })

  it('clears a day with null', () => {
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    setFast('2026-10-28', { kind: 'voluntary', status: 'broken' })
    setFast(TODAY, null)
    expect(days()).toEqual({ '2026-10-28': { kind: 'voluntary', status: 'broken', at: NOON } })
    expect(Object.prototype.hasOwnProperty.call(days(), TODAY)).toBe(false)
  })

  it('replaces objects instead of mutating them', () => {
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    const before = days()
    const record = before[TODAY]
    setFast(TODAY, { kind: 'voluntary', status: 'broken' })
    expect(before).toEqual({ [TODAY]: { kind: 'voluntary', status: 'fasted', at: NOON } })
    expect(record).toEqual({ kind: 'voluntary', status: 'fasted', at: NOON })
  })

  it('refuses days, kinds and statuses that do not exist', () => {
    setFast('2026-02-30', { kind: 'voluntary', status: 'fasted' })
    setFast('29/10/2026', { kind: 'voluntary', status: 'fasted' })
    setFast('__proto__', { kind: 'voluntary', status: 'fasted' })
    setFast(TODAY, { kind: 'nadhr' as FastKind, status: 'fasted' })
    setFast(TODAY, { kind: 'voluntary', status: 'half' as FastStatus })
    expect(days()).toEqual({})
    expect(({} as Record<string, unknown>).kind).toBeUndefined()
  })

  it('refuses a day that has not begun where the user is, but lets a fast there be cleared', () => {
    setFast('2026-10-30', { kind: 'voluntary', status: 'fasted' })
    expect(days()).toEqual({})

    // Noon UTC on the 29th is already the 30th on Kiritimati (UTC+14): the saved location decides.
    freezeToday(TODAY, 'Pacific/Kiritimati')
    setFast('2026-10-30', { kind: 'voluntary', status: 'fasted' })
    setFast('2026-10-31', { kind: 'voluntary', status: 'fasted' })
    expect(Object.keys(days())).toEqual(['2026-10-30'])

    freezeToday(TODAY, 'UTC')
    setFast('2026-10-30', { kind: 'voluntary', status: 'broken' })
    expect(days()['2026-10-30']?.status).toBe('fasted')
    setFast('2026-10-30', null)
    expect(days()).toEqual({})
  })
})

describe('setOwedBefore', () => {
  it('keeps a whole number from 0, capped', () => {
    setOwedBefore(7)
    expect(useFasting.getState().owedBefore).toBe(7)
    setOwedBefore(2.6)
    expect(useFasting.getState().owedBefore).toBe(3)
    setOwedBefore(-4)
    expect(useFasting.getState().owedBefore).toBe(0)
    setOwedBefore(OWED_BEFORE_MAX + 50)
    expect(useFasting.getState().owedBefore).toBe(OWED_BEFORE_MAX)
  })

  it('ignores what is not a number rather than forgetting the figure', () => {
    setOwedBefore(12)
    setOwedBefore(Number.NaN)
    setOwedBefore(Number.POSITIVE_INFINITY)
    setOwedBefore('5' as unknown as number)
    expect(useFasting.getState().owedBefore).toBe(12)
  })
})

describe('hooks', () => {
  it('reads one day, and a range that keeps its identity while nothing in it changes', () => {
    setFast('2026-10-05', { kind: 'voluntary', status: 'fasted' })
    const { result } = renderHook(() => ({ day: useFast('2026-10-05'), month: useFastingRange('2026-10-01', '2026-10-31') }))
    expect(result.current.day).toEqual({ kind: 'voluntary', status: 'fasted', at: NOON })
    const month = result.current.month
    expect(month).toEqual({ '2026-10-05': { kind: 'voluntary', status: 'fasted', at: NOON } })

    act(() => setFast('2026-09-30', { kind: 'voluntary', status: 'fasted' }))
    expect(result.current.month).toBe(month)
    act(() => setFast('2026-10-06', { kind: 'qada', status: 'fasted' }))
    expect(Object.keys(result.current.month)).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('picks a range with both ends included', () => {
    const all = {
      '2026-09-30': { kind: 'voluntary', status: 'fasted' },
      '2026-10-01': { kind: 'voluntary', status: 'fasted' },
      '2026-10-31': { kind: 'voluntary', status: 'fasted' },
      '2026-11-01': { kind: 'voluntary', status: 'fasted' },
    } as const
    expect(Object.keys(pickFastingRange(all, '2026-10-01', '2026-10-31'))).toEqual(['2026-10-01', '2026-10-31'])
  })
})

describe('persistence', () => {
  it('writes every fast and the days owed before, versioned, under the app prefix', () => {
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    setOwedBefore(4)
    expect(FASTING_STORAGE_KEY).toBe('azkar:fasting')
    expect(FASTING_VERSION).toBe(1)
    expect(stored()).toEqual(v1({ days: { [TODAY]: { kind: 'voluntary', status: 'fasted', at: NOON } }, owedBefore: 4 }))
  })

  it('goes into a backup with everything else', () => {
    setFast(TODAY, { kind: 'qada', status: 'fasted' })
    expect(exportBackup().data[FASTING_STORAGE_KEY]).toEqual(stored())
  })

  it('restores what was stored, and the actions still work after', async () => {
    store(v1({ days: { '2026-03-01': { kind: 'ramadan', status: 'missed', at: 1_772_000_000_000 } }, owedBefore: 9 }))
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({ '2026-03-01': { kind: 'ramadan', status: 'missed', at: 1_772_000_000_000 } })
    expect(useFasting.getState().owedBefore).toBe(9)

    useFasting.getState().setFast('2026-03-01', { kind: 'ramadan', status: 'excused' })
    expect(days()['2026-03-01']).toEqual({ kind: 'ramadan', status: 'excused', at: NOON })
  })

  it('keeps days after today on load: a trip across the date line can put a real fast there', async () => {
    store(v1({ days: { '2026-11-02': { kind: 'voluntary', status: 'fasted', at: NOON } } }))
    await useFasting.persist.rehydrate()
    expect(Object.keys(days())).toEqual(['2026-11-02'])
  })
})

describe('reading stored data', () => {
  // Exactly what version 1 writes, kept as text so that a later version is tested against the real thing.
  const V1_PAYLOAD =
    '{"state":{"days":{"2026-02-18":{"kind":"ramadan","status":"fasted","at":1771394400000},' +
    '"2026-02-19":{"kind":"ramadan","status":"excused","at":1771480800000},' +
    '"2026-03-05":{"kind":"ramadan","status":"broken","at":1772712000000},' +
    '"2026-03-06":{"kind":"ramadan","status":"missed","at":1772798400000},' +
    '"2026-04-06":{"kind":"qada","status":"fasted","at":1775469600000},' +
    '"2026-10-26":{"kind":"voluntary","status":"fasted","at":1792987200000}},"owedBefore":5},"version":1}'

  it('reads a version 1 payload in full', async () => {
    store(V1_PAYLOAD)
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({
      '2026-02-18': { kind: 'ramadan', status: 'fasted', at: 1_771_394_400_000 },
      '2026-02-19': { kind: 'ramadan', status: 'excused', at: 1_771_480_800_000 },
      '2026-03-05': { kind: 'ramadan', status: 'broken', at: 1_772_712_000_000 },
      '2026-03-06': { kind: 'ramadan', status: 'missed', at: 1_772_798_400_000 },
      '2026-04-06': { kind: 'qada', status: 'fasted', at: 1_775_469_600_000 },
      '2026-10-26': { kind: 'voluntary', status: 'fasted', at: 1_792_987_200_000 },
    })
    expect(useFasting.getState().owedBefore).toBe(5)
    // Saved again, it is the same text: nothing was lost or reshaped.
    useFasting.setState({})
    expect(localStorage.getItem(FASTING_STORAGE_KEY)).toBe(V1_PAYLOAD)
  })

  it('keeps a long history in full', async () => {
    const long: Record<string, unknown> = {}
    for (let index = 0; index < 3000; index++) {
      long[shiftDateKey('2018-01-01', index)] = { kind: 'voluntary', status: index % 3 ? 'fasted' : 'excused', at: NOON }
    }
    store(v1({ days: long }))
    await useFasting.persist.rehydrate()
    expect(Object.keys(days())).toHaveLength(3000)
    expect(days()).toEqual(long)
  })

  it('drops what is not a fast but keeps every fast it can read', async () => {
    store(
      v1({
        days: {
          '2026-10-01': { kind: 'voluntary', status: 'fasted', at: NOON },
          '2026-10-02': { kind: 'nadhr', status: 'fasted', at: NOON },
          '2026-10-03': { kind: 'voluntary', status: 'half', at: NOON },
          '2026-10-04': 'fasted',
          '2026-10-05': [{ kind: 'voluntary', status: 'fasted' }],
          '2026-10-06': null,
          '2026-02-30': { kind: 'voluntary', status: 'fasted', at: NOON },
          'not a date': { kind: 'voluntary', status: 'fasted', at: NOON },
        },
      }),
    )
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({ '2026-10-01': { kind: 'voluntary', status: 'fasted', at: NOON } })
  })

  it('keeps a fast whose time cannot be read, without the time', async () => {
    store(
      v1({
        days: {
          '2026-10-01': { kind: 'qada', status: 'fasted', at: 'yesterday' },
          '2026-10-02': { kind: 'qada', status: 'fasted', at: 0 },
          '2026-10-03': { kind: 'qada', status: 'fasted', at: 9e15 },
          '2026-10-04': { kind: 'qada', status: 'fasted', at: 1.5 },
          '2026-10-05': { kind: 'qada', status: 'fasted' },
        },
      }),
    )
    await useFasting.persist.rehydrate()
    expect(Object.values(days())).toEqual(Array(5).fill({ kind: 'qada', status: 'fasted' }))
  })

  it.each([
    ['an array', []],
    ['a string', 'everything'],
    ['a number', 42],
    ['null', null],
  ])('reads days that are %s as nothing logged', async (_name, bad) => {
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    store(v1({ days: bad }))
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({})
  })

  it.each([
    ['an array', []],
    ['a string', 'everything'],
    ['an object', { days: 3 }],
    ['null', null],
  ])('reads owed days that are %s as none', async (_name, bad) => {
    setOwedBefore(6)
    store(v1({ owedBefore: bad }))
    await useFasting.persist.rehydrate()
    expect(useFasting.getState().owedBefore).toBe(0)
  })

  it('reads owed days as a whole number from 0, capped', async () => {
    for (const [given, read] of [[12, 12], [-3, 0], [2.5, 0], ['7', 0], [OWED_BEFORE_MAX * 2, OWED_BEFORE_MAX]] as const) {
      store(v1({ owedBefore: given }))
      await useFasting.persist.rehydrate()
      expect(useFasting.getState().owedBefore).toBe(read)
    }
  })

  it('is not fooled by prototype keys', async () => {
    store(
      '{"state":{"days":{"__proto__":{"kind":"voluntary","status":"fasted"},' +
        '"2026-10-01":{"__proto__":{"kind":"voluntary","status":"fasted"}},' +
        '"2026-10-02":{"kind":"voluntary","status":"fasted","__proto__":{"at":1}}},"owedBefore":1},"version":1}',
    )
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({ '2026-10-02': { kind: 'voluntary', status: 'fasted' } })
    expect(({} as Record<string, unknown>).kind).toBeUndefined()
  })

  it('keeps working when the stored value is not JSON at all', async () => {
    store('{"state": oops')
    await expect(Promise.resolve(useFasting.persist.rehydrate())).resolves.not.toThrow()
    expect(days()).toEqual({})
    setFast(TODAY, { kind: 'voluntary', status: 'fasted' })
    expect(stored()).toEqual(v1({ days: { [TODAY]: { kind: 'voluntary', status: 'fasted', at: NOON } } }))
  })

  it.each([0, 2, 99])('reads data stamped with version %i as far as it understands it', async (version) => {
    // A later build might add fields; every fast this build understands is kept.
    store({
      state: {
        days: {
          '2026-10-01': { kind: 'voluntary', status: 'fasted', at: NOON, note: 'with family' },
          '2026-10-02': { kind: 'kaffarah', status: 'fasted', at: NOON },
        },
        owedBefore: 3,
        intentions: { '2026-10-03': 'qada' },
      },
      version,
    })
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({ '2026-10-01': { kind: 'voluntary', status: 'fasted', at: NOON } })
    expect(useFasting.getState().owedBefore).toBe(3)
  })

  it('reads data that carries no version at all', async () => {
    store({ state: { days: { '2026-10-01': { kind: 'qada', status: 'broken', at: NOON } } } })
    await useFasting.persist.rehydrate()
    expect(days()).toEqual({ '2026-10-01': { kind: 'qada', status: 'broken', at: NOON } })
  })

  it('loads where Object.hasOwn does not exist, as in the iOS 15.0 web view', () => {
    const { migrate, merge } = useFasting.persist.getOptions()
    const hasOwn = Object.hasOwn
    Reflect.deleteProperty(Object, 'hasOwn')
    let loaded: unknown
    try {
      loaded = merge!(
        migrate!({ days: { '2026-10-01': { kind: 'voluntary', status: 'fasted', at: NOON } }, owedBefore: 2 }, 1) as unknown,
        useFasting.getState(),
      )
    } finally {
      Object.hasOwn = hasOwn
    }
    expect(loaded).toMatchObject({ days: { '2026-10-01': { kind: 'voluntary', status: 'fasted', at: NOON } }, owedBefore: 2 })
  })
})
