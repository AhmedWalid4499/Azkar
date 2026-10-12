import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { daysBetween, isValidDateKey } from '../../shared/date'
import { storageKey } from '../../shared/storage'
import type { DateKey } from '../../shared/types'
import { isCollectionId } from './collections'
import { COLLECTION_IDS, getCollection } from './data'
import type { CollectionId } from './data'
import { countOf, isDone, targetOf } from './session'
import type { Counts } from './session'

export const AZKAR_PROGRESS_STORAGE_KEY = storageKey('azkar-progress')
export const AZKAR_PROGRESS_VERSION = 1

/** Per-dhikr counts are only needed to resume a recent session. */
export const DETAIL_DAYS = 7
/** Completed sessions are kept for a little over a year. */
export const HISTORY_DAYS = 400

/** A stored count far beyond any real repeat count is not a count. */
const MAX_STORED_COUNT = 10_000
const MAX_ID_LENGTH = 100

export type DayCounts = Partial<Record<CollectionId, Counts>>

export interface ProgressData {
  /** Counts per day, session and dhikr id. Recent days only. */
  days: Record<DateKey, DayCounts>
  /** Sessions completed on each day, kept long after the counts are pruned. */
  history: Record<DateKey, CollectionId[]>
}

export interface ProgressState extends ProgressData {
  /** Counts one repetition, up to the dhikr's target. */
  increment: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /** Takes back one repetition. */
  decrement: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /** Sets a dhikr straight to its target. */
  complete: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /**
   * Clears a session's counts for one day and leaves the history as it is. A completion
   * recorded before the reset is not protected from then on, though: read the session to
   * the end again, undo that final count, and the day's record goes (see `applyCount`).
   */
  resetSession: (dateKey: DateKey, collection: CollectionId) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeCounts(value: unknown): Counts | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value).filter(
    ([id, count]) =>
      id.length > 0 &&
      id.length <= MAX_ID_LENGTH &&
      typeof count === 'number' &&
      Number.isInteger(count) &&
      count > 0 &&
      count <= MAX_STORED_COUNT,
  )
  // fromEntries defines own properties, so an id such as "__proto__" stays inert.
  return entries.length > 0 ? (Object.fromEntries(entries) as Counts) : null
}

function sanitizeDay(value: unknown): DayCounts | null {
  if (!isRecord(value)) return null
  const day: DayCounts = {}
  for (const collection of COLLECTION_IDS) {
    const counts = Object.hasOwn(value, collection) ? sanitizeCounts(value[collection]) : null
    if (counts) day[collection] = counts
  }
  return Object.keys(day).length > 0 ? day : null
}

/**
 * Keeps only what is certainly progress: real calendar days, known sessions,
 * positive whole counts. Stored data can come from an imported or hand-edited
 * backup, so anything else is dropped rather than repaired.
 */
export function sanitizeProgress(value: unknown): ProgressData {
  const data: ProgressData = { days: {}, history: {} }
  if (!isRecord(value)) return data

  if (isRecord(value.days)) {
    for (const key of Object.keys(value.days)) {
      if (!isValidDateKey(key)) continue
      const day = sanitizeDay(value.days[key])
      if (day) data.days[key] = day
    }
  }

  if (isRecord(value.history)) {
    for (const key of Object.keys(value.history)) {
      const list = value.history[key]
      if (!isValidDateKey(key) || !Array.isArray(list)) continue
      const sessions = COLLECTION_IDS.filter((id) => list.includes(id))
      if (sessions.length > 0) data.history[key] = sessions
    }
  }

  return data
}

/**
 * Drops entries more than `maxAgeDays` older than `reference`. Entries dated
 * after it are left alone: a device clock that was briefly wrong should not
 * cost anyone their history.
 */
export function pruneOlderThan<T>(
  entries: Record<DateKey, T>,
  reference: DateKey,
  maxAgeDays: number,
): Record<DateKey, T> {
  const keys = Object.keys(entries)
  const keep = keys.filter((key) => daysBetween(key, reference) <= maxAgeDays)
  if (keep.length === keys.length) return entries
  return Object.fromEntries(keep.map((key) => [key, entries[key] as T]))
}

