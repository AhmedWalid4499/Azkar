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
 * Fallback for a location saved without a country (GPS while offline): every
 * IANA zone of the countries above, under the names browsers report. Chrome and
 * Safari still give the older spelling of several (Asia/Calcutta,
 * America/Indianapolis, America/Coral_Harbour), so both are listed.
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
  'Europe/Belfast': 'GB',

  'America/New_York': 'US',
  'America/Detroit': 'US',
  'America/Louisville': 'US',
  'America/Indianapolis': 'US',
  'America/Fort_Wayne': 'US',
  'America/Knox_IN': 'US',
  'America/Chicago': 'US',
  'America/Menominee': 'US',
  'America/Denver': 'US',
  'America/Shiprock': 'US',
  'America/Boise': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Juneau': 'US',
  'America/Sitka': 'US',
  'America/Metlakatla': 'US',
  'America/Yakutat': 'US',
  'America/Nome': 'US',
  'America/Adak': 'US',
  'America/Atka': 'US',
  'Pacific/Honolulu': 'US',

  'America/St_Johns': 'CA',
  'America/Halifax': 'CA',
  'America/Glace_Bay': 'CA',
  'America/Moncton': 'CA',
  'America/Goose_Bay': 'CA',
  'America/Blanc-Sablon': 'CA',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Nipigon': 'CA',
  'America/Thunder_Bay': 'CA',
  'America/Iqaluit': 'CA',
  'America/Pangnirtung': 'CA',
  'America/Atikokan': 'CA',
  'America/Coral_Harbour': 'CA',
  'America/Winnipeg': 'CA',
  'America/Rainy_River': 'CA',
  'America/Resolute': 'CA',
  'America/Rankin_Inlet': 'CA',
  'America/Regina': 'CA',
  'America/Swift_Current': 'CA',
  'America/Edmonton': 'CA',
  'America/Cambridge_Bay': 'CA',
  'America/Yellowknife': 'CA',
  'America/Inuvik': 'CA',
  'America/Creston': 'CA',
  'America/Dawson_Creek': 'CA',
  'America/Fort_Nelson': 'CA',
  'America/Whitehorse': 'CA',
  'America/Dawson': 'CA',
  'America/Vancouver': 'CA',
}

/** Zones named by region under a common prefix: the counties of Indiana, Kentucky and North Dakota, and the old `US/` and `Canada/` aliases. */
const ZONE_PREFIX_COUNTRY: ReadonlyArray<readonly [prefix: string, country: string]> = [
  ['America/Indiana/', 'US'],
  ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'],
  ['US/', 'US'],
  ['Canada/', 'CA'],
]

export interface MethodContext {
  countryCode: string | null
  timeZone: string
}

// Both tables are indexed with strings that came from a geocoder or a backup file.
function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

function countryOfZone(timeZone: unknown): string | undefined {
  if (typeof timeZone !== 'string') return undefined
  return lookup(ZONE_COUNTRY, timeZone) ?? ZONE_PREFIX_COUNTRY.find(([prefix]) => timeZone.startsWith(prefix))?.[1]
}

/** The country a place is in: the one saved with it, otherwise the one its time zone belongs to. */
function countryOf(place: MethodContext): string | undefined {
  return typeof place.countryCode === 'string' && place.countryCode !== ''
    ? place.countryCode.toUpperCase()
    : countryOfZone(place.timeZone)
}

/** The preset "Automatic" stands for at a place. */
export function autoMethod(place: MethodContext | null): MethodId {
  const country = place ? countryOf(place) : undefined
  return (country !== undefined && lookup(COUNTRY_METHOD, country)) || DEFAULT_METHOD
}

export function resolveMethod(setting: MethodSetting, place: MethodContext | null): MethodId {
  return setting === 'auto' ? autoMethod(place) : setting
}

/** adhan's own identifiers. `shafi` is the Asr of the Shafi'i, Maliki and Hanbali schools alike. */
export type MadhabId = 'shafi' | 'hanafi'
export type MadhabSetting = 'auto' | MadhabId

export const DEFAULT_MADHAB: MadhabId = 'shafi'

/**
 * Where nearly every mosque keeps the later, Hanafi Asr. Turkey is left out on
 * purpose: Diyanet's timetable uses the first-shadow Asr.
 */
const HANAFI_COUNTRIES: ReadonlySet<string> = new Set(['PK', 'IN', 'BD', 'AF'])

/** The Asr school "Automatic" stands for at a place, found the same way as its method. */
export function autoMadhab(place: MethodContext | null): MadhabId {
  const country = place ? countryOf(place) : undefined
  return country !== undefined && HANAFI_COUNTRIES.has(country) ? 'hanafi' : DEFAULT_MADHAB
}

export function resolveMadhab(setting: MadhabSetting, place: MethodContext | null): MadhabId {
  return setting === 'auto' ? autoMadhab(place) : setting
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
