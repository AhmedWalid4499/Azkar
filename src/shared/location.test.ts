import { describe, expect, it } from 'vitest'
import { deviceTimeZone } from './date'
import { sanitizeLocation } from './location'

const cairo = {
  latitude: 30.0444,
  longitude: 31.2357,
  timeZone: 'Africa/Cairo',
  label: 'Cairo, Egypt',
  countryCode: 'EG',
  source: 'manual',
  updatedAt: 1_790_000_000_000,
}

describe('sanitizeLocation', () => {
  it('keeps a well-formed location as it is', () => {
    expect(sanitizeLocation(cairo)).toEqual(cairo)
  })

  it('drops anything without usable coordinates', () => {
    expect(sanitizeLocation(null)).toBeNull()
    expect(sanitizeLocation('Cairo')).toBeNull()
    expect(sanitizeLocation({ ...cairo, latitude: 91 })).toBeNull()
    expect(sanitizeLocation({ ...cairo, longitude: Number.NaN })).toBeNull()
    expect(sanitizeLocation({ ...cairo, latitude: '30' })).toBeNull()
  })

  it('replaces a time zone Intl would reject, which would otherwise crash every page', () => {
    expect(sanitizeLocation({ ...cairo, timeZone: 'Mars/Olympus' })?.timeZone).toBe(deviceTimeZone())
    expect(sanitizeLocation({ ...cairo, timeZone: 42 })?.timeZone).toBe(deviceTimeZone())
  })

  it('repairs the lesser fields', () => {
    const repaired = sanitizeLocation({ ...cairo, label: 7, countryCode: 'egy', source: 'satellite', updatedAt: -1 })
    expect(repaired).toMatchObject({ label: '', countryCode: null, source: 'manual', updatedAt: 0 })
    expect(sanitizeLocation({ ...cairo, countryCode: 'eg' })?.countryCode).toBe('EG')
  })

  it('keeps an empty label, which means no name was resolved, rather than inventing one', () => {
    const unnamed = { ...cairo, label: '', countryCode: null, source: 'gps' }
    expect(sanitizeLocation(unnamed)).toEqual(unnamed)
    // A missing label is the same thing; coordinates are formatted where they are shown, never stored.
    const { label: _label, ...withoutLabel } = unnamed
    expect(sanitizeLocation(withoutLabel)).toEqual(unnamed)
  })

  it('keeps only the fields it knows', () => {
    const stored = { ...cairo, labels: { en: 'Cairo', ar: 'القاهرة' }, accuracy: 12, setLocation: 'not a function' }
    expect(sanitizeLocation(stored)).toEqual(cairo)
  })
})
