import { describe, expect, it } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import {
  fastingStats,
  mondayThursdayStreak,
  owedDays,
  ramadanSummary,
  shawwalFastsBefore,
  voluntaryCounts,
  whiteDaysStreak,
} from './stats'
import type { FastingDays, FastKind, FastStatus } from './types'

const AT = 1_790_000_000_000

function fast(kind: FastKind, status: FastStatus = 'fasted') {
  return { kind, status, at: AT }
}

/** The same fast on every day from `from`, `count` days long. */
function run(from: string, count: number, kind: FastKind, status: FastStatus = 'fasted'): FastingDays {
  const days: FastingDays = {}
  for (let index = 0; index < count; index++) days[shiftDateKey(from, index)] = fast(kind, status)
  return days
}

describe('days owed', () => {
  it('owes every logged day of Ramadan not fasted to the end, whatever the reason', () => {
    const days: FastingDays = {
      '2026-02-18': fast('ramadan'),
      '2026-02-19': fast('ramadan', 'excused'),
      '2026-02-20': fast('ramadan', 'missed'),
      '2026-02-21': fast('ramadan', 'broken'),
      '2025-03-10': fast('ramadan', 'excused'),
    }
    expect(owedDays(days)).toEqual({ fromRamadan: 4, before: 0, madeUp: 0, remaining: 4 })
  })

  it('takes a day off for every make-up fast completed, and none for one broken off', () => {
    const days: FastingDays = {
      '2026-02-19': fast('ramadan', 'excused'),
      '2026-02-20': fast('ramadan', 'excused'),
      '2026-02-21': fast('ramadan', 'excused'),
      '2026-04-06': fast('qada'),
      '2026-04-09': fast('qada', 'broken'),
      '2026-04-13': fast('qada'),
    }
    expect(owedDays(days)).toEqual({ fromRamadan: 3, before: 0, madeUp: 2, remaining: 1 })
  })

  it('adds the days owed from before the log, and never goes below zero', () => {
    const days: FastingDays = { '2026-02-19': fast('ramadan', 'missed'), ...run('2026-05-04', 5, 'qada') }
    expect(owedDays(days, 6)).toEqual({ fromRamadan: 1, before: 6, madeUp: 5, remaining: 2 })
    expect(owedDays(days, 0)).toEqual({ fromRamadan: 1, before: 0, madeUp: 5, remaining: 0 })
    expect(owedDays(days, -3).before).toBe(0)
  })

  it('does not count voluntary fasts, nor days of Ramadan with nothing logged', () => {
    const days: FastingDays = { ...run('2026-02-18', 10, 'ramadan'), ...run('2026-05-04', 3, 'voluntary') }
    expect(owedDays(days)).toEqual({ fromRamadan: 0, before: 0, madeUp: 0, remaining: 0 })
    expect(owedDays({})).toEqual({ fromRamadan: 0, before: 0, madeUp: 0, remaining: 0 })
  })
})

describe('this year’s Ramadan', () => {
  const RAMADAN_1447 = '2026-02-18'

  it('is last year’s until this year’s begins', () => {
    const days: FastingDays = {
      ...run(RAMADAN_1447, 25, 'ramadan'),
      '2026-03-15': fast('ramadan', 'excused'),
      '2026-03-16': fast('ramadan', 'broken'),
      // Ramadan 1446 is another year.
      '2025-03-10': fast('ramadan'),
    }
    const summary = ramadanSummary(days, '2026-10-29')!
    expect(summary).toMatchObject({ year: 1447, elapsed: 30, fasted: 25, notFasted: 2, unlogged: 3, ongoing: false })
    expect(summary.days).toHaveLength(30)
    expect(summary.days[0]).toBe(RAMADAN_1447)
  })

  it('counts only the days that have begun while it is under way', () => {
    const days = run(RAMADAN_1447, 8, 'ramadan')
    expect(ramadanSummary(days, '2026-02-27')).toMatchObject({ year: 1447, elapsed: 10, fasted: 8, unlogged: 2, ongoing: true })
    expect(ramadanSummary({}, RAMADAN_1447)).toMatchObject({ elapsed: 1, fasted: 0, unlogged: 1, ongoing: true })
  })

  it('moves with the offset', () => {
    // Shifted a day earlier, Ramadan 1447 runs from 17 February to 18 March.
    const summary = ramadanSummary(run('2026-02-17', 30, 'ramadan'), '2026-03-18', 1)!
    expect(summary).toMatchObject({ year: 1447, elapsed: 30, fasted: 30, unlogged: 0, ongoing: true })
    expect(summary.days[0]).toBe('2026-02-17')
  })

  it('switches to the new Ramadan on its first day', () => {
    expect(ramadanSummary({}, '2027-02-07')!.year).toBe(1447)
    expect(ramadanSummary({}, '2027-02-08')).toMatchObject({ year: 1448, elapsed: 1, ongoing: true })
  })
})

