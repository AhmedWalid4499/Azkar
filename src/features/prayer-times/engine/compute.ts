import { CalculationMethod, Coordinates, Madhab, PolarCircleResolution, PrayerTimes } from 'adhan'
import { dateKeyInZone, dateKeyToUtcNoon, daysBetween, partsOfDateKey, shiftDateKey } from '../../../shared/date'
import { TIME_SLOTS } from '../../../shared/types'
import type { DateKey, PrayerDay, TimeSlot } from '../../../shared/types'
import { resolveMethod } from './methods'
import type { MethodContext, MethodSetting } from './methods'

/** adhan's own identifiers, so a stored value can be handed to it unchanged. */
export const HIGH_LATITUDE_RULES = ['middleofthenight', 'seventhofthenight', 'twilightangle'] as const
export type HighLatitudeRuleId = (typeof HIGH_LATITUDE_RULES)[number]
export type HighLatitudeSetting = 'auto' | HighLatitudeRuleId

export type MadhabSetting = 'shafi' | 'hanafi'

/** What to do on days when the sun never rises or never sets. */
export type PolarSetting = 'unresolved' | 'nearestLatitude'

/** Largest manual correction, in minutes either way. */
export const ADJUSTMENT_LIMIT = 30

export type Adjustments = Record<TimeSlot, number>

export const NO_ADJUSTMENTS: Adjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }

export interface CalculationConfig {
  method: MethodSetting
  madhab: MadhabSetting
  highLatitudeRule: HighLatitudeSetting
  polar: PolarSetting
  /** Minutes added to each time, -30 to +30. */
  adjustments: Adjustments
}

export const DEFAULT_CALCULATION: CalculationConfig = {
  method: 'auto',
  madhab: 'shafi',
  highLatitudeRule: 'auto',
  polar: 'unresolved',
  adjustments: NO_ADJUSTMENTS,
}

export interface Place extends MethodContext {
  latitude: number
  longitude: number
}

/** Below this latitude the sun rises and sets every day of the year. */
const POLAR_LATITUDE = 65

export function isPolarLatitude(latitude: number): boolean {
  return Math.abs(latitude) >= POLAR_LATITUDE
}

/**
 * "Automatic" is the twilight-angle rule at every latitude. It steps in only
 * when twilight takes up more of the night than the method's own angles allow,
 * so ordinary days keep the true angle times, as published timetables do.
 * adhan's own recommendation (one-seventh of the night above 48°) is a
 * year-round cap that moved Fajr and Isha by 20 to 90 minutes on most days there.
 */
export function resolveHighLatitudeRule(setting: HighLatitudeSetting): HighLatitudeRuleId {
  return setting === 'auto' ? 'twilightangle' : setting
}

export function clampAdjustment(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0
  return Math.min(ADJUSTMENT_LIMIT, Math.max(-ADJUSTMENT_LIMIT, Math.round(minutes)))
}

/** False for the Invalid Date adhan yields when a time does not exist (polar day or night). */
export function isValidTime(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

export function hasMissingTimes(day: PrayerDay): boolean {
  return TIME_SLOTS.some((slot) => !isValidTime(day.times[slot]))
}

/**
 * adhan takes the calendar day from the Date's *local* year, month and day
 * (and builds "tomorrow" the same way), then returns absolute instants. Local
 * noon carries the intended civil day in whatever zone the device is set to,
 * including across its DST changes; a UTC-based Date would land on the
 * neighbouring day for devices far east or west of Greenwich.
 */
function civilDate(dateKey: DateKey): Date {
  const { year, month, day } = partsOfDateKey(dateKey)
  const date = new Date(2000, 0, 1, 12)
  // setFullYear rather than the constructor, which maps years 0-99 onto 1900-1999.
  date.setFullYear(year, month - 1, day)
  return date
}

const RAMADAN = 9
let hijriMonth: Intl.DateTimeFormat | null | undefined

/** Whether the civil day falls in Ramadan of the Umm al-Qura calendar. */
export function isUmmAlQuraRamadan(dateKey: DateKey): boolean {
  if (hijriMonth === undefined) {
    const format = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', timeZone: 'UTC' })
    // A runtime without this calendar silently answers in Gregorian months.
    hijriMonth = format.resolvedOptions().calendar === 'islamic-umalqura' ? format : null
  }
  if (!hijriMonth) return false
  const month = hijriMonth.formatToParts(dateKeyToUtcNoon(dateKey)).find((part) => part.type === 'month')
  return Number(month?.value) === RAMADAN
}

/**
 * The six times of one civil day at a place. Every instant is absolute; show
 * it in `place.timeZone`. A time that does not exist is an Invalid Date.
 */
export function computePrayerDay(dateKey: DateKey, place: Place, config: CalculationConfig): PrayerDay {
  const coordinates = new Coordinates(place.latitude, place.longitude)
  const method = resolveMethod(config.method, place)
  const params = CalculationMethod[method]()

  params.madhab = config.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi
  params.highLatitudeRule = resolveHighLatitudeRule(config.highLatitudeRule)
  params.polarCircleResolution =
    config.polar === 'nearestLatitude' ? PolarCircleResolution.AqrabBalad : PolarCircleResolution.Unresolved
  for (const slot of TIME_SLOTS) params.adjustments[slot] = clampAdjustment(config.adjustments[slot])

  // The Umm al-Qura calendar holds Isha two hours after Maghrib in Ramadan
  // instead of ninety minutes; adhan leaves that to the caller.
  if (method === 'UmmAlQura' && isUmmAlQuraRamadan(dateKey)) params.adjustments.isha += 30

  let computed = new PrayerTimes(coordinates, civilDate(dateKey), params)

  // adhan anchors each solar day to the UTC date. Where the clock and the sun
  // disagree across the date line (Kiritimati, Tonga, Samoa: UTC+13/+14 at
  // western longitudes) that is the neighbouring local day, so ask again for
  // the day whose noon really falls on `dateKey` here.
  if (isValidTime(computed.dhuhr)) {
    const landedOn = dateKeyInZone(computed.dhuhr, place.timeZone)
    if (landedOn !== dateKey) {
      const corrected = shiftDateKey(dateKey, daysBetween(landedOn, dateKey))
      computed = new PrayerTimes(coordinates, civilDate(corrected), params)
    }
  }

  return {
    dateKey,
    timeZone: place.timeZone,
    times: {
      fajr: computed.fajr,
      sunrise: computed.sunrise,
      dhuhr: computed.dhuhr,
      asr: computed.asr,
      maghrib: computed.maghrib,
      isha: computed.isha,
    },
  }
}
