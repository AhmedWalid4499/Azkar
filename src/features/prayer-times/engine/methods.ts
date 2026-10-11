import { CalculationMethod } from 'adhan'

/**
 * Every preset adhan ships, except `Other` (0°/0°, a blank for custom angles
 * that would produce nonsense on its own).
 */
export const METHOD_IDS = [
  'MuslimWorldLeague',
  'Egyptian',
  'UmmAlQura',
  'Dubai',
  'Kuwait',
  'Qatar',
  'Turkey',
  'Tehran',
  'Karachi',
  'Singapore',
  'NorthAmerica',
  'MoonsightingCommittee',
] as const satisfies ReadonlyArray<keyof typeof CalculationMethod>

export type MethodId = (typeof METHOD_IDS)[number]
export type MethodSetting = 'auto' | MethodId

export const DEFAULT_METHOD: MethodId = 'MuslimWorldLeague'

export function isMethodId(value: unknown): value is MethodId {
  return typeof value === 'string' && (METHOD_IDS as readonly string[]).includes(value)
}

/**
 * Country (ISO 3166-1 alpha-2) -> the adhan preset closest to the timetable its
 * religious authority publishes. Only countries with a clear answer are listed;
 * everywhere else gets the Muslim World League, the most widely used default.
 *
 * - EG  Egyptian General Authority of Survey (19.5° / 17.5°).
 * - SA  Umm al-Qura calendar (18.5°, Isha 90 minutes after Maghrib).
 * - AE  adhan's `Dubai` preset; within a minute of the timetable UAE newspapers print.
 * - KW, QA  the national presets of the same name.
 * - TR  Diyanet; adhan's approximation is within two minutes of the official Istanbul times.
 * - IR  Institute of Geophysics, University of Tehran.
 * - PK, IN, BD, AF  University of Islamic Sciences, Karachi (18° / 18°).
 * - MY  JAKIM moved Subuh from 20° to 18° in late 2019, so the 18° / 18° Karachi
 *       preset matches e-solat.gov.my to two minutes; `Singapore` (20°) would run
 *       Fajr about ten minutes early.
 * - SG, ID, BN  MUIS / Kemenag / MABIMS 20° / 18°. Kemenag adds a 2-3 minute
 *       precaution to each time that this preset does not include.
 * - US, CA  ISNA / Fiqh Council of North America (15° / 15°).
 * - GB  no single authority; adhan recommends the Moonsighting Committee method.
 */
const COUNTRY_METHOD: Readonly<Record<string, MethodId>> = {
  EG: 'Egyptian',
  SA: 'UmmAlQura',
  AE: 'Dubai',
  KW: 'Kuwait',
  QA: 'Qatar',
  TR: 'Turkey',
  IR: 'Tehran',
  PK: 'Karachi',
  IN: 'Karachi',
  BD: 'Karachi',
  AF: 'Karachi',
  MY: 'Karachi',
  SG: 'Singapore',
  ID: 'Singapore',
  BN: 'Singapore',
  US: 'NorthAmerica',
  CA: 'NorthAmerica',
  GB: 'MoonsightingCommittee',
}

/**
 * Fallback for a location saved without a country (GPS while offline): the
 * main IANA zones of the countries above, including the older aliases some
 * browsers still report.
 */
const ZONE_COUNTRY: Readonly<Record<string, string>> = {
  'Africa/Cairo': 'EG',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA',
  'Europe/Istanbul': 'TR',
  'Asia/Istanbul': 'TR',
  'Asia/Tehran': 'IR',
  'Asia/Karachi': 'PK',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD',
  'Asia/Dacca': 'BD',
  'Asia/Kabul': 'AF',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Singapore': 'SG',
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Ujung_Pandang': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Brunei': 'BN',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Detroit': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Winnipeg': 'CA',
  'America/Regina': 'CA',
  'America/Edmonton': 'CA',
  'America/Vancouver': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
}

export interface MethodContext {
  countryCode: string | null
  timeZone: string
}

// Both tables are indexed with strings that came from a geocoder or a backup file.
function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

/** The preset "Automatic" stands for at a place. */
export function autoMethod(place: MethodContext | null): MethodId {
  if (!place) return DEFAULT_METHOD
  const country =
    typeof place.countryCode === 'string' && place.countryCode !== ''
      ? place.countryCode.toUpperCase()
      : lookup(ZONE_COUNTRY, place.timeZone)
  return (country !== undefined && lookup(COUNTRY_METHOD, country)) || DEFAULT_METHOD
}

export function resolveMethod(setting: MethodSetting, place: MethodContext | null): MethodId {
  return setting === 'auto' ? autoMethod(place) : setting
}

export interface MethodAngles {
  fajrAngle: number
  ishaAngle: number
  /** Minutes after Maghrib; when positive it replaces `ishaAngle`. */
  ishaInterval: number
}

/** The twilight parameters behind a preset, for explaining it in settings. */
export function methodAngles(method: MethodId): MethodAngles {
  const { fajrAngle, ishaAngle, ishaInterval } = CalculationMethod[method]()
  return { fajrAngle, ishaAngle, ishaInterval }
}
