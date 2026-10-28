import { weekdayOfDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import { DHU_AL_HIJJAH, hijriOf, MUHARRAM, RAMADAN, SHAWWAL } from './hijri'
import type { HijriDate } from './hijri'

/** Days on which fasting is not permitted. */
export type ForbiddenDay = 'eidAlFitr' | 'eidAlAdha' | 'tashriq'

/** Why a day is recommended for a voluntary fast, from the most to the least particular. */
export const FASTING_REASONS = ['arafah', 'ashura', 'tasua', 'shawwal', 'whiteDays', 'monday', 'thursday'] as const
export type FastingReason = (typeof FASTING_REASONS)[number]

/** How many fasts the sunnah of Shawwal asks for. */
export const SHAWWAL_FASTS = 6

const MONDAY = 1
const THURSDAY = 4
const WHITE_DAYS = [13, 14, 15]

export interface FastingDayInfo {
  dateKey: DateKey
  /** `null` when the runtime has no Umm al-Qura calendar: only the weekdays are known then. */
  hijri: HijriDate | null
  /** The day of Ramadan (1 to 30), or `null` outside Ramadan. */
  ramadanDay: number | null
  forbidden: ForbiddenDay | null
  /** Empty in Ramadan, whose fast is obligatory, and on a day fasting is not permitted. */
  reasons: FastingReason[]
}

export function forbiddenDayOf(hijri: HijriDate | null): ForbiddenDay | null {
  if (!hijri) return null
  if (hijri.month === SHAWWAL && hijri.day === 1) return 'eidAlFitr'
  if (hijri.month === DHU_AL_HIJJAH && hijri.day === 10) return 'eidAlAdha'
  if (hijri.month === DHU_AL_HIJJAH && hijri.day >= 11 && hijri.day <= 13) return 'tashriq'
  return null
}

function hijriReasons({ month, day }: HijriDate): FastingReason[] {
  const reasons: FastingReason[] = []
  if (month === DHU_AL_HIJJAH && day === 9) reasons.push('arafah')
  if (month === MUHARRAM && day === 10) reasons.push('ashura')
  if (month === MUHARRAM && day === 9) reasons.push('tasua')
  if (month === SHAWWAL && day >= 2) reasons.push('shawwal')
  if (WHITE_DAYS.includes(day)) reasons.push('whiteDays')
  return reasons
}

/**
 * What the calendar says about fasting on a civil day, with the user's Hijri
 * offset: the day of Ramadan, a day fasting is not permitted (the two Eids and
 * the days of Tashriq, 11 to 13 Dhu al-Hijjah), or the reasons it is
 * recommended (Arafah, Ashura and the day before it, the six days of Shawwal,
 * the white days 13 to 15 of each month, Mondays and Thursdays).
 */
export function fastingDayInfo(dateKey: DateKey, offsetDays = 0): FastingDayInfo {
  const hijri = hijriOf(dateKey, offsetDays)
  const ramadanDay = hijri?.month === RAMADAN ? hijri.day : null
  const forbidden = forbiddenDayOf(hijri)
  const reasons: FastingReason[] = []
  if (ramadanDay === null && forbidden === null) {
    if (hijri) reasons.push(...hijriReasons(hijri))
    const weekday = weekdayOfDateKey(dateKey)
    if (weekday === MONDAY) reasons.push('monday')
    if (weekday === THURSDAY) reasons.push('thursday')
  }
  return { dateKey, hijri, ramadanDay, forbidden, reasons }
}

export function isMondayOrThursday(dateKey: DateKey): boolean {
  const weekday = weekdayOfDateKey(dateKey)
  return weekday === MONDAY || weekday === THURSDAY
}

/** One of the white days on which fasting is allowed: the 13th of Dhu al-Hijjah is a day of Tashriq. */
export function isWhiteDay(hijri: HijriDate | null): hijri is HijriDate {
  return hijri !== null && WHITE_DAYS.includes(hijri.day) && hijri.month !== RAMADAN && forbiddenDayOf(hijri) === null
}
