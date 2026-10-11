import { useMemo } from 'react'
import { dateKeyInZone, shiftDateKey, zonedParts } from '../../shared/date'
import { useActiveTimeZone, useNow } from '../../shared/time'
import type { DateKey, PrayerDay } from '../../shared/types'
import { usePrayerDay } from '../prayer-times'
import type { CollectionId } from './data'

/**
 * The part of the day, as far as the adhkar are concerned:
 *
 * - `beforeDawn`  midnight until Fajr — still last night
 * - `morning`     Fajr until Dhuhr
 * - `midday`      Dhuhr until Asr
 * - `evening`     Asr until midnight
 */
export type DayPhase = 'beforeDawn' | 'morning' | 'midday' | 'evening'

/** Stand-ins for Fajr, Dhuhr and Asr (local hour) while no location is saved. */
const FALLBACK_HOUR = { fajr: 4, dhuhr: 12, asr: 15 } as const

function isInstant(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * Uses the day's real prayer times when they are known and belong to `today`;
 * otherwise falls back to fixed clock hours. Times that could not be computed
 * (extreme latitudes) also take the fallback.
 */
export function dayPhase(now: Date, timeZone: string, prayerDay: PrayerDay | null): DayPhase {
  const today = dateKeyInZone(now, timeZone)
  const times = prayerDay?.dateKey === today ? prayerDay.times : undefined
  if (times && isInstant(times.fajr) && isInstant(times.dhuhr) && isInstant(times.asr)) {
    const at = now.getTime()
    if (at < times.fajr.getTime()) return 'beforeDawn'
    if (at < times.dhuhr.getTime()) return 'morning'
    if (at < times.asr.getTime()) return 'midday'
    return 'evening'
  }
  const { hour } = zonedParts(now, timeZone)
  if (hour < FALLBACK_HOUR.fajr) return 'beforeDawn'
  if (hour < FALLBACK_HOUR.dhuhr) return 'morning'
  if (hour < FALLBACK_HOUR.asr) return 'midday'
  return 'evening'
}

/**
 * Recommendation rule: the morning adhkar from Fajr until around Dhuhr, the
 * evening adhkar from Asr until the night ends at the next Fajr. Between Dhuhr
 * and Asr neither is singled out. Bedtime adhkar are never recommended by the
 * clock; people sleep at very different hours.
 */
export function recommendedCollection(phase: DayPhase): CollectionId | null {
  if (phase === 'morning') return 'morning'
  if (phase === 'midday') return null
  return 'evening'
}

/**
 * The day a session's progress is filed under. The night does not end at
 * midnight: evening or bedtime adhkar read at 1 am belong to the evening that
 * began the day before, so they continue that day's session instead of using
 * up the coming evening's. The morning session follows the calendar day.
 */
export function sessionDateKey(collection: CollectionId, today: DateKey, phase: DayPhase): DateKey {
  return collection !== 'morning' && phase === 'beforeDawn' ? shiftDateKey(today, -1) : today
}

export interface AzkarClock {
  today: DateKey
  phase: DayPhase
  recommended: CollectionId | null
}

export function useAzkarClock(): AzkarClock {
  const timeZone = useActiveTimeZone()
  const now = useNow(15_000)
  const prayerDay = usePrayerDay()
  const today = dateKeyInZone(now, timeZone)
  const phase = dayPhase(now, timeZone, prayerDay)
  return useMemo(() => ({ today, phase, recommended: recommendedCollection(phase) }), [today, phase])
}

/** The day whose counts a session shows right now. */
export function useSessionDay(collection: CollectionId): DateKey {
  const { today, phase } = useAzkarClock()
  return sessionDateKey(collection, today, phase)
}
