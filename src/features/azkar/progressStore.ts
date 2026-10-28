import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isValidDateKey } from '../../shared/date'
import { storageKey } from '../../shared/storage'
import type { DateKey } from '../../shared/types'
import { isCollectionId } from './collections'
import { getCollection } from './data'
import type { CollectionId } from './data'
import {
  DETAIL_DAYS,
  isRecord,
  MAX_LIFETIME_RECITATIONS,
  MAX_SESSION_RECITATIONS,
  pruneOlderThan,
  sanitizeProgress,
  SESSION_DAYS,
} from './progressData'
import type { DayCounts, DaySessions, ProgressData, SessionRecord } from './progressData'
import { migrateProgressV1, toVersion1History } from './progressV1'
import type { ProgressDataV1 } from './progressV1'
import { countOf, isDone, summarize, targetOf } from './session'
import type { Counts } from './session'

export { DETAIL_DAYS, pruneOlderThan, sanitizeProgress, SESSION_DAYS } from './progressData'
export type { DayCounts, DaySessions, ProgressData, SessionRecord } from './progressData'

export const AZKAR_PROGRESS_STORAGE_KEY = storageKey('azkar-progress')
/** 2: session records with times, lifetime totals, counts kept for 30 days instead of 7. */
export const AZKAR_PROGRESS_VERSION = 2

/** What is saved: the data, and its completions again in version 1's shape (see `toVersion1History`). */
export type StoredProgress = ProgressData & Pick<ProgressDataV1, 'history'>

