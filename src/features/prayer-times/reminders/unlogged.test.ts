import { describe, expect, it } from 'vitest'
import type { PrayerDay } from '../../../shared/types'
import { computePrayerDay, DEFAULT_CALCULATION } from '../engine/compute'
import type { Place } from '../engine/compute'
import { toPlace } from '../location/place'
import { CAIRO, TROMSO, zonedInstant } from '../test-helpers'
import { prayerDeadline, unloggedEntries } from './unlogged'
import type { UnloggedChoices } from './unlogged'

const cairo = toPlace(CAIRO) as Place
const tromso = toPlace(TROMSO) as Place
const dayIn = (place: Place) => (dateKey: string) => computePrayerDay(dateKey, place, DEFAULT_CALCULATION)
const at = (dateKey: string, clock: string, zone = 'Africa/Cairo') => zonedInstant(dateKey, clock, zone)

const NOTHING_LOGGED = () => false
const choices = (patch: Partial<UnloggedChoices> = {}): UnloggedChoices => ({
  leadMinutes: 15,
  ishaEnds: 'middle',
  isLogged: NOTHING_LOGGED,
  ...patch,
})

// Cairo, 12 October 2026: Fajr 05:28, sunrise 06:55, Dhuhr 12:43, Asr 15:59, Maghrib 18:28, Isha 19:45.
// The 13th: Fajr 05:29.
const october12 = dayIn(cairo)('2026-10-12')
const october13 = dayIn(cairo)('2026-10-13')

