import { CalculationMethod, Coordinates, Madhab, PolarCircleResolution, PrayerTimes, Rounding } from 'adhan'
import type { CalculationParameters } from 'adhan'
import { dateKeyInZone, dateKeyToUtcNoon, daysBetween, partsOfDateKey, shiftDateKey } from '../../../shared/date'
import { TIME_SLOTS } from '../../../shared/types'
import type { DateKey, PrayerDay, TimeSlot } from '../../../shared/types'
import { resolveMadhab, resolveMethod } from './methods'
import type { MadhabSetting, MethodContext, MethodSetting } from './methods'
import { asrInstant, solarAltitude, solarTransit } from './solar'

/** adhan's own identifiers, so a stored value can be handed to it unchanged. */
export const HIGH_LATITUDE_RULES = ['middleofthenight', 'seventhofthenight', 'twilightangle'] as const
export type HighLatitudeRuleId = (typeof HIGH_LATITUDE_RULES)[number]
export type HighLatitudeSetting = 'auto' | HighLatitudeRuleId

/**
 * What to do on days when the sun never rises, never sets, or stays too close
 * to the horizon for Asr: leave the gaps, or borrow the whole day from the
 * nearest latitude that has every time.
 */
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
  madhab: 'auto',
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
/** How far a borrowed latitude moves toward the equator at a time; adhan's own step. */
const LATITUDE_STEP = 0.5
/**
 * Under this noon altitude Asr is worked out here instead of by adhan, which
 * is already five minutes off at 6° and ten at 3°. Ordinary latitudes never
 * get this low (London's midwinter noon is 15°) and keep adhan's Asr as it is.
 */
const LOW_SUN_DEGREES = 10

const MINUTE_MS = 60_000

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

type Times = Record<TimeSlot, Date>

/** adhan's rounding of a time to the minute, for a time that was worked out here. */
function roundToMinute(instant: number, rounding: CalculationParameters['rounding']): Date {
  // adhan drops the fraction of a second before it looks at the seconds.
  const whole = Math.floor(instant / 1000)
  const seconds = ((whole % 60) + 60) % 60
  let offset = seconds >= 30 ? 60 - seconds : -seconds
  if (rounding === Rounding.Up) offset = 60 - seconds
  else if (rounding === Rounding.None) offset = 0
  return new Date((whole + offset) * 1000)
}

/**
 * Whether Asr falls strictly between Dhuhr and Maghrib, after taking `shift`
 * minutes off each. On a day without a sunset (midnight sun) there is no
 * Maghrib to stay ahead of.
 */
function isAsrInOrder(times: Times, shift: Adjustments = NO_ADJUSTMENTS): boolean {
  const at = (slot: TimeSlot) => times[slot].getTime() - shift[slot] * MINUTE_MS
  if (!isValidTime(times.asr) || !isValidTime(times.dhuhr) || at('asr') <= at('dhuhr')) return false
  return !isValidTime(times.maghrib) || at('asr') < at('maghrib')
}

/**
 * The six times of one civil day at a place. Every instant is absolute; show
 * it in `place.timeZone`. A time that does not exist is an Invalid Date, and so
 * is an Asr that would not fall strictly between Dhuhr and Maghrib.
 */
