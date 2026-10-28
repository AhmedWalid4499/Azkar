import { describe, expect, it } from 'vitest'
import { ramadanTimes } from './ramadanTimes'
import { fakePrayerDay } from './test-utils'

const TODAY = '2026-03-01'
const TOMORROW = '2026-03-02'
const todayTimes = fakePrayerDay(TODAY, { fajr: '05:00', maghrib: '18:00' }, 'UTC')
const tomorrowTimes = fakePrayerDay(TOMORROW, { fajr: '04:59' }, 'UTC')
const at = (iso: string) => new Date(`${iso}Z`)

function next(now: string, options: Partial<Parameters<typeof ramadanTimes>[1]> = {}) {
  return ramadanTimes(at(now), { today: TODAY, todayTimes, tomorrow: TOMORROW, tomorrowTimes, tomorrowIsRamadan: true, ...options })
    .next
}

describe('ramadanTimes', () => {
  it('gives today’s end of suhoor and iftar', () => {
    const times = ramadanTimes(at('2026-03-01T09:00'), {
      today: TODAY,
      todayTimes,
      tomorrow: TOMORROW,
      tomorrowTimes,
      tomorrowIsRamadan: true,
    })
    expect(times.suhoorEnds).toEqual(at('2026-03-01T05:00'))
    expect(times.iftar).toEqual(at('2026-03-01T18:00'))
  })

  it('picks the next of suhoor, iftar and tomorrow’s suhoor', () => {
    expect(next('2026-03-01T00:30')).toEqual({ kind: 'suhoor', at: at('2026-03-01T05:00'), tomorrow: false })
    expect(next('2026-03-01T05:00')).toEqual({ kind: 'iftar', at: at('2026-03-01T18:00'), tomorrow: false })
    expect(next('2026-03-01T18:00')).toEqual({ kind: 'suhoor', at: at('2026-03-02T04:59'), tomorrow: true })
  })

  it('has nothing next after the last iftar of the month', () => {
    expect(next('2026-03-01T18:30', { tomorrowIsRamadan: false })).toBeNull()
  })

  it('skips a time that does not exist, and a timetable of another day', () => {
    const polar = fakePrayerDay(TODAY, { fajr: null, maghrib: '18:00' }, 'UTC')
    expect(next('2026-03-01T01:00', { todayTimes: polar })).toMatchObject({ kind: 'iftar' })
    expect(next('2026-03-01T01:00', { todayTimes: tomorrowTimes })).toMatchObject({ kind: 'suhoor', tomorrow: true })
    expect(next('2026-03-01T19:00', { tomorrowTimes: null })).toBeNull()
  })
})
