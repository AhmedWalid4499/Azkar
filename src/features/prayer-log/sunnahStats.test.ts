import { describe, expect, it } from 'vitest'
import { shiftDateKey } from '../../shared/date'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import {
  firstSunnahDay,
  isSunnahExcused,
  rawatibStreaks,
  summarizeSunnahDay,
  sunnahCompletion,
  sunnahStreaks,
  witrStreaks,
} from './sunnahStats'
import { RAWATIB, SUNNAH_PRAYERS } from './types'
import type { DayLog, LogEntries, SunnahDay, SunnahEntries, SunnahPrayer } from './types'

const AT = 1_790_000_000_000
const TODAY = '2026-10-11'
const YESTERDAY = '2026-10-10'

/** A day with these sunnah prayers ticked. */
function tick(...prayers: SunnahPrayer[]): SunnahDay {
  return Object.fromEntries(prayers.map((prayer) => [prayer, AT])) as SunnahDay
}

const ALL = tick(...SUNNAH_PRAYERS)
const RAWATIB_ONLY = tick(...RAWATIB)

/** The same sunnah day on every day from `from` to `to` inclusive. */
function span(from: DateKey, to: DateKey, day: SunnahDay = ALL): SunnahEntries {
  const sunnah: SunnahEntries = {}
  for (let key = from; key <= to; key = shiftDateKey(key, 1)) sunnah[key] = day
  return sunnah
}

/** An obligatory log with these prayers excused. */
function excused(...prayers: PrayerName[]): DayLog {
  return Object.fromEntries(prayers.map((prayer) => [prayer, 'excused'])) as DayLog
}

const EXEMPT = excused(...PRAYERS)

function zeros(): Record<SunnahPrayer, number> {
  return Object.fromEntries(SUNNAH_PRAYERS.map((prayer) => [prayer, 0])) as Record<SunnahPrayer, number>
}

describe('summarizeSunnahDay', () => {
  it('treats an absent day as eight sunnah prayers open and none done', () => {
    for (const day of [undefined, {}]) {
      expect(summarizeSunnahDay(day)).toEqual({
        done: 0,
        due: 8,
        rawatib: 0,
        rawatibRakahs: 0,
        rawatibStanding: 'incomplete',
        witr: false,
        witrStanding: 'incomplete',
      })
    }
  })

  it('counts a full day: eight prayers, the five rawatib and their twelve rak’ahs', () => {
    expect(summarizeSunnahDay(ALL)).toEqual({
      done: 8,
      due: 8,
      rawatib: 5,
      rawatibRakahs: 12,
      rawatibStanding: 'complete',
      witr: true,
      witrStanding: 'complete',
    })
  })

  it('counts the rak’ahs of the rawatib that were prayed', () => {
    expect(summarizeSunnahDay(tick('beforeFajr', 'beforeDhuhr', 'witr'))).toMatchObject({
      done: 3,
      rawatib: 2,
      rawatibRakahs: 6,
      rawatibStanding: 'incomplete',
      witrStanding: 'complete',
    })
    // Duha, the Night prayer and Witr are not among the rawatib.
    expect(summarizeSunnahDay(tick('duha', 'qiyam', 'witr'))).toMatchObject({ done: 3, rawatib: 0, rawatibRakahs: 0 })
    expect(summarizeSunnahDay(RAWATIB_ONLY)).toMatchObject({ done: 5, rawatibRakahs: 12, rawatibStanding: 'complete', witr: false })
  })

  it('leaves out the sunnah prayers of an excused obligatory prayer', () => {
    // Isha excused: the sunnah after it, the Night prayer and Witr were not asked either.
    expect(summarizeSunnahDay(undefined, excused('isha'))).toMatchObject({ done: 0, due: 5, witrStanding: 'exempt' })
    // Fajr excused: the two before it and Duha.
    expect(summarizeSunnahDay(undefined, excused('fajr'))).toMatchObject({ due: 6 })
    // A whole day excused leaves nothing open.
    expect(summarizeSunnahDay(undefined, EXEMPT)).toMatchObject({
      due: 0,
      rawatibStanding: 'exempt',
      witrStanding: 'exempt',
    })
  })

  it('still counts a sunnah prayer that was prayed although its obligatory prayer was excused', () => {
    expect(summarizeSunnahDay(tick('witr'), excused('isha'))).toMatchObject({ done: 1, due: 6, witrStanding: 'complete' })
  })

  it('completes the rawatib with those that were excused, as long as one was prayed', () => {
    // The excuse ended in the afternoon; Maghrib and Isha and their sunnah prayers were prayed.
    const log = excused('fajr', 'dhuhr', 'asr')
    expect(summarizeSunnahDay(tick('afterMaghrib', 'afterIsha'), log)).toMatchObject({
      rawatib: 2,
      rawatibRakahs: 4,
      rawatibStanding: 'complete',
    })
    expect(summarizeSunnahDay(tick('afterMaghrib'), log).rawatibStanding).toBe('incomplete')
  })

  it('ignores values that are not times', () => {
    const corrupt = { witr: AT, duha: true, qiyam: 'yes' } as unknown as SunnahDay
    expect(summarizeSunnahDay(corrupt)).toMatchObject({ done: 1, witr: true })
  })
})