export interface ProgressState extends ProgressData {
  /** Counts one repetition, up to the dhikr's target. */
  increment: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /** Takes back one repetition. */
  decrement: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /** Sets a dhikr straight to its target. */
  complete: (dateKey: DateKey, collection: CollectionId, dhikrId: string) => void
  /**
   * Clears a session's counts for one day. The day's record keeps its completion and its
   * recitations, and its `done` goes back to 0 with the counts. A completion recorded before
   * the reset is not protected from then on, though: read the session to the end again,
   * undo that final count, and the completion goes (see `applyCount`).
   */
  resetSession: (dateKey: DateKey, collection: CollectionId) => void
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

function withRecord(
  sessions: ProgressData['sessions'],
  dateKey: DateKey,
  collection: CollectionId,
  record: SessionRecord | null,
): ProgressData['sessions'] {
  const day: DaySessions = { ...sessions[dateKey] }
  if (record) day[collection] = record
  else delete day[collection]

  const next = { ...sessions }
  if (Object.keys(day).length > 0) next[dateKey] = day
  else delete next[dateKey]
  return pruneOlderThan(next, dateKey, SESSION_DAYS)
}

function withRecitations(
  state: ProgressData,
  dhikrId: string,
  change: number,
): Pick<ProgressData, 'totals' | 'totalRecitations'> {
  const before = Object.hasOwn(state.totals, dhikrId) ? (state.totals[dhikrId] ?? 0) : 0
  const after = Math.min(MAX_LIFETIME_RECITATIONS, Math.max(0, before + change))
  if (after === before) return { totals: state.totals, totalRecitations: state.totalRecitations }

  const totals = { ...state.totals }
  if (after === 0) delete totals[dhikrId]
  else totals[dhikrId] = after
  const totalRecitations = Math.min(
    MAX_LIFETIME_RECITATIONS,
    Math.max(0, state.totalRecitations + after - before),
  )
  return { totals, totalRecitations }
}

interface CountChange {
  at: number
  /** Repetitions added (positive) or taken back (negative). */
  change: number
  done: number
  total: number
  wasComplete: boolean
  completed: boolean
  /** Nothing is left counted for the session on that day. */
  empty: boolean
}

/**
 * The day's record after one count changed. `completed` follows the counting the way
 * version 1's history did: set the moment the last dhikr reaches its target, withdrawn
 * when a count is taken back from a complete session, and otherwise left alone. So a
 * second reading after "Start over" keeps the first completion, and its time, while it
 * is under way. A record that has nothing left to tell (a tap taken straight back) goes.
 */
function countedRecord(previous: SessionRecord | undefined, count: CountChange): SessionRecord | null {
  const { at, change, done, total, wasComplete, completed, empty } = count
  const record: SessionRecord = previous
    ? { ...previous }
    : { startedAt: at, completed: false, done: 0, total, recitations: 0 }
  record.lastAt = at
  record.done = done
  record.total = total
  record.recitations = Math.min(MAX_SESSION_RECITATIONS, Math.max(0, record.recitations + change))

  if (completed !== wasComplete) {
    if (!completed) {
      record.completed = false
      delete record.completedAt
    } else if (!record.completed) {
      record.completed = true
      record.completedAt = at
    }
  }
  return !record.completed && record.recitations === 0 && empty ? null : record
}

/**
 * Applies `change` to one dhikr's count, and keeps the day's session record and the
 * lifetime totals in step with it.
 *
 * A day holds one record per session, with nothing to say which reading earned its
 * completion. So once a second reading has itself reached the end, undoing its final
 * count withdraws the completion, the first reading's with it, and counting that step
 * again restores it, timed at that moment.
 */
function applyCount(
  state: ProgressState,
  dateKey: DateKey,
  collection: CollectionId,
  dhikrId: string,
  change: (count: number, target: number) => number,
): Partial<ProgressData> {
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

  const record = countedRecord(state.sessions[dateKey]?.[collection], {
    at: Date.now(),
    change: after - before,
    done: summarize(items, counts).done,
    total: items.length,
    wasComplete: items.every((item) => isDone(item, current)),
    completed: items.every((item) => isDone(item, counts)),
    empty: Object.keys(counts).length === 0,
  })
  return {
    days: withCounts(state.days, dateKey, collection, counts),
    sessions: withRecord(state.sessions, dateKey, collection, record),
    ...withRecitations(state, dhikrId, after - before),
  }
}

function applyReset(state: ProgressState, dateKey: DateKey, collection: CollectionId): Partial<ProgressData> {
  if (!state.days[dateKey]?.[collection]) return state
  const record = state.sessions[dateKey]?.[collection]
  return {
    days: withCounts(state.days, dateKey, collection, null),
    sessions:
      record && record.done !== 0
        ? withRecord(state.sessions, dateKey, collection, { ...record, done: 0 })
        : state.sessions,
  }
}

/** Version 1's completions lived in `history`; version 2 has `sessions` instead. */
function hasSessions(value: unknown): boolean {
  return isRecord(value) && isRecord(value.sessions)
}

function hasVersion1Shape(value: unknown): boolean {
  return isRecord(value) && isRecord(value.history) && !hasSessions(value)
}

/**
 * The shape decides before the stamp, so that no stamp can cost a record: data with
 * `sessions` is read as version 2 whatever its stamp, and data with `history` and no
 * `sessions` as version 1 (a hand-edited backup with no version, say). Otherwise anything
 * stamped older than version 2 is version 1, and data stamped with a newer version (a
 * backup from a newer build) is read as far as it can be understood.
 */
function readProgress(persisted: unknown, version?: number): ProgressData {
  if (hasSessions(persisted)) return sanitizeProgress(persisted)
  if ((version !== undefined && version < 2) || hasVersion1Shape(persisted)) return migrateProgressV1(persisted)
  return sanitizeProgress(persisted)
}

export const useAzkarProgress = create<ProgressState>()(
  persist(
    (set) => ({
      days: {},
      sessions: {},
      totals: {},
      totalRecitations: 0,
      increment: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, (count) => count + 1)),
      decrement: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, (count) => count - 1)),
      complete: (dateKey, collection, dhikrId) =>
        set((state) => applyCount(state, dateKey, collection, dhikrId, (_count, target) => target)),
      resetSession: (dateKey, collection) => set((state) => applyReset(state, dateKey, collection)),
    }),
    {
      name: AZKAR_PROGRESS_STORAGE_KEY,
      version: AZKAR_PROGRESS_VERSION,
      partialize: (state): StoredProgress => ({
        days: state.days,
        sessions: state.sessions,
        totals: state.totals,
        totalRecitations: state.totalRecitations,
        history: toVersion1History(state.sessions),
      }),
      migrate: readProgress,
      // Validated on every load, whatever version the data claims to be.
      merge: (persisted, current) => (persisted === undefined ? current : { ...current, ...readProgress(persisted) }),
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

/** One session's record for a day, or `undefined` when it was not read that day. */
export function useSessionRecord(dateKey: DateKey, collection: CollectionId): SessionRecord | undefined {
  return useAzkarProgress((state) => state.sessions[dateKey]?.[collection])
}
