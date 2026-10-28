import { isValidDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import { COLLECTION_IDS, getCollection } from './data'
import type { CollectionId } from './data'
import {
  emptyProgress,
  isRecord,
  MAX_LIFETIME_RECITATIONS,
  MAX_SESSION_RECITATIONS,
  sanitizeDays,
  sumOf,
} from './progressData'
import type { DayCounts, DaySessions, ProgressData, SessionRecord } from './progressData'
import { summarize } from './session'

/**
 * Version 1 of the store: per-dhikr counts for about a week, and the sessions
 * completed on each day for a little over a year.
 */
export interface ProgressDataV1 {
  days: Record<DateKey, DayCounts>
  history: Record<DateKey, CollectionId[]>
}

/** Reads a version 1 payload exactly as version 1 itself validated it. */
export function sanitizeProgressV1(value: unknown): ProgressDataV1 {
  const data: ProgressDataV1 = { days: {}, history: {} }
  if (!isRecord(value)) return data
  data.days = sanitizeDays(value.days)
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
 * The completed sessions in version 1's `history` shape. Version 2 stores this beside its own
 * data and never reads it: a version 1 build that opens version 2 data (a rolled-back deploy,
 * a tab still running the old code) reads `history` and nothing else, and saves only what it
 * read, so without it every completion would be gone. With it, they come back when version 2
 * migrates what that build saved.
 */
export function toVersion1History(sessions: ProgressData['sessions']): ProgressDataV1['history'] {
  const history: ProgressDataV1['history'] = {}
  for (const [dateKey, day] of Object.entries(sessions)) {
    const completed = COLLECTION_IDS.filter((collection) => day[collection]?.completed === true)
    if (completed.length > 0) history[dateKey] = completed
  }
  return history
}

/**
 * Builds version 2 from a version 1 payload, keeping everything it held:
 *
 * - the counts stay as they are;
 * - every day with counts or a completion gets a session record. Version 1 kept no
 *   times, so these records have none, and a completed one has no `completedAt`;
 * - a completed day whose counts were already pruned is known to have had every dhikr
 *   done, but not how often each was counted, so its `recitations` is 0;
 * - the lifetime totals start from the counts that were still kept.
 */
export function migrateProgressV1(value: unknown): ProgressData {
  const old = sanitizeProgressV1(value)
  const data = emptyProgress()
  data.days = old.days
  const totals = new Map<string, number>()

  const dateKeys = new Set([...Object.keys(old.days), ...Object.keys(old.history)])
  for (const dateKey of [...dateKeys].sort()) {
    const day: DaySessions = {}
    for (const collection of COLLECTION_IDS) {
      const counts = old.days[dateKey]?.[collection]
      const completed = old.history[dateKey]?.includes(collection) ?? false
      if (!counts && !completed) continue

      const items = getCollection(collection)
      const record: SessionRecord = {
        completed,
        done: counts ? summarize(items, counts).done : completed ? items.length : 0,
        total: items.length,
        recitations: counts ? Math.min(MAX_SESSION_RECITATIONS, sumOf(counts)) : 0,
      }
      day[collection] = record

      for (const [id, count] of Object.entries(counts ?? {})) {
        totals.set(id, Math.min(MAX_LIFETIME_RECITATIONS, (totals.get(id) ?? 0) + count))
      }
    }
    if (Object.keys(day).length > 0) data.sessions[dateKey] = day
  }
  // fromEntries defines own properties, so an id such as "__proto__" stays inert.
  data.totals = Object.fromEntries(totals)
  data.totalRecitations = sumOf(data.totals)
  return data
}
