// Runs the website's prayer engine over a broad grid and writes what it answers as JSON
// fixtures for the native engine's parity tests (apple/AzkarKit/Tests/PrayerEngineTests).
// See vitest.config.ts next to this file for how to run it.
//
// Instants are written as milliseconds from noon UTC of the case's own day, `null` for a
// time that does not exist, so the files stay small and the Swift side can compare exactly.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { dateKeyInZone, dateKeyToUtcNoon, daysBetween, shiftDateKey, zonedParts } from '../../../src/shared/date'
import { PRAYERS, TIME_SLOTS } from '../../../src/shared/types'
import type { PrayerDay, UpcomingPrayer } from '../../../src/shared/types'
import { computePrayerDay, DEFAULT_CALCULATION, isUmmAlQuraRamadan, isValidTime } from '../../../src/features/prayer-times/engine/compute'
import type { CalculationConfig, Place } from '../../../src/features/prayer-times/engine/compute'
import { autoMadhab, autoMethod, METHOD_IDS, methodAngles } from '../../../src/features/prayer-times/engine/methods'
import { ALADHAN_CASES, AUTHORITY_CASES } from '../../../src/features/prayer-times/engine/reference.fixtures'
import { buildTimeline, currentPrayerAt, nextPrayerAt } from '../../../src/features/prayer-times/engine/schedule'
import { dayPhase } from '../../../src/features/azkar/clock'
import { isBeforeDawn } from '../../../src/features/today/night'
import { DATES, GROUPS, PLACES, SCHEDULE_DATES } from './grid'
import type { GridPlace } from './grid'
import { importFromWip, WIP_BRANCH } from './wipSnapshot'

/** Run from the repository root (see vitest.config.ts). */
const repo = process.cwd()
const OUT = join(repo, 'apple/AzkarKit/Tests/PrayerEngineTests/Fixtures')

interface UnloggedModule {
  prayerDeadline: (prayer: string, day: PrayerDay, nextDay: PrayerDay | undefined, ishaEnds: 'middle' | 'fajr') => { endsAt: Date; preferred: boolean } | null
  unloggedEntries: (days: PrayerDay[], choices: { leadMinutes: number; ishaEnds: 'middle' | 'fajr'; isLogged: () => boolean }) => Array<{ prayer: string; dateKey: string; at: Date; endsAt: Date; preferred: boolean; key: string }>
}
type WebReminder = { kind: string; dateKey: string; at: Date; key: string; after?: string; endsAt?: Date; preferred?: boolean }
interface ReminderChoicesWeb {
  prayers: boolean
  morning: boolean
  evening: boolean
  morningAt: 'fajr' | 'sunrise'
  unlogged?: { leadMinutes: number; ishaEnds: 'middle' | 'fajr'; isLogged: (dateKey: string, prayer: string) => boolean }
}
interface PlanModule {
  WINDOW_DAYS: number
  REMINDER_LIMIT: number
  reminderEntries: (days: PrayerDay[], choices: ReminderChoicesWeb) => WebReminder[]
  upcomingReminders: (dayFor: (dateKey: string) => PrayerDay, timeZone: string, choices: ReminderChoicesWeb, now: Date) => WebReminder[]
  reminderId: (entry: WebReminder) => number
}
interface QiblaModule {
  qiblaDirection: (latitude: number, longitude: number) => { bearing: number; distanceKm: number; near: boolean }
  cardinalOf: (bearing: number) => string
}

const noon = (dateKey: string) => dateKeyToUtcNoon(dateKey).getTime()
const offset = (date: Date | undefined, dateKey: string) => (isValidTime(date) ? date.getTime() - noon(dateKey) : null)
const toPlace = ({ latitude, longitude, timeZone, countryCode }: GridPlace): Place => ({ latitude, longitude, timeZone, countryCode })

function write(name: string, value: unknown) {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, name), `${JSON.stringify(value)}\n`)
}