describe('voluntary fasts', () => {
  it('counts the ones completed this Hijri month and this Hijri year', () => {
    const days: FastingDays = {
      // Jumada I 1448 runs from 12 October to 10 November 2026.
      '2026-10-12': fast('voluntary'),
      '2026-10-26': fast('voluntary'),
      '2026-10-29': fast('voluntary'),
      '2026-10-27': fast('voluntary', 'broken'),
      '2026-10-28': fast('qada'),
      // Earlier in 1448.
      '2026-06-25': fast('voluntary'),
      // 1447.
      '2026-05-26': fast('voluntary'),
    }
    expect(voluntaryCounts(days, '2026-10-29')).toEqual({ month: 3, year: 4 })
    // With the offset the 12th of October falls in the month before.
    expect(voluntaryCounts(days, '2026-10-29', -1)).toEqual({ month: 2, year: 4 })
  })

  it('counts the six days of Shawwal made so far, the day itself left out', () => {
    const days: FastingDays = {
      '2026-03-22': fast('voluntary'),
      '2026-03-23': fast('voluntary'),
      '2026-03-24': fast('qada'),
      '2026-03-25': fast('voluntary', 'broken'),
      '2026-03-26': fast('voluntary'),
      '2026-05-04': fast('voluntary'),
    }
    expect(shawwalFastsBefore(days, '2026-04-01')).toBe(3)
    expect(shawwalFastsBefore(days, '2026-03-26')).toBe(2)
  })

  it('does not count a fast filed on the Eid among the six', () => {
    // Logged with an offset that made 20 March the 30th of Ramadan; without it, the 20th is the Eid.
    const days: FastingDays = { '2026-03-20': fast('voluntary'), '2026-03-22': fast('voluntary') }
    expect(shawwalFastsBefore(days, '2026-04-01')).toBe(1)
    expect(shawwalFastsBefore(days, '2026-04-01', -1)).toBe(1)
  })
})

describe('the streak of Mondays and Thursdays', () => {
  // Mondays and Thursdays from 2 November 2026: 2, 5, 9, 12, 16 and 19 November.
  it('counts them one after the other, and a day missed breaks the run', () => {
    const days: FastingDays = {
      '2026-11-02': fast('voluntary'),
      '2026-11-05': fast('voluntary'),
      '2026-11-12': fast('voluntary'),
      '2026-11-16': fast('qada'),
      '2026-11-19': fast('voluntary'),
    }
    expect(mondayThursdayStreak(days, '2026-11-20')).toEqual({ current: 3, best: 3 })
    expect(mondayThursdayStreak(days, '2026-11-11')).toEqual({ current: 0, best: 2 })
  })

  it('waits for today, but a day logged as not fasted breaks it at once', () => {
    const days: FastingDays = { '2026-11-02': fast('voluntary'), '2026-11-05': fast('voluntary') }
    expect(mondayThursdayStreak(days, '2026-11-09')).toEqual({ current: 2, best: 2 })
    expect(mondayThursdayStreak({ ...days, '2026-11-09': fast('voluntary', 'broken') }, '2026-11-09')).toEqual({
      current: 0,
      best: 2,
    })
    expect(mondayThursdayStreak(days, '2026-11-10')).toEqual({ current: 0, best: 2 })
  })

  it('lets an excused day pass without breaking or extending it', () => {
    const days: FastingDays = {
      '2026-11-02': fast('voluntary'),
      '2026-11-05': fast('voluntary', 'excused'),
      '2026-11-09': fast('voluntary'),
    }
    expect(mondayThursdayStreak(days, '2026-11-09')).toEqual({ current: 2, best: 2 })
  })

  it('leaves out Ramadan and the days fasting is not permitted', () => {
    const days: FastingDays = {
      // The last Thursday and Monday before Ramadan 1447, then the first Monday and Thursday after the Eid.
      '2026-02-12': fast('voluntary'),
      '2026-02-16': fast('voluntary'),
      '2026-03-23': fast('voluntary'),
      '2026-03-26': fast('voluntary'),
    }
    expect(mondayThursdayStreak(days, '2026-03-26')).toEqual({ current: 4, best: 4 })

    // Monday 25 May, then Thursday 28 May is a day of Tashriq, then Monday 1 June.
    const adha: FastingDays = { '2026-05-25': fast('voluntary'), '2026-06-01': fast('voluntary') }
    expect(mondayThursdayStreak(adha, '2026-06-01')).toEqual({ current: 2, best: 2 })
  })

  it('starts from the first fast logged, and is nothing without one', () => {
    expect(mondayThursdayStreak({}, '2026-11-20')).toEqual({ current: 0, best: 0 })
    expect(mondayThursdayStreak({ '2026-11-04': fast('voluntary') }, '2026-11-04')).toEqual({ current: 0, best: 0 })
  })
})

