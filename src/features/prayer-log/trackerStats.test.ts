import { describe, expect, it } from 'vitest'
import { PRAYERS } from '../../shared/types'
import type { SessionRecord } from '../azkar'
import { hasAnyRecord, lifetimePrayers, recordedDays, statsDayOf, weeklyTotals } from './trackerStats'
import type { TrackerData } from './trackerStats'
import type { DayLog } from './types'

const TODAY = '2026-10-11' // A Sunday.
const tick = 1_790_000_000_000
const ALL = Object.fromEntries(PRAYERS.map((prayer) => [prayer, 'ontime'])) as DayLog
const record = (completed: boolean): SessionRecord => ({ completed, done: 1, total: 2, recitations: 3 })
const none = (): TrackerData => ({ entries: {}, sunnah: {}, sessions: {} })

describe('statsDayOf', () => {
  it('counts up to the day before between midnight and Fajr, and up to today otherwise', () => {
    expect(statsDayOf(TODAY, 'beforeDawn')).toBe('2026-10-10')
    expect(statsDayOf('2026-01-01', 'beforeDawn')).toBe('2025-12-31')
    for (const phase of ['morning', 'midday', 'evening'] as const) expect(statsDayOf(TODAY, phase)).toBe(TODAY)
  })
})

describe('hasAnyRecord', () => {
  it('is false for a new user', () => {
    expect(hasAnyRecord({}, {}, {}, TODAY)).toBe(false)
  })

  it('is true once a prayer, a sunnah prayer or an azkar session is recorded', () => {
    expect(hasAnyRecord({ '2026-10-01': { fajr: 'missed' } }, {}, {}, TODAY)).toBe(true)
    expect(hasAnyRecord({}, { [TODAY]: { witr: tick } }, {}, TODAY)).toBe(true)
    expect(hasAnyRecord({}, {}, { '2026-10-01': { evening: record(false) } }, TODAY)).toBe(true)
  })

  it('looks past days to come, empty days and keys that are not dates', () => {
    expect(hasAnyRecord({ '2026-10-12': ALL }, { '2026-10-12': { witr: tick } }, { '2026-10-12': { morning: record(true) } }, TODAY)).toBe(false)
    expect(hasAnyRecord({ [TODAY]: {} }, { [TODAY]: {} }, { [TODAY]: {}, 'not-a-day': { morning: record(true) } }, TODAY)).toBe(false)
  })
})

describe('lifetimePrayers', () => {
  it('counts every prayer logged and prayed, and every sunnah prayer ticked, up to today', () => {
    expect(
      lifetimePrayers(
        {
          '2025-03-01': ALL,
          '2026-10-10': { fajr: 'late', dhuhr: 'jamaah', asr: 'missed', maghrib: 'excused' },
          '2026-10-12': ALL,
          'garbage': ALL,
        },
        { '2026-10-09': { witr: tick, duha: tick }, [TODAY]: { beforeFajr: tick }, '2026-10-12': { witr: tick } },
        TODAY,
      ),
    ).toEqual({ logged: 9, prayed: 7, sunnah: 3 })
  })

  it('is all zeros for a new user', () => {
    expect(lifetimePrayers({}, {}, TODAY)).toEqual({ logged: 0, prayed: 0, sunnah: 0 })
  })
})

describe('weeklyTotals', () => {
  it('gives the requested number of weeks, oldest first, the last one being the week under way', () => {
    const weeks = weeklyTotals(none(), '2026-10-14', 0, 8)
    expect(weeks.map((week) => week.start)).toEqual([
      '2026-08-23',
      '2026-08-30',
      '2026-09-06',
      '2026-09-13',
      '2026-09-20',
      '2026-09-27',
      '2026-10-04',
      '2026-10-11',
    ])
    expect(weeks.map((week) => week.current)).toEqual([false, false, false, false, false, false, false, true])
    // Sunday to Wednesday of the week under way have begun.
    expect(weeks.map((week) => week.days)).toEqual([7, 7, 7, 7, 7, 7, 7, 4])
  })

  it('begins weeks on the given day', () => {
    expect(weeklyTotals(none(), TODAY, 6, 2).map((week) => week.start)).toEqual(['2026-10-03', '2026-10-10'])
    expect(weeklyTotals(none(), TODAY, 1, 2).map((week) => week.start)).toEqual(['2026-09-28', '2026-10-05'])
    // Today is the first day of its week.
    expect(weeklyTotals(none(), TODAY, 0, 1)).toEqual([
      { start: TODAY, days: 1, current: true, prayed: 0, sunnah: 0, azkar: 0 },
    ])
  })

  it('adds up prayers prayed, sunnah prayers and completed morning and evening sessions', () => {
    const data: TrackerData = {
      entries: {
        '2026-10-04': ALL,
        '2026-10-05': { fajr: 'late', dhuhr: 'missed', asr: 'excused', maghrib: 'jamaah' },
        [TODAY]: { fajr: 'ontime' },
        '2026-10-12': ALL,
      },
      sunnah: { '2026-10-05': { witr: tick, qiyam: tick }, '2026-10-13': { witr: tick } },
      sessions: {
        '2026-10-04': { morning: record(true), evening: record(true), sleep: record(true) },
        '2026-10-05': { morning: record(false) },
        [TODAY]: { evening: record(true) },
        '2026-10-12': { morning: record(true) },
      },
    }
    expect(weeklyTotals(data, TODAY, 0, 2)).toEqual([
      { start: '2026-10-04', days: 7, current: false, prayed: 7, sunnah: 2, azkar: 2 },
      { start: TODAY, days: 1, current: true, prayed: 1, sunnah: 0, azkar: 1 },
    ])
  })

  it('crosses the year boundary', () => {
    const weeks = weeklyTotals({ ...none(), entries: { '2025-12-31': ALL, '2026-01-01': ALL } }, '2026-01-02', 0, 2)
    expect(weeks).toEqual([
      { start: '2025-12-21', days: 7, current: false, prayed: 0, sunnah: 0, azkar: 0 },
      { start: '2025-12-28', days: 6, current: true, prayed: 10, sunnah: 0, azkar: 0 },
    ])
  })

  it('gives nothing for a day that is not a date', () => {
    expect(weeklyTotals(none(), 'soon', 0, 8)).toEqual([])
  })
})

describe('recordedDays', () => {
  it('lists every day anything is stored for, once, oldest first, days to come included', () => {
    expect(
      recordedDays({
        entries: { '2026-10-09': { fajr: 'ontime' }, '2026-12-01': ALL },
        loggedAt: { '2026-10-09': { fajr: tick } },
        sunnah: { '2026-10-03': { witr: tick } },
        sessions: { '2026-09-30': { morning: record(false) }, 'garbage': { morning: record(true) } },
      }),
    ).toEqual(['2026-09-30', '2026-10-03', '2026-10-09', '2026-12-01'])
  })
})