/** Every case of every group, as rows of [place, date, config, fajr…isha]. */
function grid() {
  const dates: string[] = []
  const configs: CalculationConfig[] = []
  const dateIndex = (dateKey: string) => {
    if (!dates.includes(dateKey)) dates.push(dateKey)
    return dates.indexOf(dateKey)
  }
  const configIndex = (config: CalculationConfig) => {
    const key = JSON.stringify(config)
    const found = configs.findIndex((candidate) => JSON.stringify(candidate) === key)
    if (found >= 0) return found
    configs.push(config)
    return configs.length - 1
  }
  const cases: Array<Array<number | null>> = []
  for (const group of GROUPS) {
    for (const gridPlace of group.places) {
      const placeIndex = PLACES.indexOf(gridPlace)
      for (const dateKey of group.dates) {
        for (const config of group.configs) {
          const day = computePrayerDay(dateKey, toPlace(gridPlace), config)
          cases.push([placeIndex, dateIndex(dateKey), configIndex(config), ...TIME_SLOTS.map((slot) => offset(day.times[slot], dateKey))])
        }
      }
    }
  }
  return { slots: TIME_SLOTS, dates, configs, cases }
}

const PHASES = ['beforeDawn', 'morning', 'midday', 'evening'] as const

/**
 * The zone's offset from UTC at `now`, in minutes, by this runtime's time-zone database. The
 * phase and the before-dawn rule read the local clock, so a sample only proves parity where the
 * device's database agrees (Node's ICU and Apple's ship different tzdata releases).
 */
function zoneOffsetMinutes(now: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = zonedParts(now, timeZone)
  const whole = Math.floor(now.getTime() / 1000) * 1000
  return (Date.UTC(year, month - 1, day, hour, minute, second) - whole) / 60_000
}

/** Next and current prayer, the day's phase and the before-dawn rule, through each sampled day. */
function schedules() {
  const encode = (entry: UpcomingPrayer | null, dateKey: string) =>
    entry ? PRAYERS.indexOf(entry.prayer) * 10 + daysBetween(dateKey, entry.dateKey) + 1 : null
  const samples: Array<Array<number | null>> = []
  for (const [placeIndex, gridPlace] of PLACES.entries()) {
    const place = toPlace(gridPlace)
    for (const [dateIndex, dateKey] of SCHEDULE_DATES.entries()) {
      const days = [-1, 0, 1].map((shift) => computePrayerDay(shiftDateKey(dateKey, shift), place, DEFAULT_CALCULATION))
      const timeline = buildTimeline(days)
      const instants = new Set<number>()
      for (let minutes = -18 * 60; minutes <= 18 * 60; minutes += 30) instants.add(noon(dateKey) + minutes * 60_000)
      for (const entry of timeline) for (const delta of [-1, 0]) instants.add(entry.at.getTime() + delta)
      for (const day of days) {
        const sunrise = day.times.sunrise
        if (isValidTime(sunrise)) for (const delta of [-1, 0]) instants.add(sunrise.getTime() + delta)
      }
      for (const instant of [...instants].sort((a, b) => a - b)) {
        const now = new Date(instant)
        const today = computePrayerDay(dateKeyInZone(now, place.timeZone), place, DEFAULT_CALCULATION)
        samples.push([
          placeIndex,
          dateIndex,
          instant - noon(dateKey),
          encode(nextPrayerAt(timeline, now), dateKey),
          encode(currentPrayerAt(timeline, days, now), dateKey),
          PHASES.indexOf(dayPhase(now, place.timeZone, today)),
          isBeforeDawn(now, place.timeZone, today) ? 1 : 0,
          zoneOffsetMinutes(now, place.timeZone),
        ])
      }
    }
  }
  return { dates: SCHEDULE_DATES, prayers: PRAYERS, phases: PHASES, samples }
}

async function deadlines() {
  const { prayerDeadline, unloggedEntries } = await importFromWip<UnloggedModule>('src/features/prayer-times/reminders/unlogged.ts')
  const rows: unknown[] = []
  for (const [placeIndex, gridPlace] of PLACES.entries()) {
    const place = toPlace(gridPlace)
    for (const [dateIndex, dateKey] of SCHEDULE_DATES.entries()) {
      const day = computePrayerDay(dateKey, place, DEFAULT_CALCULATION)
      const next = computePrayerDay(shiftDateKey(dateKey, 1), place, DEFAULT_CALCULATION)
      for (const ishaEnds of ['middle', 'fajr'] as const) {
        const ends = PRAYERS.map((prayer) => {
          const deadline = prayerDeadline(prayer, day, next, ishaEnds)
          return deadline ? [offset(deadline.endsAt, dateKey), deadline.preferred ? 1 : 0] : null
        })
        const entries = (leadMinutes: number) =>
          unloggedEntries([day, next], { leadMinutes, ishaEnds, isLogged: () => false }).map((entry) => [
            entry.key,
            offset(entry.at, dateKey),
            offset(entry.endsAt, dateKey),
            entry.preferred ? 1 : 0,
          ])
        rows.push({ place: placeIndex, date: dateIndex, ishaEnds, ends, lead10: entries(10), lead60: entries(60) })
      }
    }
  }
  return { branch: WIP_BRANCH, dates: SCHEDULE_DATES, rows }
}