describe('the streak of white days', () => {
  // The white days of 1448: Rabi I 26–28 August, Rabi II 24–26 September, Jumada I 24–26 October,
  // Jumada II 23–25 November.
  const RABI_I = run('2026-08-26', 3, 'voluntary')
  const RABI_II = run('2026-09-24', 3, 'voluntary')
  const JUMADA_I = run('2026-10-24', 3, 'voluntary')

  it('counts months whose white days were all fasted', () => {
    expect(whiteDaysStreak({ ...RABI_I, ...RABI_II, ...JUMADA_I }, '2026-11-01')).toEqual({ current: 3, best: 3 })
  })

  it('breaks on a month with a white day not fasted', () => {
    const days = { ...RABI_I, ...RABI_II, ...JUMADA_I, '2026-09-25': fast('voluntary', 'missed') }
    expect(whiteDaysStreak(days, '2026-11-01')).toEqual({ current: 1, best: 1 })
    const { ['2026-10-25']: _left, ...gap } = { ...RABI_I, ...RABI_II, ...JUMADA_I }
    expect(whiteDaysStreak(gap, '2026-11-01')).toEqual({ current: 0, best: 2 })
  })

  it('lets excused white days pass, but a month of nothing but excuses does not count', () => {
    const days = {
      ...RABI_I,
      ...run('2026-09-24', 3, 'voluntary', 'excused'),
      ...JUMADA_I,
      '2026-10-25': fast('voluntary', 'excused'),
    }
    expect(whiteDaysStreak(days, '2026-11-01')).toEqual({ current: 2, best: 2 })
  })

  it('keeps the month under way open until its white days are past', () => {
    const days = { ...RABI_II, '2026-10-24': fast('voluntary') }
    // On the 14th: the 13th fasted, today not yet logged.
    expect(whiteDaysStreak(days, '2026-10-25')).toEqual({ current: 2, best: 2 })
    // Once the 14th and 15th have passed unfasted, the month is broken.
    expect(whiteDaysStreak(days, '2026-10-27')).toEqual({ current: 0, best: 1 })
  })

  it('leaves out Ramadan, and the 13th of Dhu al-Hijjah, a day of Tashriq', () => {
    const days: FastingDays = {
      // Sha'ban's white days, then Ramadan, then Shawwal's.
      ...run('2026-02-01', 3, 'voluntary'),
      ...run('2026-04-01', 3, 'voluntary'),
      // Dhu al-Qadah 13–15, then Dhu al-Hijjah 14 and 15 only.
      ...run('2026-04-30', 3, 'voluntary'),
      ...run('2026-05-31', 2, 'voluntary'),
    }
    expect(whiteDaysStreak(days, '2026-06-02')).toEqual({ current: 4, best: 4 })
  })

  it('works out the months with the offset', () => {
    // A day earlier, Jumada I's white days are 23–25 October.
    const shifted = run('2026-10-23', 3, 'voluntary')
    expect(whiteDaysStreak(shifted, '2026-10-30', 1)).toEqual({ current: 1, best: 1 })
    expect(whiteDaysStreak(shifted, '2026-10-30', 0)).toEqual({ current: 0, best: 0 })
  })
})

describe('fastingStats', () => {
  it('gathers every figure', () => {
    const days: FastingDays = {
      ...run('2026-02-18', 28, 'ramadan'),
      '2026-03-18': fast('ramadan', 'excused'),
      '2026-03-19': fast('ramadan', 'excused'),
      '2026-04-06': fast('qada'),
      '2026-10-26': fast('voluntary'),
    }
    const stats = fastingStats(days, { today: '2026-10-29', owedBefore: 3 })
    expect(stats.owed).toEqual({ fromRamadan: 2, before: 3, madeUp: 1, remaining: 4 })
    expect(stats.ramadan).toMatchObject({ year: 1447, fasted: 28, notFasted: 2, unlogged: 0 })
    expect(stats.voluntary).toEqual({ month: 1, year: 1 })
    expect(stats.mondayThursday.best).toBeGreaterThanOrEqual(1)
  })
})
