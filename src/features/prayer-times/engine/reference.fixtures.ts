import type { TimeSlot } from '../../../shared/types'
import type { CalculationConfig, Place } from './compute'

/**
 * Timetables published by others, fetched once (October 2026) and frozen here.
 * `expected` is wall-clock time in the place's own zone. Each entry names the
 * request it came from so it can be re-checked by hand.
 */
export interface ReferenceCase {
  name: string
  source: string
  dateKey: string
  place: Omit<Place, 'countryCode'>
  config: Partial<CalculationConfig>
  expected: Record<TimeSlot, string>
}

/** Computed by the Aladhan API (api.aladhan.com), an independent implementation. */
export const ALADHAN_CASES: ReferenceCase[] = [
  {
    name: 'Makkah, Umm al-Qura',
    source: 'https://api.aladhan.com/v1/timings/10-05-2026?latitude=21.4225&longitude=39.8262&method=4&school=0',
    dateKey: '2026-05-10',
    place: { latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh' },
    config: { method: 'UmmAlQura', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:22', sunrise: '05:45', dhuhr: '12:17', asr: '15:35', maghrib: '18:50', isha: '20:20' },
  },
  {
    name: 'Makkah in Ramadan, Umm al-Qura (Isha two hours after Maghrib)',
    source: 'https://api.aladhan.com/v1/timings/01-03-2026?latitude=21.4225&longitude=39.8262&method=4&school=0',
    dateKey: '2026-03-01',
    place: { latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh' },
    config: { method: 'UmmAlQura', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:25', sunrise: '06:41', dhuhr: '12:33', asr: '15:54', maghrib: '18:25', isha: '20:25' },
  },
  {
    name: 'Cairo in summer time, Egyptian',
    source: 'https://api.aladhan.com/v1/timings/15-07-2026?latitude=30.0444&longitude=31.2357&method=5&school=0',
    dateKey: '2026-07-15',
    place: { latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo' },
    config: { method: 'Egyptian', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:21', sunrise: '06:04', dhuhr: '13:01', asr: '16:38', maghrib: '19:58', isha: '21:29' },
  },
  {
    name: 'Cairo in winter, Egyptian',
    source: 'https://api.aladhan.com/v1/timings/15-01-2026?latitude=30.0444&longitude=31.2357&method=5&school=0',
    dateKey: '2026-01-15',
    place: { latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo' },
    config: { method: 'Egyptian', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:21', sunrise: '06:52', dhuhr: '12:04', asr: '14:57', maghrib: '17:17', isha: '18:39' },
  },
  {
    name: 'Istanbul, Turkey',
    source: 'https://api.aladhan.com/v1/timings/21-09-2026?latitude=41.0082&longitude=28.9784&method=13&school=0',
    dateKey: '2026-09-21',
    place: { latitude: 41.0082, longitude: 28.9784, timeZone: 'Europe/Istanbul' },
    config: { method: 'Turkey', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:18', sunrise: '06:43', dhuhr: '13:02', asr: '16:29', maghrib: '19:10', isha: '20:30' },
  },
  {
    name: 'Karachi with Hanafi Asr, Karachi',
    source: 'https://api.aladhan.com/v1/timings/05-01-2026?latitude=24.8607&longitude=67.0011&method=1&school=1',
    dateKey: '2026-01-05',
    place: { latitude: 24.8607, longitude: 67.0011, timeZone: 'Asia/Karachi' },
    config: { method: 'Karachi', madhab: 'hanafi', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:57', sunrise: '07:18', dhuhr: '12:37', asr: '16:21', maghrib: '17:57', isha: '19:18' },
  },
  {
    name: 'Jakarta, Singapore',
    source: 'https://api.aladhan.com/v1/timings/20-04-2026?latitude=-6.2088&longitude=106.8456&method=11&school=0',
    dateKey: '2026-04-20',
    place: { latitude: -6.2088, longitude: 106.8456, timeZone: 'Asia/Jakarta' },
    config: { method: 'Singapore', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:35', sunrise: '05:53', dhuhr: '11:52', asr: '15:12', maghrib: '17:50', isha: '19:00' },
  },
  {
    name: 'London in June, Muslim World League with one-seventh of the night',
    source: 'https://api.aladhan.com/v1/timings/21-06-2026?latitude=51.5074&longitude=-0.1278&method=3&school=0&latitudeAdjustmentMethod=2',
    dateKey: '2026-06-21',
    place: { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'seventhofthenight' },
    expected: { fajr: '03:40', sunrise: '04:43', dhuhr: '13:02', asr: '17:25', maghrib: '21:22', isha: '22:25' },
  },
  {
    name: 'London in December, Muslim World League',
    source: 'https://api.aladhan.com/v1/timings/21-12-2026?latitude=51.5074&longitude=-0.1278&method=3&school=0&latitudeAdjustmentMethod=2',
    dateKey: '2026-12-21',
    place: { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'seventhofthenight' },
    expected: { fajr: '05:59', sunrise: '08:04', dhuhr: '11:59', asr: '13:38', maghrib: '15:53', isha: '17:51' },
  },
  {
    name: 'New York on the day clocks go forward, ISNA',
    source: 'https://api.aladhan.com/v1/timings/08-03-2026?latitude=40.7128&longitude=-74.006&method=2&school=0',
    dateKey: '2026-03-08',
    place: { latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
    config: { method: 'NorthAmerica', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '06:04', sunrise: '07:19', dhuhr: '13:07', asr: '16:21', maghrib: '18:55', isha: '20:10' },
  },
  {
    name: 'New York in summer, ISNA',
    source: 'https://api.aladhan.com/v1/timings/01-08-2026?latitude=40.7128&longitude=-74.006&method=2&school=0',
    dateKey: '2026-08-01',
    place: { latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
    config: { method: 'NorthAmerica', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:24', sunrise: '05:53', dhuhr: '13:02', asr: '16:57', maghrib: '20:11', isha: '21:40' },
  },
  {
    name: 'Sydney on the day clocks go forward, Muslim World League',
    source: 'https://api.aladhan.com/v1/timings/04-10-2026?latitude=-33.8688&longitude=151.2093&method=3&school=0',
    dateKey: '2026-10-04',
    place: { latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:04', sunrise: '06:29', dhuhr: '12:44', asr: '16:16', maghrib: '19:00', isha: '20:19' },
  },
  {
    name: 'Cape Town at the June solstice, Muslim World League',
    source: 'https://api.aladhan.com/v1/timings/21-06-2026?latitude=-33.9249&longitude=18.4241&method=3&school=0',
    dateKey: '2026-06-21',
    place: { latitude: -33.9249, longitude: 18.4241, timeZone: 'Africa/Johannesburg' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '06:22', sunrise: '07:51', dhuhr: '12:48', asr: '15:27', maghrib: '17:45', isha: '19:09' },
  },
  {
    name: 'Kuwait City, Kuwait',
    source: 'https://api.aladhan.com/v1/timings/12-10-2026?latitude=29.3759&longitude=47.9774&method=9&school=0',
    dateKey: '2026-10-12',
    place: { latitude: 29.3759, longitude: 47.9774, timeZone: 'Asia/Kuwait' },
    config: { method: 'Kuwait', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:28', sunrise: '05:47', dhuhr: '11:35', asr: '14:54', maghrib: '17:21', isha: '18:38' },
  },
  {
    name: 'Doha, Qatar',
    source: 'https://api.aladhan.com/v1/timings/12-10-2026?latitude=25.2854&longitude=51.531&method=10&school=0',
    dateKey: '2026-10-12',
    place: { latitude: 25.2854, longitude: 51.531, timeZone: 'Asia/Qatar' },
    config: { method: 'Qatar', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:15', sunrise: '05:31', dhuhr: '11:20', asr: '14:41', maghrib: '17:10', isha: '18:40' },
  },
  {
    name: 'Tehran, Tehran',
    source: 'https://api.aladhan.com/v1/timings/12-10-2026?latitude=35.6892&longitude=51.389&method=7&school=0',
    dateKey: '2026-10-12',
    place: { latitude: 35.6892, longitude: 51.389, timeZone: 'Asia/Tehran' },
    config: { method: 'Tehran', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:45', sunrise: '06:08', dhuhr: '11:51', asr: '15:05', maghrib: '17:51', isha: '18:38' },
  },
  {
    name: 'Singapore, Singapore',
    source: 'https://api.aladhan.com/v1/timings/12-10-2026?latitude=1.3521&longitude=103.8198&method=11&school=0',
    dateKey: '2026-10-12',
    place: { latitude: 1.3521, longitude: 103.8198, timeZone: 'Asia/Singapore' },
    config: { method: 'Singapore', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:31', sunrise: '06:49', dhuhr: '12:51', asr: '16:06', maghrib: '18:54', isha: '20:03' },
  },
  {
    name: 'Toronto in December, ISNA',
    source: 'https://api.aladhan.com/v1/timings/15-12-2026?latitude=43.6532&longitude=-79.3832&method=2&school=0',
    dateKey: '2026-12-15',
    place: { latitude: 43.6532, longitude: -79.3832, timeZone: 'America/Toronto' },
    config: { method: 'NorthAmerica', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '06:17', sunrise: '07:44', dhuhr: '12:13', asr: '14:24', maghrib: '16:41', isha: '18:08' },
  },
  {
    name: 'Auckland in summer time (UTC+13), Muslim World League',
    source: 'https://api.aladhan.com/v1/timings/10-01-2026?latitude=-36.8485&longitude=174.7633&method=3&school=0',
    dateKey: '2026-01-10',
    place: { latitude: -36.8485, longitude: 174.7633, timeZone: 'Pacific/Auckland' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:24', sunrise: '06:13', dhuhr: '13:28', asr: '17:20', maghrib: '20:43', isha: '22:25' },
  },
  {
    name: 'Nuku‘alofa, Tonga (UTC+13 at 175° W), Muslim World League',
    source: 'https://api.aladhan.com/v1/timings/12-10-2026?latitude=-21.1393&longitude=-175.2049&method=3&school=0',
    dateKey: '2026-10-12',
    place: { latitude: -21.1393, longitude: -175.2049, timeZone: 'Pacific/Tongatapu' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '04:57', sunrise: '06:12', dhuhr: '12:27', asr: '15:52', maghrib: '18:43', isha: '19:54' },
  },
  {
    name: 'Kiritimati (UTC+14 at 157° W), Muslim World League',
    source: 'https://api.aladhan.com/v1/timings/12-10-2026?latitude=1.8721&longitude=-157.4278&method=3&school=0',
    dateKey: '2026-10-12',
    place: { latitude: 1.8721, longitude: -157.4278, timeZone: 'Pacific/Kiritimati' },
    config: { method: 'MuslimWorldLeague', highLatitudeRule: 'twilightangle' },
    expected: { fajr: '05:04', sunrise: '06:14', dhuhr: '12:16', asr: '15:31', maghrib: '18:18', isha: '19:24' },
  },
]

/**
 * Timetables from the authority behind a method, used where Aladhan's own
 * preset for it disagrees with adhan's or is marked experimental.
 */
export const AUTHORITY_CASES: ReferenceCase[] = [
  // Aladhan's method 15 has Dhuhr at 13:02 / 11:59 and Maghrib at 21:22 / 15:53 on these days: it leaves out
  // the five-minute Dhuhr and three-minute Maghrib precautions that moonsighting.com applies and adhan follows.
  // Read from the mirror below because moonsighting.com/time_json.php answered HTTP 500 at the time.
  {
    name: 'London in June, Moonsighting Committee (moonsighting.com timetable)',
    source: 'https://moonsighting.ahmedbukhamsin.sa/time_json.php?year=2026&tz=Europe/London&lat=51.5074&lon=-0.1278&method=0&both=0&time=0',
    dateKey: '2026-06-21',
    place: { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
    config: { method: 'MoonsightingCommittee' },
    expected: { fajr: '02:43', sunrise: '04:43', dhuhr: '13:07', asr: '17:25', maghrib: '21:25', isha: '22:42' },
  },
  {
    name: 'London in December, Moonsighting Committee (moonsighting.com timetable)',
    source: 'https://moonsighting.ahmedbukhamsin.sa/time_json.php?year=2026&tz=Europe/London&lat=51.5074&lon=-0.1278&method=0&both=0&time=0',
    dateKey: '2026-12-21',
    place: { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
    config: { method: 'MoonsightingCommittee' },
    expected: { fajr: '06:22', sunrise: '08:04', dhuhr: '12:04', asr: '13:38', maghrib: '15:56', isha: '17:32' },
  },
  // The timetable UAE newspapers print. Aladhan's "Dubai (experimental)" has sunrise at 06:16 this day,
  // four minutes after the printed one: it lacks the three-minute sunrise margin that adhan's preset carries.
  {
    name: 'Dubai, Dubai (timetable printed by Khaleej Times)',
    source: 'https://www.khaleejtimes.com/prayer-time-uae/dubai',
    dateKey: '2026-10-12',
    place: { latitude: 25.2048, longitude: 55.2708, timeZone: 'Asia/Dubai' },
    config: { method: 'Dubai' },
    expected: { fajr: '04:58', sunrise: '06:12', dhuhr: '12:08', asr: '15:27', maghrib: '17:58', isha: '19:12' },
  },
  // Diyanet's own timetable for Istanbul (district 9541), read through the ezanvakti mirror of namazvakti.diyanet.gov.tr.
  {
    name: 'Istanbul, Turkey (Diyanet timetable)',
    source: 'https://ezanvakti.emushaf.net/vakitler/9541',
    dateKey: '2026-10-12',
    place: { latitude: 41.0082, longitude: 28.9784, timeZone: 'Europe/Istanbul' },
    config: { method: 'Turkey' },
    expected: { fajr: '05:41', sunrise: '07:05', dhuhr: '12:56', asr: '16:03', maghrib: '18:37', isha: '19:56' },
  },
  // JAKIM's official times for Kuala Lumpur (zone WLY01). Malaysia has used 18° for Subuh since late 2019,
  // so this is the Karachi preset; adhan's Singapore preset (20°) gives Fajr at 05:41, ten minutes early.
  {
    name: 'Kuala Lumpur, Karachi (JAKIM e-solat timetable)',
    source: 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=duration&zone=WLY01 (datestart=dateend=2026-10-12)',
    dateKey: '2026-10-12',
    place: { latitude: 3.139, longitude: 101.6869, timeZone: 'Asia/Kuala_Lumpur' },
    config: { method: 'Karachi' },
    expected: { fajr: '05:51', sunrise: '06:57', dhuhr: '13:03', asr: '16:17', maghrib: '19:03', isha: '20:12' },
  },
]
