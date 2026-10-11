import { describe, expect, it } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { DateKey } from '../../shared/types'
import {
  completionRate,
  computeStreaks,
  firstLoggedDay,
  monthBreakdown,
  summarizeDay,
  totalOf,
  wholePercent,
} from './stats'
import type { DayLog, LogEntries, PrayerStatus } from './types'

/** All five prayers with the same status. */
function all(status: PrayerStatus): DayLog {
  return Object.fromEntries(PRAYERS.map((prayer) => [prayer, status])) as DayLog
}

/** The same log on every day from `from` to `to` inclusive. */
function span(from: DateKey, to: DateKey, log: DayLog = all('ontime')): LogEntries {
  const entries: LogEntries = {}
  for (let key = from; key <= to; key = shiftDateKey(key, 1)) entries[key] = log
  return entries
}

const TODAY = '2026-10-11'
const YESTERDAY = '2026-10-10'

describe('summarizeDay', () => {
  it('treats an absent day as five unlogged, required prayers', () => {
    expect(summarizeDay(undefined)).toMatchObject({ logged: 0, prayed: 0, due: 5, standing: 'incomplete' })
    expect(summarizeDay({})).toMatchObject({ logged: 0, prayed: 0, due: 5, standing: 'incomplete' })
  })

  it('counts on time, in congregation and made up late as prayed', () => {
    const summary = summarizeDay({ fajr: 'late', dhuhr: 'ontime', asr: 'jamaah', maghrib: 'jamaah', isha: 'ontime' })
    expect(summary).toMatchObject({ logged: 5, prayed: 5, due: 5, standing: 'complete' })
    expect(summary.counts).toEqual({ ontime: 2, jamaah: 2, late: 1, missed: 0, excused: 0 })
  })

  it('is incomplete with a missed prayer or one that is not logged', () => {
    expect(summarizeDay({ ...all('ontime'), asr: 'missed' })).toMatchObject({
      prayed: 4,
      due: 5,
      standing: 'incomplete',
    })
    expect(summarizeDay({ fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime' })).toMatchObject({
      logged: 4,
      standing: 'incomplete',
    })
  })

  it('takes excused prayers out of what was due', () => {
    expect(summarizeDay(all('excused'))).toMatchObject({ logged: 5, prayed: 0, due: 0, standing: 'exempt' })
    // The excuse began or ended part-way through the day.
    expect(summarizeDay({ ...all('excused'), fajr: 'ontime', dhuhr: 'late' })).toMatchObject({
      prayed: 2,
      due: 2,
      standing: 'complete',
    })
  })

  it('does not let excused prayers stand in for ones that were missed or left unlogged', () => {
    expect(summarizeDay({ ...all('excused'), isha: 'missed' }).standing).toBe('incomplete')
    expect(summarizeDay({ fajr: 'excused', dhuhr: 'excused', asr: 'excused' }).standing).toBe('incomplete')
    expect(summarizeDay({ fajr: 'excused', dhuhr: 'excused', asr: 'excused', maghrib: 'excused' }).standing).toBe(
      'incomplete',
    )
  })

  it('ignores values that are not statuses', () => {
    const corrupt = { fajr: 'ontime', dhuhr: 'banana', asr: 7 } as unknown as DayLog
    expect(summarizeDay(corrupt)).toMatchObject({ logged: 1, prayed: 1 })
  })
})

describe('computeStreaks', () => {
  it('is zero for a new user', () => {
    expect(computeStreaks({}, TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('counts the first day as soon as it is complete, and not before', () => {
    expect(computeStreaks({ [TODAY]: all('ontime') }, TODAY)).toEqual({ current: 1, best: 1 })
    expect(computeStreaks({ [TODAY]: { fajr: 'ontime', dhuhr: 'ontime' } }, TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('counts consecutive complete days up to and including today', () => {
    expect(computeStreaks(span('2026-10-07', TODAY), TODAY)).toEqual({ current: 5, best: 5 })
  })

  it('accepts prayers in congregation and prayers made up late', () => {
    const entries = { ...span('2026-10-09', YESTERDAY, all('jamaah')), [TODAY]: all('late') }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 3, best: 3 })
  })

  it('does not let an unfinished today break the streak', () => {
    const upToYesterday = span('2026-10-08', YESTERDAY)
    expect(computeStreaks(upToYesterday, TODAY)).toEqual({ current: 3, best: 3 })
    expect(computeStreaks({ ...upToYesterday, [TODAY]: { fajr: 'ontime' } }, TODAY)).toEqual({ current: 3, best: 3 })
    // Even a prayer marked missed today can still be made up before the day ends.
    expect(computeStreaks({ ...upToYesterday, [TODAY]: { fajr: 'missed', dhuhr: 'ontime' } }, TODAY)).toEqual({
      current: 3,
      best: 3,
    })
  })

  it('ends at a past day with a missed prayer', () => {
    const entries = { ...span('2026-10-05', TODAY), [YESTERDAY]: { ...all('ontime'), asr: 'missed' as const } }
    // Five days before the miss, one (today) after it.
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 1, best: 5 })
  })

  it('ends at a past day that was only partly logged', () => {
    const entries = { ...span('2026-10-05', TODAY), [YESTERDAY]: { fajr: 'ontime' as const } }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 1, best: 5 })
  })

  it('ends at a gap: a past day with nothing logged', () => {
    const entries = { ...span('2026-10-01', '2026-10-04'), ...span('2026-10-06', TODAY) }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 6, best: 6 })
    expect(computeStreaks(span('2026-10-01', '2026-10-09'), TODAY)).toEqual({ current: 0, best: 9 })
  })

  it('keeps the best run after a later, shorter one', () => {
    const entries = { ...span('2026-09-01', '2026-09-20'), ...span('2026-10-09', TODAY) }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 3, best: 20 })
  })

  it('carries across fully excused days without counting them', () => {
    const entries = {
      ...span('2026-09-28', '2026-09-30'),
      ...span('2026-10-01', '2026-10-07', all('excused')),
      ...span('2026-10-08', TODAY),
    }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 7, best: 7 })
  })

  it('holds steady while today, or a run ending today, is excused', () => {
    const entries = { ...span('2026-10-01', '2026-10-05'), ...span('2026-10-06', TODAY, all('excused')) }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 5, best: 5 })
    // An excused yesterday followed by an unlogged today changes nothing either.
    expect(computeStreaks({ ...span('2026-10-01', '2026-10-09'), [YESTERDAY]: all('excused') }, TODAY)).toEqual({
      current: 9,
      best: 9,
    })
  })

  it('never counts excused days on their own', () => {
    expect(computeStreaks(span('2026-10-01', TODAY, all('excused')), TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('still breaks at an unlogged day beside an excused run', () => {
    const entries = {
      ...span('2026-10-01', '2026-10-03'),
      ...span('2026-10-04', '2026-10-06', all('excused')),
      // 2026-10-07 has nothing logged.
      ...span('2026-10-08', TODAY),
    }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 4, best: 4 })
  })

  it('counts a partly excused day when the rest of it was prayed', () => {
    const partly: DayLog = { fajr: 'ontime', dhuhr: 'ontime', asr: 'excused', maghrib: 'excused', isha: 'excused' }
    expect(computeStreaks({ [YESTERDAY]: partly, [TODAY]: all('ontime') }, TODAY)).toEqual({ current: 2, best: 2 })
  })

  it('ignores days after today', () => {
    const entries = { ...span('2026-10-10', '2026-10-20') }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 2, best: 2 })
    expect(computeStreaks(span('2026-10-12', '2026-10-20'), TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('runs across month and year boundaries', () => {
    expect(computeStreaks(span('2025-12-29', '2026-01-02'), '2026-01-02')).toEqual({ current: 5, best: 5 })
    expect(computeStreaks(span('2026-01-30', '2026-02-02'), '2026-02-02')).toEqual({ current: 4, best: 4 })
  })

  it('knows about the leap day', () => {
    // 2028 has a 29 February: skipping it is a gap.
    expect(computeStreaks(span('2028-02-27', '2028-03-01'), '2028-03-01')).toEqual({ current: 4, best: 4 })
    const skipped = { ...span('2028-02-27', '2028-02-28'), '2028-03-01': all('ontime') }
    expect(computeStreaks(skipped, '2028-03-01')).toEqual({ current: 1, best: 2 })
    // 2026 does not: 28 February is followed directly by 1 March.
    const plain = { '2026-02-28': all('ontime'), '2026-03-01': all('ontime') }
    expect(computeStreaks(plain, '2026-03-01')).toEqual({ current: 2, best: 2 })
  })

  it('skips keys that are not calendar days instead of throwing', () => {
    const entries = { ...span(YESTERDAY, TODAY), 'not-a-date': all('ontime'), '2026-02-30': all('ontime') }
    expect(computeStreaks(entries, TODAY)).toEqual({ current: 2, best: 2 })
  })
})

describe('firstLoggedDay', () => {
  it('finds the earliest logged day, ignoring the future and empty days', () => {
    expect(firstLoggedDay({}, TODAY)).toBeNull()
    expect(firstLoggedDay({ '2026-10-20': all('ontime') }, TODAY)).toBeNull()
    expect(firstLoggedDay({ '2026-10-01': {}, '2026-10-03': { fajr: 'missed' }, [TODAY]: all('ontime') }, TODAY)).toBe(
      '2026-10-03',
    )
  })
})

describe('completionRate', () => {
  it('has no rate before anything is logged', () => {
    expect(completionRate({}, TODAY, 7)).toEqual({ prayed: 0, due: 0, rate: null })
    expect(completionRate({ '2026-10-12': all('ontime') }, TODAY, 7)).toEqual({ prayed: 0, due: 0, rate: null })
  })

  it('measures today only by what has been logged so far', () => {
    expect(completionRate({ [TODAY]: { fajr: 'ontime', dhuhr: 'jamaah' } }, TODAY, 7)).toEqual({
      prayed: 2,
      due: 2,
      rate: 1,
    })
    expect(completionRate({ [TODAY]: { fajr: 'missed', dhuhr: 'ontime' } }, TODAY, 7)).toEqual({
      prayed: 1,
      due: 2,
      rate: 0.5,
    })
  })

  it('leaves out the days before the first entry', () => {
    // Started three days ago: the window is three full days plus today so far.
    const entries = { ...span('2026-10-08', YESTERDAY), [TODAY]: { fajr: 'ontime' as const } }
    expect(completionRate(entries, TODAY, 7)).toEqual({ prayed: 16, due: 16, rate: 1 })
    expect(completionRate(entries, TODAY, 30)).toEqual({ prayed: 16, due: 16, rate: 1 })
  })

  it('counts unlogged prayers of past days as due once the user has started', () => {
    const entries = { '2026-10-08': all('ontime'), [YESTERDAY]: { fajr: 'ontime' as const } }
    // 8th: 5 of 5. 9th: nothing of 5. 10th: 1 of 5. Today: nothing logged, so nothing due yet.
    expect(completionRate(entries, TODAY, 7)).toEqual({ prayed: 6, due: 15, rate: 6 / 15 })
  })

  it('counts late as prayed and missed as due', () => {
    const entries = { [YESTERDAY]: { ...all('late'), isha: 'missed' as const } }
    expect(completionRate(entries, TODAY, 7)).toEqual({ prayed: 4, due: 5, rate: 0.8 })
  })

  it('never counts excused prayers against the user', () => {
    const entries = {
      '2026-10-08': all('ontime'),
      '2026-10-09': all('excused'),
      [YESTERDAY]: { ...all('excused'), fajr: 'ontime' as const },
      [TODAY]: { fajr: 'excused' as const },
    }
    expect(completionRate(entries, TODAY, 7)).toEqual({ prayed: 6, due: 6, rate: 1 })
  })

  it('has no rate when everything in the window was excused', () => {
    const excused = span('2026-10-05', TODAY, all('excused'))
    expect(completionRate(excused, TODAY, 7)).toEqual({ prayed: 0, due: 0, rate: null })
  })

  it('covers exactly the last N days, today included', () => {
    // A missed day seven days ago is outside a 7-day window; six days ago is inside it.
    const entries = { ...span('2026-10-01', YESTERDAY), '2026-10-04': all('missed') }
    expect(completionRate(entries, TODAY, 7)).toEqual({ prayed: 30, due: 30, rate: 1 })
    const inside = { ...span('2026-10-01', YESTERDAY), '2026-10-05': all('missed') }
    expect(completionRate(inside, TODAY, 7)).toEqual({ prayed: 25, due: 30, rate: 25 / 30 })
  })

  it('spans month and year boundaries', () => {
    const entries = span('2025-12-01', '2026-01-09')
    // 30 days ending 10 January: 12 December to 10 January. Today (the 10th) has nothing logged.
    expect(completionRate(entries, '2026-01-10', 30)).toEqual({ prayed: 29 * 5, due: 29 * 5, rate: 1 })
    expect(completionRate({ ...entries, '2025-12-12': all('missed') }, '2026-01-10', 30).due).toBe(29 * 5)
    expect(completionRate({ ...entries, '2025-12-12': all('missed') }, '2026-01-10', 30).prayed).toBe(28 * 5)
    expect(completionRate({ ...entries, '2025-12-11': all('missed') }, '2026-01-10', 30).prayed).toBe(29 * 5)
  })

  it('includes the leap day in a window that crosses it', () => {
    const entries = span('2028-02-26', '2028-03-02')
    expect(completionRate(entries, '2028-03-03', 7)).toEqual({ prayed: 30, due: 30, rate: 1 })
  })

  it('ignores entries dated after today', () => {
    const entries = { [YESTERDAY]: all('ontime'), '2026-10-12': all('missed') }
    expect(completionRate(entries, TODAY, 7)).toEqual({ prayed: 5, due: 5, rate: 1 })
  })
})

describe('wholePercent', () => {
  it('rounds down, so 100 means every due prayer was prayed', () => {
    expect(wholePercent({ prayed: 299, due: 300, rate: 299 / 300 })).toBe(99)
    expect(wholePercent({ prayed: 300, due: 300, rate: 1 })).toBe(100)
    expect(wholePercent({ prayed: 57, due: 100, rate: 0.57 })).toBe(57)
    expect(wholePercent({ prayed: 1, due: 3, rate: 1 / 3 })).toBe(33)
    expect(wholePercent({ prayed: 0, due: 5, rate: 0 })).toBe(0)
  })

  it('is null when nothing was due', () => {
    expect(wholePercent({ prayed: 0, due: 0, rate: null })).toBeNull()
  })
})

describe('monthBreakdown', () => {
  const october = { year: 2026, month: 10 }

  it('counts each status per prayer and overall', () => {
    const entries: LogEntries = {
      '2026-10-01': { fajr: 'ontime', dhuhr: 'jamaah', asr: 'late', maghrib: 'missed', isha: 'excused' },
      '2026-10-02': { fajr: 'ontime', dhuhr: 'jamaah' },
      '2026-10-03': { fajr: 'missed' },
    }
    const result = monthBreakdown(entries, october, '2026-10-31')
    expect(result.byPrayer.fajr).toEqual({ ontime: 2, jamaah: 0, late: 0, missed: 1, excused: 0 })
    expect(result.byPrayer.dhuhr).toEqual({ ontime: 0, jamaah: 2, late: 0, missed: 0, excused: 0 })
    expect(result.byPrayer.isha).toEqual({ ontime: 0, jamaah: 0, late: 0, missed: 0, excused: 1 })
    expect(result.byStatus).toEqual({ ontime: 2, jamaah: 2, late: 1, missed: 2, excused: 1 })
    expect(result.logged).toBe(8)
    expect(totalOf(result.byPrayer.fajr)).toBe(3)
    expect(result.elapsedDays).toBe(31)
  })

  it('stops at today in the current month', () => {
    const entries = { ...span('2026-10-09', '2026-10-14') }
    const result = monthBreakdown(entries, october, TODAY)
    expect(result.elapsedDays).toBe(11)
    expect(result.byPrayer.fajr.ontime).toBe(3)
    expect(result.logged).toBe(15)
  })

  it('has nothing for a month that has not begun', () => {
    const result = monthBreakdown(span('2026-11-01', '2026-11-05'), { year: 2026, month: 11 }, TODAY)
    expect(result).toMatchObject({ elapsedDays: 0, logged: 0 })
  })

  it('keeps to its own month at both ends', () => {
    const entries = { ...span('2026-01-30', '2026-03-02') }
    const february = monthBreakdown(entries, { year: 2026, month: 2 }, '2026-12-31')
    expect(february.elapsedDays).toBe(28)
    expect(february.byStatus.ontime).toBe(28 * 5)
  })

  it('counts 29 days in a leap February', () => {
    const result = monthBreakdown(span('2028-02-01', '2028-03-01'), { year: 2028, month: 2 }, '2028-12-31')
    expect(result.elapsedDays).toBe(29)
    expect(result.byPrayer.isha.ontime).toBe(29)
  })

  it('handles December without spilling into January', () => {
    const result = monthBreakdown(span('2025-12-25', '2026-01-05'), { year: 2025, month: 12 }, '2026-01-05')
    expect(result.elapsedDays).toBe(31)
    expect(result.byPrayer.fajr.ontime).toBe(7)
  })
})
