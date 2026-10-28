import { daysBetween, isValidDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import { COLLECTION_IDS } from './data'
import type { CollectionId } from './data'
import type { Counts } from './session'

/** Per-dhikr counts let a session be resumed, and show how far each reading got. Kept for a month. */
export const DETAIL_DAYS = 30
/** Session records are the lasting log of the azkar: kept for about ten years. */
export const SESSION_DAYS = 3660

/** A stored count far beyond any real repeat count is not a count. */
export const MAX_STORED_COUNT = 10_000
const MAX_ID_LENGTH = 100
/** No session holds anywhere near this many azkar. */
const MAX_SESSION_SIZE = 1_000
/** Repetitions in one session on one day, every reading of it together. */
export const MAX_SESSION_RECITATIONS = 1_000_000
/** Lifetime repetitions of one dhikr, or of all of them. */
export const MAX_LIFETIME_RECITATIONS = 1_000_000_000_000
/** Times outside these years are a broken clock or a broken file, not a recitation. */
const EARLIEST_TIME = Date.UTC(2000, 0, 1)
const LATEST_TIME = Date.UTC(2200, 0, 1)

export type DayCounts = Partial<Record<CollectionId, Counts>>

/**
 * One session (morning, evening or bedtime) on one day. Times are milliseconds since the epoch.
 *
 * A record that has no `startedAt` was carried over from version 1 of the store, which kept
 * whether a session was completed but never when: its times stay unknown rather than guessed.
 */
export interface SessionRecord {
  /** The first count of the day's session. */
  startedAt?: number
  /** The latest count, or count taken back. */
  lastAt?: number
  /** When every dhikr reached its count. Only on a completed record, and only when the time is known. */
  completedAt?: number
  /**
   * Every dhikr reached its count that day. "Start over" keeps it. Taking back a count from a
   * session that is complete withdraws it, as version 1 did (see `applyCount` in progressStore).
   */
  completed: boolean
  /** Adhkar at their count in the day's current reading (back to 0 after "Start over"). */
  done: number
  /** Adhkar in the session when it was last counted. */
  total: number
  /** Repetitions counted that day, every reading together. A count taken back is subtracted. */
  recitations: number
}

export type DaySessions = Partial<Record<CollectionId, SessionRecord>>

export interface ProgressData {
  /** Counts per day, session and dhikr id. The last `DETAIL_DAYS` days only. */
  days: Record<DateKey, DayCounts>
  /** What was read on each day, kept long after the counts are pruned. */
  sessions: Record<DateKey, DaySessions>
  /** Lifetime repetitions per dhikr id, every session and day together. Never pruned. */
  totals: Record<string, number>
  /** Lifetime repetitions of all azkar together. Never pruned. */
  totalRecitations: number
}

export function emptyProgress(): ProgressData {
  return { days: {}, sessions: {}, totals: {}, totalRecitations: 0 }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWhole(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
}

function isInstant(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= EARLIEST_TIME && value < LATEST_TIME
}

function isDhikrId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_ID_LENGTH
}

/** Positive whole counts up to `max`, by id. `null` when none is left. */
function sanitizeTally(value: unknown, max: number): Record<string, number> | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value).filter(([id, count]) => isDhikrId(id) && isWhole(count, max) && count > 0)
  // fromEntries defines own properties, so an id such as "__proto__" stays inert.
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, number>) : null
}

function sanitizeDayCounts(value: unknown): DayCounts | null {
  if (!isRecord(value)) return null
  const day: DayCounts = {}
  for (const collection of COLLECTION_IDS) {
    const counts = Object.hasOwn(value, collection) ? sanitizeTally(value[collection], MAX_STORED_COUNT) : null
    if (counts) day[collection] = counts
  }
  return Object.keys(day).length > 0 ? day : null
}

/** Per-dhikr counts on real calendar days, for known sessions. Shared by both versions of the store. */
export function sanitizeDays(value: unknown): Record<DateKey, DayCounts> {
  const days: Record<DateKey, DayCounts> = {}
  if (!isRecord(value)) return days
  for (const key of Object.keys(value)) {
    if (!isValidDateKey(key)) continue
    const day = sanitizeDayCounts(value[key])
    if (day) days[key] = day
  }
  return days
}

/**
 * A record whose required fields are all sound, or `null`. A time that is not a plausible
 * instant is dropped on its own: the record then just does not say when.
 */
export function sanitizeRecord(value: unknown): SessionRecord | null {
  if (!isRecord(value)) return null
  const { completed, done, total, recitations } = value
  if (typeof completed !== 'boolean') return null
  if (!isWhole(total, MAX_SESSION_SIZE) || !isWhole(done, total)) return null
  if (!isWhole(recitations, MAX_SESSION_RECITATIONS)) return null

  const record: SessionRecord = { completed, done, total, recitations }
  if (isInstant(value.startedAt)) record.startedAt = value.startedAt
  if (isInstant(value.lastAt)) record.lastAt = value.lastAt
  if (completed && isInstant(value.completedAt)) record.completedAt = value.completedAt
  return record
}

function sanitizeDaySessions(value: unknown): DaySessions | null {
  if (!isRecord(value)) return null
  const day: DaySessions = {}
  for (const collection of COLLECTION_IDS) {
    const record = Object.hasOwn(value, collection) ? sanitizeRecord(value[collection]) : null
    if (record) day[collection] = record
  }
  return Object.keys(day).length > 0 ? day : null
}

export function sanitizeSessions(value: unknown): Record<DateKey, DaySessions> {
  const sessions: Record<DateKey, DaySessions> = {}
  if (!isRecord(value)) return sessions
  for (const key of Object.keys(value)) {
    if (!isValidDateKey(key)) continue
    const day = sanitizeDaySessions(value[key])
    if (day) sessions[key] = day
  }
  return sessions
}

export function sumOf(tally: Readonly<Record<string, number>>): number {
  return Object.values(tally).reduce((sum, count) => sum + count, 0)
}

/**
 * Keeps only what is certainly progress: real calendar days, known sessions, whole
 * counts in range, records with every required field. Stored data can come from an
 * imported or hand-edited backup, so anything else is dropped rather than repaired.
 * The lifetime total is never taken as less than the per-dhikr totals add up to.
 */
export function sanitizeProgress(value: unknown): ProgressData {
  const data = emptyProgress()
  if (!isRecord(value)) return data
  data.days = sanitizeDays(value.days)
  data.sessions = sanitizeSessions(value.sessions)
  data.totals = sanitizeTally(value.totals, MAX_LIFETIME_RECITATIONS) ?? {}
  const stored = isWhole(value.totalRecitations, MAX_LIFETIME_RECITATIONS) ? value.totalRecitations : 0
  data.totalRecitations = Math.max(stored, sumOf(data.totals))
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
