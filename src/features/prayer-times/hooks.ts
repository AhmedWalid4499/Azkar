import { useMemo } from 'react'
import { dateKeyInZone, deviceTimeZone, isValidDateKey, shiftDateKey } from '../../shared/date'
import { useLocationStore } from '../../shared/location'
import { useNow } from '../../shared/time'
import type { DateKey, PrayerDay, UpcomingPrayer } from '../../shared/types'
import { useCalculationConfig } from './config'
import { computePrayerDay } from './engine/compute'
import type { CalculationConfig, Place } from './engine/compute'
import { buildTimeline, currentPrayerAt, nextPrayerAt } from './engine/schedule'
import { toPlace } from './location/place'

/**
 * One result per (place, settings, day), shared by every component that asks.
 * `place` and `config` keep their identity until the user changes them, so they
 * can key the cache directly and stale entries are collected with them.
 */
const cache = new WeakMap<Place, WeakMap<CalculationConfig, Map<DateKey, PrayerDay>>>()

function prayerDayFor(dateKey: DateKey, place: Place, config: CalculationConfig): PrayerDay {
  let byConfig = cache.get(place)
  if (!byConfig) cache.set(place, (byConfig = new WeakMap()))
  let byDay = byConfig.get(config)
  if (!byDay) byConfig.set(config, (byDay = new Map()))
  let day = byDay.get(dateKey)
  if (!day) byDay.set(dateKey, (day = computePrayerDay(dateKey, place, config)))
  return day
}

const placeBySavedLocation = new WeakMap<object, Place | null>()

/** The saved location, validated, as the engine wants it. `null` until a usable one is set. */
export function usePlace(): Place | null {
  const location = useLocationStore((state) => state.location)
  return useMemo(() => {
    if (typeof location !== 'object' || location === null) return null
    // Keyed on the stored object so every component gets the same `Place` and shares the cache above.
    if (!placeBySavedLocation.has(location)) placeBySavedLocation.set(location, toPlace(location))
    return placeBySavedLocation.get(location) ?? null
  }, [location])
}

/**
 * Today's calendar day at the saved location (the device's zone until one is
 * set). Read through the validated place, so a corrupt stored time zone
 * cannot throw here.
 */
export function useLocalToday(): DateKey {
  const timeZone = usePlace()?.timeZone
  const now = useNow(15_000)
  return dateKeyInZone(now, timeZone ?? deviceTimeZone())
}

/**
 * Prayer times for a calendar day at the saved location (today when omitted).
 * `null` until a location is set. A time that does not exist that day (polar
 * day or night) is an Invalid Date: check with `isValidTime` before using it.
 */
export function usePrayerDay(dateKey?: DateKey): PrayerDay | null {
  const place = usePlace()
  const config = useCalculationConfig()
  const today = useLocalToday()
  const key = dateKey ?? today
  return useMemo(
    () => (place && isValidDateKey(key) ? prayerDayFor(key, place, config) : null),
    [place, config, key],
  )
}

export interface PrayerSchedule {
  todayKey: DateKey
  /** IANA zone the times are shown in. */
  timeZone: string
  /** Yesterday, today and tomorrow. */
  days: PrayerDay[]
  /** Their obligatory prayers in chronological order. */
  timeline: UpcomingPrayer[]
}

/**
 * The three days around now, recomputed only when the day, the location or the
 * settings change. Yesterday is included because at high latitudes its Isha
 * can still be ahead after midnight.
 */
export function usePrayerSchedule(): PrayerSchedule | null {
  const place = usePlace()
  const config = useCalculationConfig()
  const todayKey = useLocalToday()
  return useMemo(() => {
    if (!place) return null
    const days = [-1, 0, 1].map((offset) => prayerDayFor(shiftDateKey(todayKey, offset), place, config))
    return { todayKey, timeZone: place.timeZone, days, timeline: buildTimeline(days) }
  }, [place, config, todayKey])
}

export interface PrayerClock {
  now: Date
  schedule: PrayerSchedule | null
  next: UpcomingPrayer | null
  /** The prayer whose time it is now, if any. */
  current: UpcomingPrayer | null
}

/** Ticks every second; the timetable behind it is memoised and only looked up. */
export function usePrayerClock(): PrayerClock {
  const schedule = usePrayerSchedule()
  const now = useNow()
  return {
    now,
    schedule,
    next: schedule ? nextPrayerAt(schedule.timeline, now) : null,
    current: schedule ? currentPrayerAt(schedule.timeline, schedule.days, now) : null,
  }
}

/**
 * The next obligatory prayer from now, rolling over to tomorrow's Fajr after
 * Isha. Sunrise is never returned. `null` until a location is set, or when no
 * time can be computed.
 */
export function useNextPrayer(): UpcomingPrayer | null {
  return usePrayerClock().next
}
