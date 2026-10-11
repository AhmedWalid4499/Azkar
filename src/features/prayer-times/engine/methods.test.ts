import { CalculationMethod } from 'adhan'
import { describe, expect, it } from 'vitest'
import { autoMethod, DEFAULT_METHOD, isMethodId, METHOD_IDS, methodAngles, resolveMethod } from './methods'
import type { MethodId } from './methods'

const inCountry = (countryCode: string | null, timeZone = 'Etc/Unknown') => autoMethod({ countryCode, timeZone })

describe('automatic method', () => {
  const expected: Array<[string, MethodId]> = [
    ['EG', 'Egyptian'],
    ['SA', 'UmmAlQura'],
    ['AE', 'Dubai'],
    ['KW', 'Kuwait'],
    ['QA', 'Qatar'],
    ['TR', 'Turkey'],
    ['IR', 'Tehran'],
    ['PK', 'Karachi'],
    ['IN', 'Karachi'],
    ['BD', 'Karachi'],
    ['AF', 'Karachi'],
    // Malaysia moved Subuh to 18° in 2019: the 20° Singapore preset no longer fits.
    ['MY', 'Karachi'],
    ['SG', 'Singapore'],
    ['ID', 'Singapore'],
    ['BN', 'Singapore'],
    ['US', 'NorthAmerica'],
    ['CA', 'NorthAmerica'],
    ['GB', 'MoonsightingCommittee'],
  ]

  it.each(expected)('%s -> %s', (country, method) => {
    expect(inCountry(country)).toBe(method)
    expect(inCountry(country.toLowerCase())).toBe(method)
  })

  it('falls back to the Muslim World League everywhere else', () => {
    for (const country of ['FR', 'DE', 'MA', 'JO', 'NG', 'AU', 'ZZ']) expect(inCountry(country)).toBe('MuslimWorldLeague')
    expect(DEFAULT_METHOD).toBe('MuslimWorldLeague')
    expect(autoMethod(null)).toBe('MuslimWorldLeague')
  })

  it('uses the time zone only when the country is unknown', () => {
    expect(inCountry(null, 'Africa/Cairo')).toBe('Egyptian')
    expect(inCountry(null, 'Asia/Riyadh')).toBe('UmmAlQura')
    expect(inCountry(null, 'Asia/Calcutta')).toBe('Karachi')
    expect(inCountry(null, 'Asia/Kolkata')).toBe('Karachi')
    expect(inCountry(null, 'Asia/Kuala_Lumpur')).toBe('Karachi')
    expect(inCountry(null, 'Asia/Jakarta')).toBe('Singapore')
    expect(inCountry(null, 'America/Toronto')).toBe('NorthAmerica')
    expect(inCountry(null, 'Europe/London')).toBe('MoonsightingCommittee')
    expect(inCountry(null, 'Europe/Paris')).toBe('MuslimWorldLeague')
    expect(inCountry('', 'Europe/Istanbul')).toBe('Turkey')
    // A known country wins even when the saved zone belongs to another one.
    expect(inCountry('FR', 'Africa/Cairo')).toBe('MuslimWorldLeague')
    expect(inCountry('TR', 'Africa/Cairo')).toBe('Turkey')
  })

  it('is not fooled by object property names in stored data', () => {
    for (const hostile of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(inCountry(hostile)).toBe('MuslimWorldLeague')
      expect(inCountry(null, hostile)).toBe('MuslimWorldLeague')
    }
    expect(autoMethod({ countryCode: 42 as unknown as string, timeZone: 'Africa/Cairo' })).toBe('Egyptian')
  })
})

describe('method list', () => {
  it('offers every preset adhan has, apart from the blank "Other"', () => {
    const presets = Object.keys(CalculationMethod).filter((name) => name !== 'Other')
    expect([...METHOD_IDS].sort()).toEqual(presets.sort())
  })

  it('recognises its own identifiers and nothing else', () => {
    for (const id of METHOD_IDS) expect(isMethodId(id)).toBe(true)
    for (const other of ['auto', 'Other', 'egyptian', '', null, undefined, 3, {}]) expect(isMethodId(other)).toBe(false)
  })

  it('keeps an explicit choice and resolves "auto"', () => {
    const egypt = { countryCode: 'EG', timeZone: 'Africa/Cairo' }
    expect(resolveMethod('Turkey', egypt)).toBe('Turkey')
    expect(resolveMethod('auto', egypt)).toBe('Egyptian')
    expect(resolveMethod('auto', null)).toBe('MuslimWorldLeague')
  })

  it('describes the twilight parameters of a preset', () => {
    expect(methodAngles('Egyptian')).toEqual({ fajrAngle: 19.5, ishaAngle: 17.5, ishaInterval: 0 })
    expect(methodAngles('UmmAlQura')).toMatchObject({ fajrAngle: 18.5, ishaInterval: 90 })
    expect(methodAngles('Karachi')).toMatchObject({ fajrAngle: 18, ishaAngle: 18 })
  })
})
