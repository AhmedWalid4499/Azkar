import { describe, expect, it } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { fastingDayInfo, forbiddenDayOf, isMondayOrThursday, isWhiteDay } from './occasions'

const reasons = (dateKey: string, offset = 0) => fastingDayInfo(dateKey, offset).reasons
const forbidden = (dateKey: string, offset = 0) => fastingDayInfo(dateKey, offset).forbidden

describe('recommended days', () => {
  it('suggests Mondays and Thursdays, and nothing on an ordinary day', () => {
    expect(reasons('2026-11-02')).toEqual(['monday'])
    expect(reasons('2026-10-29')).toEqual(['thursday'])
    expect(reasons('2026-11-03')).toEqual([])
    expect(reasons('2026-10-31')).toEqual([])
  })

  it('suggests the white days, the 13th to the 15th of each Hijri month', () => {
    // 13, 14 and 15 Jumada I 1448: Saturday, Sunday and Monday.
    expect(reasons('2026-10-23')).toEqual([])
    expect(reasons('2026-10-24')).toEqual(['whiteDays'])
    expect(reasons('2026-10-25')).toEqual(['whiteDays'])
    expect(reasons('2026-10-26')).toEqual(['whiteDays', 'monday'])
    expect(reasons('2026-10-27')).toEqual([])
  })

  it('suggests the day of Arafah, 9 Dhu al-Hijjah', () => {
    expect(reasons('2026-05-26')).toEqual(['arafah'])
    expect(reasons('2026-05-25')).toEqual(['monday'])
  })

  it('suggests Ashura, 10 Muharram, with the day before it', () => {
    expect(reasons('2026-06-24')).toEqual(['tasua'])
    expect(reasons('2026-06-25')).toEqual(['ashura', 'thursday'])
    expect(reasons('2026-06-26')).toEqual([])
  })

  it('suggests every day of Shawwal after the Eid for the six days', () => {
    expect(reasons('2026-03-21')).toEqual(['shawwal'])
    expect(reasons('2026-04-02')).toEqual(['shawwal', 'whiteDays', 'thursday'])
    expect(reasons('2026-04-17')).toEqual(['shawwal'])
    // 1 Dhu al-Qadah.
    expect(reasons('2026-04-18')).toEqual([])
  })
})

describe('days fasting is not permitted', () => {
  it('names Eid al-Fitr and suggests nothing on it, even on a Monday', () => {
    expect(forbidden('2026-03-20')).toBe('eidAlFitr')
    expect(reasons('2026-03-20')).toEqual([])
    // Eid al-Fitr 1448 falls on a Tuesday; shifted by one day it falls on the Monday before.
    expect(forbidden('2027-03-08', 1)).toBe('eidAlFitr')
    expect(reasons('2027-03-08', 1)).toEqual([])
  })

  it('names Eid al-Adha and the three days of Tashriq, the Thursday and the white 13th among them', () => {
    expect(forbidden('2026-05-27')).toBe('eidAlAdha')
    expect(forbidden('2026-05-28')).toBe('tashriq')
    expect(reasons('2026-05-28')).toEqual([])
    expect(forbidden('2026-05-29')).toBe('tashriq')
    expect(forbidden('2026-05-30')).toBe('tashriq')
    expect(reasons('2026-05-30')).toEqual([])
    // The 14th and 15th of Dhu al-Hijjah are white days again.
    expect(forbidden('2026-05-31')).toBeNull()
    expect(reasons('2026-05-31')).toEqual(['whiteDays'])
    expect(reasons('2026-06-01')).toEqual(['whiteDays', 'monday'])
  })

  it('moves with the Hijri offset', () => {
    // One day later in the Hijri calendar: Monday 25 May is Arafah and Tuesday 26 May the Eid.
    expect(reasons('2026-05-25', 1)).toEqual(['arafah', 'monday'])
    expect(forbidden('2026-05-26', 1)).toBe('eidAlAdha')
    expect(reasons('2026-05-26', 1)).toEqual([])
    // One day earlier: Wednesday 27 May is Arafah, not the Eid.
    expect(forbidden('2026-05-27', -1)).toBeNull()
    expect(reasons('2026-05-27', -1)).toEqual(['arafah'])
    expect(forbidden('2026-05-31', -1)).toBe('tashriq')
  })

  it('is never a white day', () => {
    expect(isWhiteDay({ year: 1447, month: 12, day: 13 })).toBe(false)
    expect(isWhiteDay({ year: 1447, month: 12, day: 14 })).toBe(true)
    expect(isWhiteDay({ year: 1447, month: 9, day: 14 })).toBe(false)
    expect(isWhiteDay(null)).toBe(false)
    expect(forbiddenDayOf(null)).toBeNull()
  })
})

describe('Ramadan', () => {
  it('gives the day of Ramadan and suggests nothing: the fast is obligatory', () => {
    const first = fastingDayInfo('2026-02-18')
    expect(first.ramadanDay).toBe(1)
    expect(first.reasons).toEqual([])
    // A Monday and a white day in Ramadan.
    expect(fastingDayInfo('2026-03-02')).toMatchObject({ ramadanDay: 13, reasons: [], forbidden: null })
    expect(fastingDayInfo('2026-03-19').ramadanDay).toBe(30)
    expect(fastingDayInfo('2026-03-20').ramadanDay).toBeNull()
  })

  it('follows the offset', () => {
    expect(fastingDayInfo('2026-02-17', 1).ramadanDay).toBe(1)
    expect(fastingDayInfo('2026-02-18', -1).ramadanDay).toBeNull()
    expect(fastingDayInfo('2026-02-18', -1).reasons).toEqual([])
  })
})

describe('weekdays', () => {
  it('finds every Monday and Thursday, and only them', () => {
    const week = Array.from({ length: 7 }, (_, index) => shiftDateKey('2026-11-01', index))
    expect(week.filter(isMondayOrThursday)).toEqual(['2026-11-02', '2026-11-05'])
  })
})