describe('isSunnahExcused', () => {
  it('follows the obligatory prayer each sunnah prayer goes with', () => {
    expect(isSunnahExcused('beforeFajr', excused('fajr'))).toBe(true)
    expect(isSunnahExcused('beforeFajr', excused('dhuhr'))).toBe(false)
    expect(isSunnahExcused('afterDhuhr', excused('dhuhr'))).toBe(true)
    expect(isSunnahExcused('afterMaghrib', excused('maghrib'))).toBe(true)
    for (const night of ['afterIsha', 'qiyam', 'witr'] as const) expect(isSunnahExcused(night, excused('isha'))).toBe(true)
    // Duha lies between Fajr and Dhuhr: excused if either one is.
    expect(isSunnahExcused('duha', excused('fajr'))).toBe(true)
    expect(isSunnahExcused('duha', excused('dhuhr'))).toBe(true)
    expect(isSunnahExcused('duha', excused('asr'))).toBe(false)
    expect(isSunnahExcused('witr', undefined)).toBe(false)
    expect(isSunnahExcused('witr', { isha: 'missed' })).toBe(false)
  })
})

describe('firstSunnahDay', () => {
  it('finds the earliest day with something ticked, ignoring the future, empty days and keys that are not days', () => {
    expect(firstSunnahDay({}, TODAY)).toBeNull()
    expect(firstSunnahDay({ '2026-10-20': ALL }, TODAY)).toBeNull()
    const sunnah = { '2026-09-01': {}, 'not-a-date': ALL, '2026-02-30': ALL, '2026-10-03': tick('duha'), [TODAY]: ALL }
    expect(firstSunnahDay(sunnah, TODAY)).toBe('2026-10-03')
  })
})

