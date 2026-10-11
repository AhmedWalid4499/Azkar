/** The five obligatory prayers, in order. */
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type PrayerName = (typeof PRAYERS)[number]

/** Everything shown in a day's timetable: the five prayers plus sunrise. */
export const TIME_SLOTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type TimeSlot = (typeof TIME_SLOTS)[number]

/** A calendar day as `YYYY-MM-DD`, independent of any time zone. */
export type DateKey = string

export type Lang = 'en' | 'ar'

/** Prayer times for one calendar day at the saved location. */
export interface PrayerDay {
  dateKey: DateKey
  /** IANA zone the instants below should be displayed in. */
  timeZone: string
  times: Record<TimeSlot, Date>
}

export interface UpcomingPrayer {
  prayer: PrayerName
  at: Date
  /** The calendar day this prayer belongs to (tomorrow's Fajr after Isha). */
  dateKey: DateKey
}