function withCounts(
  days: ProgressData['days'],
  dateKey: DateKey,
  collection: CollectionId,
  counts: Counts | null,
): ProgressData['days'] {
  const day: DayCounts = { ...days[dateKey] }
  if (counts && Object.keys(counts).length > 0) day[collection] = counts
  else delete day[collection]

  const next = { ...days }
  if (Object.keys(day).length > 0) next[dateKey] = day
  else delete next[dateKey]
  return pruneOlderThan(next, dateKey, DETAIL_DAYS)
}

function withCompletion(
  history: ProgressData['history'],
  dateKey: DateKey,
  collection: CollectionId,
  completed: boolean,
): ProgressData['history'] {
  const current = history[dateKey] ?? []
  if (current.includes(collection) === completed) return history

  const sessions = COLLECTION_IDS.filter((id) => (id === collection ? completed : current.includes(id)))
  const next = { ...history }
  if (sessions.length > 0) next[dateKey] = sessions
  else delete next[dateKey]
  return pruneOlderThan(next, dateKey, HISTORY_DAYS)
}

/**
 * Applies `change` to one dhikr's count. The history follows the counting: the
 * session is recorded the moment its last dhikr reaches its target, and
 * withdrawn again when a count is taken back from a complete session. Counts
 * that leave the session as complete or as incomplete as it was do not touch
 * the history, so reading it a second time after "Start over" keeps the first
 * completion on record while that reading is under way.
 *
 * A day holds one record per session, with nothing to say which reading earned
 * it. So once a second reading has itself reached the end, undoing its final
 * count withdraws the record, the first reading's completion with it, and
 * counting that step again restores it.
 */
function applyCount(
  state: ProgressState,
  dateKey: DateKey,
  collection: CollectionId,
  dhikrId: string,
  change: (count: number, target: number) => number,
): ProgressState | ProgressData {
  if (!isValidDateKey(dateKey) || !isCollectionId(collection)) return state
  const items = getCollection(collection)
  const dhikr = items.find((item) => item.id === dhikrId)
  if (!dhikr) return state

  const current = state.days[dateKey]?.[collection]
  const target = targetOf(dhikr)
  const before = countOf(dhikr, current)
  const after = Math.min(target, Math.max(0, Math.trunc(change(before, target))))
  if (after === before) return state

  const counts: Record<string, number> = { ...current }
  if (after === 0) delete counts[dhikrId]
  else counts[dhikrId] = after

  const wasComplete = items.every((item) => isDone(item, current))
  const completed = items.every((item) => isDone(item, counts))
  return {
    days: withCounts(state.days, dateKey, collection, counts),
    history:
      completed === wasComplete ? state.history : withCompletion(state.history, dateKey, collection, completed),
  }
}

export const useAzkarProgress = create<ProgressState>()(
  persist(
    (set) => ({
      days: {},
      history: {},
      increment: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, (count) => count + 1)),
      decrement: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, (count) => count - 1)),
      complete: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, (_count, target) => target)),
      resetSession: (dateKey, collection) =>
        set((state) => {
          if (!state.days[dateKey]?.[collection]) return state
          return { days: withCounts(state.days, dateKey, collection, null) }
        }),
    }),
    {
      name: AZKAR_PROGRESS_STORAGE_KEY,
      version: AZKAR_PROGRESS_VERSION,
      partialize: (state): ProgressData => ({ days: state.days, history: state.history }),
      // Version 1 is the only shape so far. Data stamped with any other version
      // (a backup from a newer build, say) is read as far as it can be understood.
      migrate: (persisted) => sanitizeProgress(persisted),
      // Validated on every load, whatever version the data claims to be.
      merge: (persisted, current) =>
        persisted === undefined ? current : { ...current, ...sanitizeProgress(persisted) },
    },
  ),
)

/** One session's counts for a day, or `undefined` when nothing is counted yet. */
export function useSessionCounts(dateKey: DateKey, collection: CollectionId): Counts | undefined {
  return useAzkarProgress((state) => state.days[dateKey]?.[collection])
}

/** Reads the latest counts outside React, e.g. right after writing one. */
export function readSessionCounts(dateKey: DateKey, collection: CollectionId): Counts | undefined {
  return useAzkarProgress.getState().days[dateKey]?.[collection]
}
