// The places, days and settings the native engine is checked against.
import type { Adjustments, CalculationConfig } from '../../../src/features/prayer-times/engine/compute'
import { HIGH_LATITUDE_RULES, NO_ADJUSTMENTS } from '../../../src/features/prayer-times/engine/compute'
import { METHOD_IDS } from '../../../src/features/prayer-times/engine/methods'

export interface GridPlace {
  name: string
  latitude: number
  longitude: number
  timeZone: string
  /** `null` exercises the time-zone fallback of the automatic settings. */
  countryCode: string | null
}

const place = (name: string, latitude: number, longitude: number, timeZone: string, countryCode: string | null): GridPlace => ({
  name,
  latitude,
  longitude,
  timeZone,
  countryCode,
})

export const PLACES: GridPlace[] = [
  // The reference timetables' cities.
  place('Makkah', 21.4225, 39.8262, 'Asia/Riyadh', 'SA'),
  place('Cairo', 30.0444, 31.2357, 'Africa/Cairo', 'EG'),
  place('Istanbul', 41.0082, 28.9784, 'Europe/Istanbul', 'TR'),
  place('Karachi', 24.8607, 67.0011, 'Asia/Karachi', 'PK'),
  place('Jakarta', -6.2088, 106.8456, 'Asia/Jakarta', 'ID'),
  place('London', 51.5074, -0.1278, 'Europe/London', 'GB'),
  place('New York', 40.7128, -74.006, 'America/New_York', 'US'),
  place('Sydney', -33.8688, 151.2093, 'Australia/Sydney', 'AU'),
  place('Cape Town', -33.9249, 18.4241, 'Africa/Johannesburg', 'ZA'),
  place('Kuwait City', 29.3759, 47.9774, 'Asia/Kuwait', 'KW'),
  place('Doha', 25.2854, 51.531, 'Asia/Qatar', 'QA'),
  place('Tehran', 35.6892, 51.389, 'Asia/Tehran', 'IR'),
  place('Singapore', 1.3521, 103.8198, 'Asia/Singapore', 'SG'),
  place('Toronto', 43.6532, -79.3832, 'America/Toronto', 'CA'),
  place('Auckland', -36.8485, 174.7633, 'Pacific/Auckland', 'NZ'),
  place('Dubai', 25.2048, 55.2708, 'Asia/Dubai', 'AE'),
  place('Kuala Lumpur', 3.139, 101.6869, 'Asia/Kuala_Lumpur', null),
  // Either side of the date line.
  place('Kiritimati', 1.8721, -157.4278, 'Pacific/Kiritimati', 'KI'),
  place('Nukualofa', -21.1393, -175.2049, 'Pacific/Tongatapu', 'TO'),
  place('Apia', -13.8333, -171.7667, 'Pacific/Apia', 'WS'),
  place('Chatham', -43.9535, -176.5597, 'Pacific/Chatham', 'NZ'),
  place('Honolulu', 21.3069, -157.8583, 'Pacific/Honolulu', 'US'),
  place('Pago Pago', -14.2756, -170.702, 'Pacific/Pago_Pago', 'AS'),
  place('Suva', -18.1248, 178.4501, 'Pacific/Fiji', 'FJ'),
  // Arctic and Antarctic.
  place('Tromso', 69.6492, 18.9553, 'Europe/Oslo', 'NO'),
  place('Murmansk', 68.9585, 33.0827, 'Europe/Moscow', 'RU'),
  place('Rovaniemi', 66.5039, 25.7294, 'Europe/Helsinki', 'FI'),
  place('Reykjavik', 64.1466, -21.9426, 'Atlantic/Reykjavik', 'IS'),
  place('Kiruna', 67.8558, 20.2253, 'Europe/Stockholm', 'SE'),
  place('Longyearbyen', 78.2232, 15.6267, 'Arctic/Longyearbyen', 'NO'),
  place('Utqiagvik', 71.2906, -156.7887, 'America/Anchorage', 'US'),
  place('Nuuk', 64.1814, -51.6941, 'America/Nuuk', 'GL'),
  place('McMurdo', -77.8419, 166.6863, 'Antarctica/McMurdo', 'AQ'),
  // The southern hemisphere.
  place('Buenos Aires', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires', 'AR'),
  place('Santiago', -33.4489, -70.6693, 'America/Santiago', 'CL'),
  place('Perth', -31.9523, 115.8613, 'Australia/Perth', 'AU'),
  place('Ushuaia', -54.8019, -68.303, 'America/Argentina/Ushuaia', 'AR'),
  place('Lord Howe', -31.5553, 159.0821, 'Australia/Lord_Howe', 'AU'),
  // Northern places where the automatic high-latitude rule matters.
  place('Stockholm', 59.3293, 18.0686, 'Europe/Stockholm', 'SE'),
  place('Berlin', 52.52, 13.405, 'Europe/Berlin', 'DE'),
  place('Edmonton', 53.5461, -113.4938, 'America/Edmonton', 'CA'),
  place('Anchorage', 61.2181, -149.9003, 'America/Anchorage', 'us'),
  // Odd offsets, DST rules, and places known only by their zone.
  place('Delhi', 28.6139, 77.209, 'Asia/Calcutta', null),
  place('Dhaka', 23.8103, 90.4125, 'Asia/Dhaka', 'BD'),
  place('Kabul', 34.5553, 69.2075, 'Asia/Kabul', 'AF'),
  place('Kathmandu', 27.7172, 85.324, 'Asia/Kathmandu', 'NP'),
  place('Rabat', 34.0209, -6.8416, 'Africa/Casablanca', 'MA'),
  place('Lagos', 6.5244, 3.3792, 'Africa/Lagos', 'NG'),
  place('St Johns', 47.5615, -52.7126, 'America/St_Johns', null),
  place('Indianapolis', 39.7684, -86.1581, 'America/Indiana/Indianapolis', null),
  place('Paris', 48.8566, 2.3522, 'Europe/Paris', 'FR'),
  place('Ankara', 39.9334, 32.8597, 'Europe/Istanbul', 'tr'),
  place('Mexico City', 19.4326, -99.1332, 'America/Mexico_City', 'MX'),
]

/** Seasons, solstices, DST changes and Umm al-Qura Ramadan boundaries. */
export const DATES: string[] = [
  '2024-02-29', // a leap day
  '2026-01-01',
  '2026-01-15',
  '2026-02-17', // the day before Ramadan 1447
  '2026-02-18', // 1 Ramadan 1447
  '2026-03-01',
  '2026-03-08', // US clocks go forward
  '2026-03-19', // last day of Ramadan 1447
  '2026-03-20', // Eid al-Fitr
  '2026-03-29', // EU clocks go forward
  '2026-04-05', // Sydney clocks go back
  '2026-04-24', // Egypt clocks go forward at midnight
  '2026-05-10',
  '2026-05-20',
  '2026-06-21',
  '2026-07-15',
  '2026-08-01',
  '2026-09-21',
  '2026-10-04', // Sydney clocks go forward
  '2026-10-12',
  '2026-10-25', // EU clocks go back
  '2026-10-29', // Egypt clocks go back
  '2026-11-01', // US clocks go back
  '2026-11-15',
  '2026-11-24', // Tromsø's low sun
  '2026-12-03',
  '2026-12-18',
  '2026-12-21',
  '2026-12-31',
  '2027-01-19',
  '2027-01-25',
  '2027-02-07', // around the start of Ramadan 1448
  '2027-02-08',
  '2027-03-09', // around its end
  '2027-03-10',
  '2027-04-15',
  '2027-05-10',
  '2030-06-21',
]

const config = (patch: Partial<CalculationConfig> = {}): CalculationConfig => ({
  method: 'auto',
  madhab: 'auto',
  highLatitudeRule: 'auto',
  polar: 'unresolved',
  adjustments: NO_ADJUSTMENTS,
  ...patch,
})

const ADJUSTMENT_SETS: Adjustments[] = [
  { fajr: -3, sunrise: 2, dhuhr: 5, asr: 0, maghrib: 4, isha: -30 },
  { fajr: 0, sunrise: 0, dhuhr: 30, asr: -30, maghrib: -30, isha: 0 },
  { fajr: 30, sunrise: -30, dhuhr: -7, asr: 11, maghrib: 1, isha: 30 },
]

export interface CaseGroup {
  name: string
  configs: CalculationConfig[]
  dates: string[]
  places: GridPlace[]
}

const ARCTIC = PLACES.filter(({ latitude }) => Math.abs(latitude) >= 60)
const everyThirdDay = (from: string, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(`${from}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index * 3)
    return date.toISOString().slice(0, 10)
  })

export const GROUPS: CaseGroup[] = [
  {
    name: 'defaults, polar off and on',
    configs: [config(), config({ polar: 'nearestLatitude' })],
    dates: DATES,
    places: PLACES,
  },
  {
    name: 'every method and both schools',
    configs: METHOD_IDS.flatMap((method) => (['shafi', 'hanafi'] as const).map((madhab) => config({ method, madhab }))),
    dates: ['2026-01-15', '2026-02-18', '2026-03-20', '2026-06-21', '2026-09-21', '2026-11-24', '2026-12-21', '2027-02-08'],
    places: PLACES,
  },
  {
    name: 'every high-latitude rule, polar off and on',
    configs: (['MuslimWorldLeague', 'MoonsightingCommittee', 'UmmAlQura', 'Tehran'] as const).flatMap((method) =>
      HIGH_LATITUDE_RULES.flatMap((highLatitudeRule) =>
        (['unresolved', 'nearestLatitude'] as const).map((polar) => config({ method, highLatitudeRule, polar })),
      ),
    ),
    dates: ['2026-01-15', '2026-03-20', '2026-05-20', '2026-06-21', '2026-07-15', '2026-11-24', '2026-12-21'],
    places: PLACES,
  },
  {
    name: 'adjustments',
    configs: (['auto', 'UmmAlQura', 'Singapore', 'Turkey'] as const).flatMap((method) =>
      ADJUSTMENT_SETS.flatMap((adjustments) =>
        (['unresolved', 'nearestLatitude'] as const).map((polar) => config({ method, adjustments, polar })),
      ),
    ),
    dates: ['2026-03-01', '2026-06-21', '2026-11-15', '2026-12-21'],
    places: PLACES,
  },
  {
    name: 'polar places all year, both schools, polar off and on',
    configs: (['shafi', 'hanafi'] as const).flatMap((madhab) =>
      (['unresolved', 'nearestLatitude'] as const).map((polar) => config({ method: 'MuslimWorldLeague', madhab, polar })),
    ),
    dates: everyThirdDay('2026-07-01', 122),
    places: ARCTIC,
  },
]

/** Days whose next and current prayer are sampled through the day. */
export const SCHEDULE_DATES = ['2026-03-08', '2026-03-20', '2026-06-21', '2026-10-12', '2026-11-24', '2026-12-21']
