import { CalculationMethod } from 'adhan'
import { describe, expect, it } from 'vitest'
import { autoMadhab, autoMethod, DEFAULT_METHOD, isMethodId, METHOD_IDS, methodAngles, resolveMadhab, resolveMethod } from './methods'
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

  // A fix taken offline has no country: the method must not fall back to the default in a country's lesser zones.
  it.each([
    // The spelling Chrome and Safari report, then the current one.
    ['America/Indianapolis', 'NorthAmerica'],
    ['America/Indiana/Indianapolis', 'NorthAmerica'],
    ['America/Indiana/Knox', 'NorthAmerica'],
    ['America/Louisville', 'NorthAmerica'],
    ['America/Kentucky/Louisville', 'NorthAmerica'],
    ['America/Kentucky/Monticello', 'NorthAmerica'],
    ['America/North_Dakota/Beulah', 'NorthAmerica'],
    ['America/Boise', 'NorthAmerica'],
    ['America/Menominee', 'NorthAmerica'],
    ['America/Juneau', 'NorthAmerica'],
    ['America/Sitka', 'NorthAmerica'],
    ['America/Metlakatla', 'NorthAmerica'],
    ['America/Yakutat', 'NorthAmerica'],
    ['America/Nome', 'NorthAmerica'],
    ['America/Adak', 'NorthAmerica'],
    ['America/Detroit', 'NorthAmerica'],
    ['America/New_York', 'NorthAmerica'],
    ['Pacific/Honolulu', 'NorthAmerica'],
    ['US/Eastern', 'NorthAmerica'],
    ['America/Moncton', 'NorthAmerica'],
    ['America/Glace_Bay', 'NorthAmerica'],
    ['America/Goose_Bay', 'NorthAmerica'],
    ['America/Blanc-Sablon', 'NorthAmerica'],
    ['America/Iqaluit', 'NorthAmerica'],
    ['America/Atikokan', 'NorthAmerica'],
    ['America/Coral_Harbour', 'NorthAmerica'],
    ['America/Thunder_Bay', 'NorthAmerica'],
    ['America/Nipigon', 'NorthAmerica'],
    ['America/Rankin_Inlet', 'NorthAmerica'],
    ['America/Resolute', 'NorthAmerica'],
    ['America/Swift_Current', 'NorthAmerica'],
    ['America/Cambridge_Bay', 'NorthAmerica'],
    ['America/Yellowknife', 'NorthAmerica'],
    ['America/Inuvik', 'NorthAmerica'],
    ['America/Creston', 'NorthAmerica'],
    ['America/Dawson_Creek', 'NorthAmerica'],
    ['America/Fort_Nelson', 'NorthAmerica'],
    ['America/Whitehorse', 'NorthAmerica'],
    ['America/Dawson', 'NorthAmerica'],
    ['Canada/Pacific', 'NorthAmerica'],
    ['Asia/Makassar', 'Singapore'],
    ['Asia/Jayapura', 'Singapore'],
    ['Asia/Kuching', 'Karachi'],
    ['Europe/Belfast', 'MoonsightingCommittee'],
  ] as const)('knows %s without a country', (timeZone, method) => {
    expect(inCountry(null, timeZone)).toBe(method)
  })

  it('does not take a neighbour’s zone, or a made-up one under a known prefix’s parent, for a listed country', () => {
    for (const timeZone of ['America/Mexico_City', 'America/Tijuana', 'America/Nuuk', 'America/Havana', 'America/Indiana', 'America/', 'USA/Eastern']) {
      expect(inCountry(null, timeZone), timeZone).toBe('MuslimWorldLeague')
    }
  })

  it('is not fooled by object property names in stored data', () => {
    for (const hostile of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(inCountry(hostile)).toBe('MuslimWorldLeague')
      expect(inCountry(null, hostile)).toBe('MuslimWorldLeague')
    }
    expect(autoMethod({ countryCode: 42 as unknown as string, timeZone: 'Africa/Cairo' })).toBe('Egyptian')
  })
})

describe('automatic Asr school', () => {
  const school = (countryCode: string | null, timeZone = 'Etc/Unknown') => autoMadhab({ countryCode, timeZone })

  it('is Hanafi in Pakistan, India, Bangladesh and Afghanistan', () => {
    for (const country of ['PK', 'IN', 'BD', 'AF']) {
      expect(school(country), country).toBe('hanafi')
      expect(school(country.toLowerCase()), country).toBe('hanafi')
    }
  })

  it('is the standard one everywhere else, Turkey included', () => {
    // Diyanet's timetable uses the first-shadow Asr although the country is largely Hanafi.
    for (const country of ['TR', 'EG', 'SA', 'MY', 'ID', 'GB', 'US', 'FR', 'IR', 'ZZ']) expect(school(country), country).toBe('shafi')
    expect(autoMadhab(null)).toBe('shafi')
  })

  it('falls back to the time zone exactly as the method does', () => {
    expect(school(null, 'Asia/Karachi')).toBe('hanafi')
    expect(school(null, 'Asia/Kolkata')).toBe('hanafi')
    expect(school(null, 'Asia/Calcutta')).toBe('hanafi')
    expect(school(null, 'Asia/Dhaka')).toBe('hanafi')
    expect(school('', 'Asia/Kabul')).toBe('hanafi')
    expect(school(null, 'Europe/Istanbul')).toBe('shafi')
    expect(school(null, 'Asia/Kuala_Lumpur')).toBe('shafi')
    expect(school(null, 'Europe/Paris')).toBe('shafi')
    // A known country wins over the zone, both ways.
    expect(school('FR', 'Asia/Karachi')).toBe('shafi')
    expect(school('PK', 'Europe/Paris')).toBe('hanafi')
    for (const hostile of ['constructor', '__proto__', 'toString']) {
      expect(school(hostile)).toBe('shafi')
      expect(school(null, hostile)).toBe('shafi')
    }
  })

  it('keeps an explicit choice and resolves "auto"', () => {
    const pakistan = { countryCode: 'PK', timeZone: 'Asia/Karachi' }
    expect(resolveMadhab('shafi', pakistan)).toBe('shafi')
    expect(resolveMadhab('hanafi', { countryCode: 'EG', timeZone: 'Africa/Cairo' })).toBe('hanafi')
    expect(resolveMadhab('auto', pakistan)).toBe('hanafi')
    expect(resolveMadhab('auto', null)).toBe('shafi')
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
