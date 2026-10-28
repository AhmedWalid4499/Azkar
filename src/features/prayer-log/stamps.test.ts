import { describe, expect, it } from 'vitest'
import { deviceTimeZone } from '../../shared/date'
import { isoMinute, stampParts, usableTimeZone } from './stamps'

const plain = (text: string | null) => text?.replace(/\s+/g, ' ') ?? null
const parts = (at: string, dateKey: string, locale = 'en', timeZone = 'Asia/Riyadh', hour12 = true) => {
  const { time, date } = stampParts(Date.parse(at), dateKey, { locale, timeZone, hour12 })
  return { time: plain(time), date: plain(date) }
}

describe('stampParts', () => {
  it('gives the time alone on the day the record is filed under', () => {
    expect(parts('2026-10-09T02:12:00Z', '2026-10-09')).toEqual({ time: '5:12 AM', date: null })
    expect(parts('2026-10-09T02:12:00Z', '2026-10-09', 'en', 'Asia/Riyadh', false)).toEqual({ time: '05:12', date: null })
  })

  it('adds the date when it fell on another day in the zone', () => {
    // 22:30 in London is 1:30 the next morning in Riyadh.
    expect(parts('2026-10-09T22:30:00Z', '2026-10-09')).toEqual({ time: '1:30 AM', date: 'Oct 10' })
    expect(parts('2026-10-09T22:30:00Z', '2026-10-09', 'en', 'Europe/London')).toEqual({ time: '11:30 PM', date: null })
  })

  it('adds the year as well when that other day is in another year', () => {
    expect(parts('2026-01-01T09:00:00Z', '2025-12-31')).toEqual({ time: '12:00 PM', date: 'Jan 1, 2026' })
  })

  it('writes Arabic with the chosen digits', () => {
    expect(parts('2026-10-09T22:30:00Z', '2026-10-09', 'ar-u-nu-arab')).toEqual({ time: '١:٣٠ ص', date: '١٠ أكتوبر' })
    expect(parts('2026-10-09T22:30:00Z', '2026-10-09', 'ar-u-nu-latn')).toEqual({ time: '1:30 ص', date: '10 أكتوبر' })
  })
})

describe('isoMinute', () => {
  it('writes an instant as YYYY-MM-DD HH:mm on the wall clock of the zone', () => {
    const at = Date.parse('2026-10-09T21:05:00Z')
    expect(isoMinute(at, 'UTC')).toBe('2026-10-09 21:05')
    expect(isoMinute(at, 'Asia/Riyadh')).toBe('2026-10-10 00:05')
    expect(isoMinute(at, 'America/Los_Angeles')).toBe('2026-10-09 14:05')
    expect(isoMinute(Date.parse('2026-10-10T00:00:00Z'), 'UTC')).toBe('2026-10-10 00:00')
  })
})

describe('usableTimeZone', () => {
  it('keeps a real zone and replaces one Intl cannot use with the device’s', () => {
    expect(usableTimeZone('Asia/Riyadh')).toBe('Asia/Riyadh')
    expect(usableTimeZone('Mars/Olympus_Mons')).toBe(deviceTimeZone())
  })
})