describe('prayerDeadline', () => {
  it('ends Fajr at sunrise, Dhuhr at Asr, Asr at Maghrib and Maghrib at Isha', () => {
    const end = (prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib') => prayerDeadline(prayer, october12, october13, 'middle')
    expect(end('fajr')).toEqual({ endsAt: at('2026-10-12', '06:55'), preferred: false })
    expect(end('dhuhr')).toEqual({ endsAt: at('2026-10-12', '15:59'), preferred: false })
    expect(end('asr')).toEqual({ endsAt: at('2026-10-12', '18:28'), preferred: false })
    expect(end('maghrib')).toEqual({ endsAt: at('2026-10-12', '19:45'), preferred: false })
  })

  it('ends Isha’s preferred time at the middle of the night between Maghrib and the next Fajr, by default', () => {
    // 18:28 to 05:29 is 11 hours and 1 minute: the middle is 23:58:30, and the minute it falls in is 23:58.
    expect(prayerDeadline('isha', october12, october13, 'middle')).toEqual({ endsAt: at('2026-10-12', '23:58'), preferred: true })
  })

  it('or Isha’s whole time at the next Fajr, when that is the choice', () => {
    expect(prayerDeadline('isha', october12, october13, 'fajr')).toEqual({ endsAt: at('2026-10-13', '05:29'), preferred: false })
  })

  it('cannot tell where Isha ends without the next day', () => {
    expect(prayerDeadline('isha', october12, undefined, 'middle')).toBeNull()
    expect(prayerDeadline('isha', october12, undefined, 'fajr')).toBeNull()
    // The other prayers end on their own day.
    expect(prayerDeadline('maghrib', october12, undefined, 'middle')).not.toBeNull()
  })

  it('cannot tell where a time ends when the time ending it does not exist that day', () => {
    // Tromsø at midwinter: no sunrise, no Asr, no Maghrib.
    const polarNight = dayIn(tromso)('2026-12-21')
    const next = dayIn(tromso)('2026-12-22')
    expect(prayerDeadline('fajr', polarNight, next, 'middle')).toBeNull()
    expect(prayerDeadline('dhuhr', polarNight, next, 'middle')).toBeNull()
    expect(prayerDeadline('isha', polarNight, next, 'middle')).toBeNull()
    // The next Fajr exists, so Isha can still end there.
    expect(prayerDeadline('isha', polarNight, next, 'fajr')).toEqual({
      endsAt: zonedInstant('2026-12-22', '06:29', 'Europe/Oslo'),
      preferred: false,
    })
  })
})

describe('unloggedEntries', () => {
  it('reminds of each of the five prayers fifteen minutes before its time ends', () => {
    const entries = unloggedEntries([october12, october13], choices())
    const ofThe12th = entries.filter((entry) => entry.dateKey === '2026-10-12')
    expect(ofThe12th).toEqual([
      { kind: 'unlogged', prayer: 'fajr', dateKey: '2026-10-12', at: at('2026-10-12', '06:40'), endsAt: at('2026-10-12', '06:55'), preferred: false, key: '2026-10-12-fajr-unlogged' },
      { kind: 'unlogged', prayer: 'dhuhr', dateKey: '2026-10-12', at: at('2026-10-12', '15:44'), endsAt: at('2026-10-12', '15:59'), preferred: false, key: '2026-10-12-dhuhr-unlogged' },
      { kind: 'unlogged', prayer: 'asr', dateKey: '2026-10-12', at: at('2026-10-12', '18:13'), endsAt: at('2026-10-12', '18:28'), preferred: false, key: '2026-10-12-asr-unlogged' },
      { kind: 'unlogged', prayer: 'maghrib', dateKey: '2026-10-12', at: at('2026-10-12', '19:30'), endsAt: at('2026-10-12', '19:45'), preferred: false, key: '2026-10-12-maghrib-unlogged' },
      { kind: 'unlogged', prayer: 'isha', dateKey: '2026-10-12', at: at('2026-10-12', '23:43'), endsAt: at('2026-10-12', '23:58'), preferred: true, key: '2026-10-12-isha-unlogged' },
    ])
    // The 13th's Isha has no next day here to end on.
    expect(entries.map((entry) => entry.key)).not.toContain('2026-10-13-isha-unlogged')
    expect(entries.filter((entry) => entry.dateKey === '2026-10-13')).toHaveLength(4)
  })

  it('reminds of Isha before the next Fajr instead, when that is the choice', () => {
    const isha = unloggedEntries([october12, october13], choices({ ishaEnds: 'fajr' })).find((entry) => entry.key === '2026-10-12-isha-unlogged')
    expect(isha).toMatchObject({ at: at('2026-10-13', '05:14'), endsAt: at('2026-10-13', '05:29'), preferred: false })
  })

  it('comes as long before the end as chosen', () => {
    for (const [leadMinutes, clock] of [[10, '18:18'], [30, '17:58'], [45, '17:43'], [60, '17:28']] as const) {
      const asr = unloggedEntries([october12], choices({ leadMinutes })).find((entry) => entry.prayer === 'asr')
      expect(asr?.at).toEqual(at('2026-10-12', clock))
    }
  })

  it('never reminds of a prayer already logged, whatever its status', () => {
    const logged = new Set(['2026-10-12-asr', '2026-10-12-isha'])
    const entries = unloggedEntries([october12, october13], choices({ isLogged: (dateKey, prayer) => logged.has(`${dateKey}-${prayer}`) }))
    const keys = entries.map((entry) => entry.key)
    expect(keys).not.toContain('2026-10-12-asr-unlogged')
    expect(keys).not.toContain('2026-10-12-isha-unlogged')
    // The same prayers of another day are still reminded of.
    expect(keys).toContain('2026-10-13-asr-unlogged')
    expect(keys).toContain('2026-10-12-maghrib-unlogged')
  })

  it('leaves out a reminder that would come before the prayer has begun', () => {
    // Isha thirty minutes after Maghrib: forty-five minutes before its end is before Maghrib began.
    const short: PrayerDay = { ...october12, times: { ...october12.times, isha: at('2026-10-12', '18:58') } }
    const keys = (leadMinutes: number) => unloggedEntries([short], choices({ leadMinutes })).map((entry) => entry.key)
    expect(keys(45)).not.toContain('2026-10-12-maghrib-unlogged')
    expect(keys(30)).not.toContain('2026-10-12-maghrib-unlogged')
    expect(keys(15)).toContain('2026-10-12-maghrib-unlogged')
  })

  it('skips the prayers of a polar night whose time or end does not exist', () => {
    const days = [dayIn(tromso)('2026-12-21'), dayIn(tromso)('2026-12-22')]
    // Fajr ends at a sunrise that never comes, Dhuhr at an Asr that does not exist, Asr and Maghrib
    // do not exist, and Isha's middle of the night needs a Maghrib.
    expect(unloggedEntries(days, choices())).toEqual([])
    // Ended at the next Fajr, only the first day's Isha has an end here.
    expect(unloggedEntries(days, choices({ ishaEnds: 'fajr' }))).toEqual([
      expect.objectContaining({ key: '2026-12-21-isha-unlogged', at: zonedInstant('2026-12-22', '06:14', 'Europe/Oslo') }),
    ])
  })

  it('skips the prayers of a midnight-sun day that have no time, keeping Dhuhr, which ends at Asr', () => {
    expect(unloggedEntries([dayIn(tromso)('2026-06-21'), dayIn(tromso)('2026-06-22')], choices())).toEqual([
      expect.objectContaining({ key: '2026-06-21-dhuhr-unlogged', at: zonedInstant('2026-06-21', '17:43', 'Europe/Oslo') }),
      expect.objectContaining({ key: '2026-06-22-dhuhr-unlogged', at: zonedInstant('2026-06-22', '17:43', 'Europe/Oslo') }),
    ])
  })

  it('skips a day with an invalid time without throwing', () => {
    const broken: PrayerDay = { ...october12, times: { ...october12.times, sunrise: new Date(Number.NaN), asr: new Date(Number.NaN) } }
    const prayers = unloggedEntries([broken, october13], choices()).filter((entry) => entry.dateKey === '2026-10-12').map((entry) => entry.prayer)
    // Fajr has no sunrise to end at, Dhuhr no Asr, and Asr no time of its own.
    expect(prayers).toEqual(['maghrib', 'isha'])
  })
})