/** Choice sets the reminder plan is run with; `logged` marks some prayers as logged already. */
const REMINDER_CHOICES = [
  { prayers: true, morning: true, evening: true, morningAt: 'fajr', unlogged: { leadMinutes: 15, ishaEnds: 'middle' } },
  { prayers: false, morning: true, evening: false, morningAt: 'sunrise', unlogged: { leadMinutes: 45, ishaEnds: 'fajr' } },
  { prayers: true, morning: false, evening: true, morningAt: 'fajr' },
] as const

/** Logged when the day's distance from the case's date plus the prayer's index is a multiple of three. */
const isLoggedRule = (base: string) => (dateKey: string, prayer: string) =>
  (((daysBetween(base, dateKey) + PRAYERS.indexOf(prayer as (typeof PRAYERS)[number])) % 3) + 3) % 3 === 0

/** The reminder plan of the branch: every entry of four days, and what is handed to the system at sampled instants. */
async function reminders() {
  const plan = await importFromWip<PlanModule>('src/features/prayer-times/reminders/plan.ts', ['src/features/prayer-times/reminders/unlogged.ts'])
  const choicesFor = (index: number, base: string): ReminderChoicesWeb => {
    const { unlogged, ...rest } = REMINDER_CHOICES[index] as (typeof REMINDER_CHOICES)[number] & { unlogged?: { leadMinutes: number; ishaEnds: 'middle' | 'fajr' } }
    return unlogged ? { ...rest, unlogged: { ...unlogged, isLogged: isLoggedRule(base) } } : { ...rest }
  }
  const encode = (entry: WebReminder, dateKey: string) => [
    entry.key,
    offset(entry.at, dateKey),
    plan.reminderId(entry),
    entry.after ?? (entry.endsAt ? offset(entry.endsAt, dateKey) : null),
    entry.preferred === undefined ? null : entry.preferred ? 1 : 0,
  ]
  const entries: unknown[] = []
  const upcoming: unknown[] = []
  for (const [placeIndex, gridPlace] of PLACES.entries()) {
    const place = toPlace(gridPlace)
    const dayFor = (dateKey: string) => computePrayerDay(dateKey, place, DEFAULT_CALCULATION)
    for (const [dateIndex, dateKey] of SCHEDULE_DATES.entries()) {
      // Every other date keeps the file small: the clocks changing, the midnight sun and the polar night.
      if (dateIndex % 2 !== 0) continue
      const days = [-1, 0, 1, 2].map((shift) => dayFor(shiftDateKey(dateKey, shift)))
      for (const [choiceIndex] of REMINDER_CHOICES.entries()) {
        const list = plan.reminderEntries(days, choicesFor(choiceIndex, dateKey)).map((entry) => encode(entry, dateKey))
        entries.push({ place: placeIndex, date: dateIndex, choices: choiceIndex, entries: list })
      }
      if (placeIndex % 4 !== 0) continue
      for (const hours of [-13, 0, 7]) {
        const now = new Date(noon(dateKey) + hours * 3_600_000)
        for (const choiceIndex of [0, 1]) {
          const list = plan.upcomingReminders(dayFor, place.timeZone, choicesFor(choiceIndex, dateKey), now).map((entry) => [entry.key, offset(entry.at, dateKey)])
          upcoming.push({ place: placeIndex, date: dateIndex, hours, choices: choiceIndex, entries: list })
        }
      }
    }
  }
  return { branch: WIP_BRANCH, windowDays: plan.WINDOW_DAYS, limit: plan.REMINDER_LIMIT, dates: SCHEDULE_DATES, choices: REMINDER_CHOICES, entries, upcoming }
}