export function computePrayerDay(dateKey: DateKey, place: Place, config: CalculationConfig): PrayerDay {
  const method = resolveMethod(config.method, place)
  const madhab = resolveMadhab(config.madhab, place)
  const params = CalculationMethod[method]()
  const userAdjustments = { ...NO_ADJUSTMENTS }

  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi
  params.highLatitudeRule = resolveHighLatitudeRule(config.highLatitudeRule)
  // A borrowed latitude is applied below, to the whole day at once. adhan's own
  // version steps in only when the sun never rises or sets, and leaves Asr behind.
  params.polarCircleResolution = PolarCircleResolution.Unresolved
  for (const slot of TIME_SLOTS) {
    userAdjustments[slot] = clampAdjustment(config.adjustments[slot])
    params.adjustments[slot] = userAdjustments[slot]
  }

  // The Umm al-Qura calendar holds Isha two hours after Maghrib in Ramadan
  // instead of ninety minutes; adhan leaves that to the caller.
  if (method === 'UmmAlQura' && isUmmAlQuraRamadan(dateKey)) params.adjustments.isha += 30

  /** adhan's answer for a civil day at a latitude on this place's meridian. */
  const adhanDay = (latitude: number, key: DateKey): PrayerTimes => {
    const coordinates = new Coordinates(latitude, place.longitude)
    const computed = new PrayerTimes(coordinates, civilDate(key), params)

    // adhan anchors each solar day to the UTC date. Where the clock and the sun
    // disagree across the date line (Kiritimati, Tonga, Samoa: UTC+13/+14 at
    // western longitudes) that is the neighbouring local day, so ask again for
    // the day whose noon really falls on `key` here.
    if (isValidTime(computed.dhuhr)) {
      const landedOn = dateKeyInZone(computed.dhuhr, place.timeZone)
      if (landedOn !== key) {
        return new PrayerTimes(coordinates, civilDate(shiftDateKey(key, daysBetween(landedOn, key))), params)
      }
    }
    return computed
  }

  const timesAt = (latitude: number): Times => {
    const computed = adhanDay(latitude, dateKey)
    const times: Times = {
      fajr: computed.fajr,
      sunrise: computed.sunrise,
      dhuhr: computed.dhuhr,
      asr: computed.asr,
      maghrib: computed.maghrib,
      isha: computed.isha,
    }
    if (!isValidTime(times.dhuhr)) return times

    // Dhuhr is the transit plus the method's and the user's minutes, rounded: close enough to find the transit from.
    const dhuhrOffset = params.adjustments.dhuhr + params.methodAdjustments.dhuhr
    const transit = solarTransit(times.dhuhr.getTime() - dhuhrOffset * MINUTE_MS, place.longitude)
    if (solarAltitude(transit, latitude, place.longitude) < LOW_SUN_DEGREES) {
      const asr = asrInstant(transit, latitude, place.longitude, madhab === 'hanafi' ? 2 : 1)
      // What adhan does to its own Asr: the method's and the user's minutes, then rounding.
      const asrOffset = params.adjustments.asr + params.methodAdjustments.asr
      times.asr = roundToMinute(asr + asrOffset * MINUTE_MS, params.rounding)
    }
    return times
  }

  // Whole: every time exists, Asr is in its afternoon, and the night ends, as adhan's own version
  // asks too. Where the sun does not rise again the next day, a method that never measures the
  // night (the Moonsighting Committee's) would still answer, with a Fajr two hours before a
  // sunrise that follows sunset by minutes.
  // The user's own minutes are left out of this: fine-tuning must not decide which latitude is borrowed.
  const isWholeDay = (times: Times, latitude: number) =>
    TIME_SLOTS.every((slot) => isValidTime(times[slot])) &&
    isAsrInOrder(times, userAdjustments) &&
    isValidTime(adhanDay(latitude, shiftDateKey(dateKey, 1)).sunrise)

  let times = timesAt(place.latitude)
  if (config.polar === 'nearestLatitude') {
    let latitude = place.latitude
    let borrowed = times
    let whole = isWholeDay(borrowed, latitude)
    while (!whole && Math.abs(latitude) >= POLAR_LATITUDE) {
      latitude -= Math.sign(latitude) * LATITUDE_STEP
      borrowed = timesAt(latitude)
      whole = isWholeDay(borrowed, latitude)
    }
    if (whole) times = borrowed
  }

  // Whatever produced it, an Asr outside its own afternoon is not shown and nobody is reminded of it.
  if (!isAsrInOrder(times)) times = { ...times, asr: new Date(Number.NaN) }

  return { dateKey, timeZone: place.timeZone, times }
}