describe('sunnahCompletion', () => {
  it('has no rate before anything is ticked', () => {
    expect(sunnahCompletion({}, {}, TODAY, 7)).toEqual({ prayed: 0, due: 0, rate: null, byPrayer: zeros(), days: 0 })
    expect(sunnahCompletion({ '2026-10-12': ALL }, {}, TODAY, 7).rate).toBeNull()
  })

  it('measures today only by what is already done', () => {
    expect(sunnahCompletion({ [TODAY]: tick('beforeFajr', 'duha') }, {}, TODAY, 7)).toMatchObject({
      prayed: 2,
      due: 2,
      rate: 1,
      days: 1,
    })
  })

  it('measures from the first day anything was ticked, counting each past day’s eight', () => {
    const sunnah = {
      '2026-10-08': ALL,
      // 2026-10-09: nothing ticked.
      [YESTERDAY]: tick('witr'),
      [TODAY]: tick('beforeFajr', 'duha'),
    }
    const result = sunnahCompletion(sunnah, {}, TODAY, 30)
    expect(result).toMatchObject({ prayed: 11, due: 8 + 8 + 8 + 2, days: 4 })
    expect(result.rate).toBeCloseTo(11 / 26)
    expect(result.byPrayer).toEqual({
      beforeFajr: 2,
      duha: 2,
      beforeDhuhr: 1,
      afterDhuhr: 1,
      afterMaghrib: 1,
      afterIsha: 1,
      qiyam: 1,
      witr: 2,
    })
  })

  it('never counts excused sunnah prayers against the user', () => {
    const sunnah = { '2026-10-08': ALL, [YESTERDAY]: tick('beforeFajr') }
    const entries: LogEntries = { '2026-10-09': EXEMPT, [YESTERDAY]: excused('dhuhr', 'asr', 'maghrib', 'isha') }
    // 8th: 8 of 8. 9th: excused all day. 10th: Fajr's sunnah of the two still open (Duha goes with Dhuhr too).
    expect(sunnahCompletion(sunnah, entries, TODAY, 7)).toMatchObject({ prayed: 9, due: 8 + 0 + 1, days: 4 })
  })

  it('covers exactly the last N days, today included', () => {
    const sunnah = span('2026-10-01', YESTERDAY)
    // Seven days ending today: the 5th to the 11th, six of them full.
    expect(sunnahCompletion(sunnah, {}, TODAY, 7)).toMatchObject({ prayed: 6 * 8, due: 6 * 8, days: 7 })
    const withGap = { ...sunnah, '2026-10-05': {} }
    expect(sunnahCompletion(withGap, {}, TODAY, 7)).toMatchObject({ prayed: 5 * 8, due: 6 * 8 })
    const gapOutside = { ...sunnah, '2026-10-04': {} }
    expect(sunnahCompletion(gapOutside, {}, TODAY, 7)).toMatchObject({ prayed: 6 * 8, due: 6 * 8 })
  })

  it('spans month and year boundaries and ignores the future', () => {
    const sunnah = { ...span('2025-12-20', '2026-01-09', tick('witr')), '2026-01-11': ALL }
    // 30 days ending 10 January start on 12 December; the 10th itself has nothing ticked.
    expect(sunnahCompletion(sunnah, {}, '2026-01-10', 30)).toMatchObject({ prayed: 21, due: 21 * 8, days: 22 })
    expect(sunnahCompletion(sunnah, {}, '2026-01-10', 30).byPrayer.witr).toBe(21)
  })
})