async function qibla() {
  const { qiblaDirection, cardinalOf } = await importFromWip<QiblaModule>('src/features/qibla/bearing.ts')
  const points: Array<[number, number]> = PLACES.map(({ latitude, longitude }) => [latitude, longitude])
  for (let latitude = -80; latitude <= 80; latitude += 20) for (let longitude = -180; longitude <= 180; longitude += 30) points.push([latitude, longitude])
  points.push([21.4225241, 39.8261818], [21.423, 39.827], [21.43, 39.84], [-21.4225241, -140.1738182])
  return {
    branch: WIP_BRANCH,
    points: points.map(([latitude, longitude]) => {
      const direction = qiblaDirection(latitude, longitude)
      return [latitude, longitude, direction.bearing, direction.distanceKm, direction.near ? 1 : 0, cardinalOf(direction.bearing)]
    }),
  }
}

/** The automatic method and Asr school for each grid place, every zone the website knows, and countries. */
function resolution() {
  const source = readFileSync(join(repo, 'src/features/prayer-times/engine/methods.ts'), 'utf8')
  const zones = [...source.matchAll(/^\s+'([A-Za-z_/-]+)': '[A-Z]{2}',$/gm)].map((match) => match[1] as string)
  const countries = [...source.matchAll(/^\s+([A-Z]{2}): '[A-Za-z]+',$/gm)].map((match) => match[1] as string)
  const extraZones = [
    'America/Indiana/Knox',
    'America/Kentucky/Monticello',
    'America/North_Dakota/Center',
    'US/Eastern',
    'Canada/Pacific',
    'Europe/Paris',
    'Asia/Tokyo',
    'Etc/Unknown',
    'Indian/Maldives',
  ]
  const extraCountries = ['FR', 'DE', 'MA', 'JO', 'NG', 'AU', 'ZZ', 'pk', 'gb', 'Tr', 'in']
  const answer = (countryCode: string | null, timeZone: string) => {
    const context = { countryCode, timeZone }
    return [countryCode, timeZone, autoMethod(context), autoMadhab(context)]
  }
  return {
    zoneTableSize: zones.length,
    countryTableSize: countries.length,
    places: PLACES.map((place) => [autoMethod(place), autoMadhab(place)]),
    contexts: [
      ...[...zones, ...extraZones].flatMap((zone) => [answer(null, zone), answer('', zone)]),
      ...[...countries, ...extraCountries].flatMap((country) => [answer(country, 'Etc/Unknown'), answer(country, 'Africa/Cairo')]),
    ],
    angles: Object.fromEntries(METHOD_IDS.map((method) => [method, methodAngles(method)])),
  }
}

/** Ramadan in the Umm al-Qura calendar, as runs of civil days, 2000 to 2076. */
function ramadan() {
  const runs: Array<[string, string]> = []
  let start: string | null = null
  let previous = ''
  for (let dateKey = '2000-01-01'; dateKey <= '2076-12-31'; dateKey = shiftDateKey(dateKey, 1)) {
    const inRamadan = isUmmAlQuraRamadan(dateKey)
    if (inRamadan && start === null) start = dateKey
    if (!inRamadan && start !== null) {
      runs.push([start, previous])
      start = null
    }
    previous = dateKey
  }
  return { from: '2000-01-01', to: '2076-12-31', runs }
}

const runtime = process.env

it('writes the fixtures, identical from every device zone', async () => {
  const original = runtime.TZ
  runtime.TZ = 'UTC'
  const engine = grid()
  // The web engine is itself independent of the device's zone, so the fixtures are the same from anywhere.
  for (const [zone, offsetMinutes] of [['Pacific/Kiritimati', -840], ['America/St_Johns', 210], ['Asia/Kathmandu', -345]] as const) {
    runtime.TZ = zone
    // Guards the check itself: if the runtime ignored the change, it would pass vacuously.
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset(), zone).toBe(offsetMinutes)
    expect(JSON.stringify(grid()), `device in ${zone}`).toBe(JSON.stringify(engine))
  }
  runtime.TZ = 'UTC'
  write('places.json', PLACES)
  write('engine-grid.json', engine)
  write('schedule.json', schedules())
  write('deadlines.json', await deadlines())
  write('reminders.json', await reminders())
  write('qibla.json', await qibla())
  write('resolution.json', resolution())
  write('ramadan.json', ramadan())
  write('reference.json', { aladhan: ALADHAN_CASES, authority: AUTHORITY_CASES })
  if (original === undefined) delete runtime.TZ
  else runtime.TZ = original
  expect(DATES.length).toBeGreaterThanOrEqual(30)
  expect(PLACES.length).toBeGreaterThanOrEqual(40)
})
