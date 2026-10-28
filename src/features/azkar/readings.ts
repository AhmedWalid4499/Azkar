import { useMemo } from 'react'
import type { DateKey, PrayerName } from '../../shared/types'
import { getAfterPrayerAzkar, getCollection } from './data'
import type { CollectionId, Dhikr } from './data'
import type { SessionRecord } from './progressData'
import { useAzkarProgress } from './progressStore'
import type { AzkarProgressData } from './progressStore'
import { summarize } from './session'
import type { Counts } from './session'
import type { Session } from './useSession'

/** What the reader reads: a session of the day, or the azkar after one prayer. */
export type Reading = { kind: 'session'; collection: CollectionId } | { kind: 'afterPrayer'; prayer: PrayerName }

/** Stable and distinct for every reading, for keys. */
export function readingKey(reading: Reading): string {
  return reading.kind === 'session' ? reading.collection : `after-${reading.prayer}`
}

const interned = new Map<string, Reading>()

/** The one object for this reading, so that it can be a hook's dependency. */
function intern(reading: Reading): Reading {
  const key = readingKey(reading)
  const known = interned.get(key)
  if (known) return known
  interned.set(key, reading)
  return reading
}

export function sessionReading(collection: CollectionId): Reading {
  return intern({ kind: 'session', collection })
}

export function afterPrayerReading(prayer: PrayerName): Reading {
  return intern({ kind: 'afterPrayer', prayer })
}

export function readingItems(reading: Reading): Dhikr[] {
  return reading.kind === 'session' ? getCollection(reading.collection) : getAfterPrayerAzkar(reading.prayer)
}

export function countsOf(state: AzkarProgressData, reading: Reading, dateKey: DateKey): Counts | undefined {
  return reading.kind === 'session'
    ? state.days[dateKey]?.[reading.collection]
    : state.afterPrayer.days[dateKey]?.[reading.prayer]
}

export function recordOf(state: AzkarProgressData, reading: Reading, dateKey: DateKey): SessionRecord | undefined {
  return reading.kind === 'session'
    ? state.sessions[dateKey]?.[reading.collection]
    : state.afterPrayer.sessions[dateKey]?.[reading.prayer]
}

export interface ReadingActions {
  increment: (dhikrId: string) => void
  decrement: (dhikrId: string) => void
  complete: (dhikrId: string) => void
  reset: () => void
  /** The latest counts, read outside React (right after writing one, say). */
  counts: () => Counts | undefined
}

/** The store's actions for one reading on one day. The store's actions never change, so none of this subscribes. */
export function readingActions(reading: Reading, dateKey: DateKey): ReadingActions {
  const store = useAzkarProgress.getState()
  const counts = () => countsOf(useAzkarProgress.getState(), reading, dateKey)
  if (reading.kind === 'session') {
    const { collection } = reading
    return {
      increment: (id) => store.increment(dateKey, collection, id),
      decrement: (id) => store.decrement(dateKey, collection, id),
      complete: (id) => store.complete(dateKey, collection, id),
      reset: () => store.resetSession(dateKey, collection),
      counts,
    }
  }
  const { prayer } = reading
  return {
    increment: (id) => store.incrementAfterPrayer(dateKey, prayer, id),
    decrement: (id) => store.decrementAfterPrayer(dateKey, prayer, id),
    complete: (id) => store.completeAfterPrayer(dateKey, prayer, id),
    reset: () => store.resetAfterPrayer(dateKey, prayer),
    counts,
  }
}

/** A reading's azkar with the counts recorded for `dateKey`. Pass a reading from `sessionReading` or `afterPrayerReading`. */
export function useReading(reading: Reading, dateKey: DateKey): Session {
  const items = useMemo(() => readingItems(reading), [reading])
  const counts = useAzkarProgress((state) => countsOf(state, reading, dateKey))
  const summary = useMemo(() => summarize(items, counts), [items, counts])
  return { items, counts, summary }
}

/** A reading's record for a day, or `undefined` when it was not read that day. */
export function useReadingRecord(reading: Reading, dateKey: DateKey): SessionRecord | undefined {
  return useAzkarProgress((state) => recordOf(state, reading, dateKey))
}