describe('witrStreaks', () => {
  it('is zero for a new user', () => {
    expect(witrStreaks({}, {}, TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('counts today once Witr is prayed, and an unprayed today breaks nothing', () => {
    expect(witrStreaks({ [TODAY]: tick('witr') }, {}, TODAY)).toEqual({ current: 1, best: 1 })
    const upToYesterday = span('2026-10-08', YESTERDAY, tick('witr'))
    expect(witrStreaks(upToYesterday, {}, TODAY)).toEqual({ current: 3, best: 3 })
    expect(witrStreaks({ ...upToYesterday, [TODAY]: tick('duha') }, {}, TODAY)).toEqual({ current: 3, best: 3 })
  })

  it('ends at a past day without Witr, whatever else was prayed then', () => {
    const sunnah = { ...span('2026-10-01', TODAY, tick('witr')), '2026-10-07': tick('qiyam', 'afterIsha') }
    expect(witrStreaks(sunnah, {}, TODAY)).toEqual({ current: 4, best: 6 })
    const gap = { ...span('2026-10-01', '2026-10-05', tick('witr')), ...span('2026-10-07', TODAY, tick('witr')) }
    expect(witrStreaks(gap, {}, TODAY)).toEqual({ current: 5, best: 5 })
    expect(witrStreaks(span('2026-10-01', '2026-10-09', tick('witr')), {}, TODAY)).toEqual({ current: 0, best: 9 })
  })

  it('carries across days on which Isha was excused, without counting them', () => {
    const sunnah = { ...span('2026-10-01', '2026-10-03', tick('witr')), ...span('2026-10-08', TODAY, tick('witr')) }
    const entries: LogEntries = { '2026-10-04': EXEMPT, '2026-10-05': EXEMPT, '2026-10-06': excused('isha'), '2026-10-07': EXEMPT }
    expect(witrStreaks(sunnah, entries, TODAY)).toEqual({ current: 7, best: 7 })
    // An excused Fajr says nothing about the night.
    expect(witrStreaks(sunnah, { ...entries, '2026-10-06': excused('fajr') }, TODAY)).toEqual({ current: 4, best: 4 })
  })

  it('never counts excused days on their own', () => {
    const entries = Object.fromEntries(Object.keys(span('2026-10-01', TODAY)).map((key) => [key, EXEMPT])) as LogEntries
    expect(witrStreaks({ '2026-09-30': tick('duha') }, entries, TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('keeps last night open when given the day before as today, as between midnight and Fajr', () => {
    const sunnah = span('2026-10-07', '2026-10-09', tick('witr'))
    // 00:30 on the 11th: the night of the 10th is still under way, its Witr not yet prayed.
    expect(witrStreaks(sunnah, {}, TODAY)).toEqual({ current: 0, best: 3 })
    expect(witrStreaks(sunnah, {}, YESTERDAY)).toEqual({ current: 3, best: 3 })
  })

  it('ignores days after today and runs across the turn of the year', () => {
    expect(witrStreaks(span('2026-10-10', '2026-10-20', tick('witr')), {}, TODAY)).toEqual({ current: 2, best: 2 })
    expect(witrStreaks(span('2025-12-29', '2026-01-02', tick('witr')), {}, '2026-01-02')).toEqual({ current: 5, best: 5 })
  })
})

describe('rawatibStreaks', () => {
  it('counts only days with all twelve rak’ahs of the rawatib', () => {
    const sunnah = {
      ...span('2026-10-05', TODAY, RAWATIB_ONLY),
      '2026-10-08': tick('beforeFajr', 'beforeDhuhr', 'afterDhuhr', 'afterMaghrib'),
    }
    expect(rawatibStreaks(sunnah, {}, TODAY)).toEqual({ current: 3, best: 3 })
    expect(rawatibStreaks(span('2026-10-01', TODAY, tick('witr', 'duha', 'qiyam')), {}, TODAY)).toEqual({ current: 0, best: 0 })
  })

  it('accepts a day whose missing rawatib were excused', () => {
    const sunnah = { ...span('2026-10-08', TODAY, RAWATIB_ONLY), [YESTERDAY]: tick('afterMaghrib', 'afterIsha') }
    expect(rawatibStreaks(sunnah, { [YESTERDAY]: excused('fajr', 'dhuhr') }, TODAY)).toEqual({ current: 4, best: 4 })
    expect(rawatibStreaks(sunnah, {}, TODAY)).toEqual({ current: 1, best: 2 })
  })

  it('does not wait for an unfinished today', () => {
    const sunnah = { ...span('2026-10-08', YESTERDAY, RAWATIB_ONLY), [TODAY]: tick('beforeFajr') }
    expect(rawatibStreaks(sunnah, {}, TODAY)).toEqual({ current: 3, best: 3 })
  })
})

describe('sunnahStreaks', () => {
  it('works for any set of sunnah prayers, and is zero for none', () => {
    const sunnah = span('2026-10-09', TODAY, tick('duha', 'qiyam'))
    expect(sunnahStreaks(sunnah, {}, TODAY, ['duha', 'qiyam'])).toEqual({ current: 3, best: 3 })
    expect(sunnahStreaks(sunnah, {}, TODAY, ['duha', 'witr'])).toEqual({ current: 0, best: 0 })
    expect(sunnahStreaks(sunnah, {}, TODAY, [])).toEqual({ current: 0, best: 0 })
  })

  it('stays quick when a backup holds a day centuries back', () => {
    // A valid date key that only a hand-edited or corrupt backup would hold; loading keeps it.
    const sunnah = { '0100-01-01': tick('witr'), ...span('2026-10-08', TODAY, ALL) }
    const entries: LogEntries = { '0100-01-02': EXEMPT, '2026-10-01': excused('isha') }
    const started = performance.now()
    expect(witrStreaks(sunnah, entries, TODAY)).toEqual({ current: 4, best: 4 })
    expect(rawatibStreaks(sunnah, entries, TODAY)).toEqual({ current: 4, best: 4 })
    // Walking every day since then took most of a second.
    expect(performance.now() - started).toBeLessThan(100)
  })
})
