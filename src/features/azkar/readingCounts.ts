import type { DateKey } from '../../shared/types'
import type { Dhikr } from './data'
import { DETAIL_DAYS, MAX_LIFETIME_RECITATIONS, MAX_SESSION_RECITATIONS, pruneOlderThan, SESSION_DAYS } from './progressData'
import type { SessionRecord } from './progressData'
import { countOf, isDone, summarize, targetOf } from './session'
import type { Counts } from './session'

/**
 * Counting in the reader, shared by the sessions of the day (keyed by collection) and the
 * azkar after the prayers (keyed by prayer): per-dhikr counts that let a reading be resumed,
 * and one record per key and day.
 */
export interface Readings<K extends string> {
  days: Record<DateKey, Partial<Record<K, Counts>>>
  sessions: Record<DateKey, Partial<Record<K, SessionRecord>>>
}

export interface Counted<K extends string> extends Readings<K> {
  /** Repetitions added (positive) or taken back (negative). Never 0. */
  change: number
}

function withEntry<K extends string, V>(
  entries: Record<DateKey, Partial<Record<K, V>>>,
  dateKey: DateKey,
  key: K,
  value: V | null,
  maxAgeDays: number,
): Record<DateKey, Partial<Record<K, V>>> {
  const day: Partial<Record<K, V>> = { ...entries[dateKey] }
  if (value !== null) day[key] = value
  else delete day[key]

  const next = { ...entries }
  if (Object.keys(day).length > 0) next[dateKey] = day
  else delete next[dateKey]
  return pruneOlderThan(next, dateKey, maxAgeDays)
}

function withCounts<K extends string>(days: Readings<K>['days'], dateKey: DateKey, key: K, counts: Counts | null) {
  return withEntry(days, dateKey, key, counts && Object.keys(counts).length > 0 ? counts : null, DETAIL_DAYS)
}

function withRecord<K extends string>(
  sessions: Readings<K>['sessions'],
  dateKey: DateKey,
  key: K,
  record: SessionRecord | null,
) {
  return withEntry(sessions, dateKey, key, record, SESSION_DAYS)
}

/** A lifetime tally after `change` to one id, never below zero; the same object when nothing changes. */
export function withTally(tally: Record<string, number>, id: string, change: number): Record<string, number> {
  const before = Object.hasOwn(tally, id) ? (tally[id] ?? 0) : 0
  const after = Math.min(MAX_LIFETIME_RECITATIONS, Math.max(0, before + change))
  if (after === before) return tally
  const next = { ...tally }
  if (after === 0) delete next[id]
  else next[id] = after
  return next
}

interface CountChange {
  at: number
  /** Repetitions added (positive) or taken back (negative). */
  change: number
  done: number
  total: number
  wasComplete: boolean
  completed: boolean
  /** Nothing is left counted for the reading on that day. */
  empty: boolean
}

/**
 * The day's record after one count changed. `completed` follows the counting the way
 * version 1's history did: set the moment the last dhikr reaches its target, withdrawn
 * when a count is taken back from a complete reading, and otherwise left alone. So a
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
 * Applies `change` to one dhikr's count in the reading `key` of `items` on `dateKey`, and keeps
 * the day's record in step with it. `null` when the dhikr is not in `items` or its count stays
 * as it was.
 *
 * A day holds one record per reading, with nothing to say which reading earned its
 * completion. So once a second reading has itself reached the end, undoing its final
 * count withdraws the completion, the first reading's with it, and counting that step
 * again restores it, timed at that moment.
 */
export function countIn<K extends string>(
  readings: Readings<K>,
  dateKey: DateKey,
  key: K,
  items: readonly Dhikr[],
  dhikrId: string,
  change: (count: number, target: number) => number,
): Counted<K> | null {
  const dhikr = items.find((item) => item.id === dhikrId)
  if (!dhikr) return null

  const current = readings.days[dateKey]?.[key]
  const target = targetOf(dhikr)
  const before = countOf(dhikr, current)
  const after = Math.min(target, Math.max(0, Math.trunc(change(before, target))))
  if (after === before) return null

  const counts: Record<string, number> = { ...current }
  if (after === 0) delete counts[dhikrId]
  else counts[dhikrId] = after

  const record = countedRecord(readings.sessions[dateKey]?.[key], {
    at: Date.now(),
    change: after - before,
    done: summarize(items, counts).done,
    total: items.length,
    wasComplete: items.every((item) => isDone(item, current)),
    completed: items.every((item) => isDone(item, counts)),
    empty: Object.keys(counts).length === 0,
  })
  return {
    days: withCounts(readings.days, dateKey, key, counts),
    sessions: withRecord(readings.sessions, dateKey, key, record),
    change: after - before,
  }
}

/**
 * Clears a reading's counts for one day. Its record keeps its completion and its recitations;
 * its `done` goes back to 0 with the counts. `null` when nothing was counted.
 */
export function resetIn<K extends string>(readings: Readings<K>, dateKey: DateKey, key: K): Readings<K> | null {
  if (!readings.days[dateKey]?.[key]) return null
  const record = readings.sessions[dateKey]?.[key]
  return {
    days: withCounts(readings.days, dateKey, key, null),
    sessions:
      record && record.done !== 0 ? withRecord(readings.sessions, dateKey, key, { ...record, done: 0 }) : readings.sessions,
  }
}
