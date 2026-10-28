import type { DateKey } from '../../shared/types'
import {
  isDhikrId,
  isInstant,
  isRecord,
  isWhole,
  MAX_LIFETIME_RECITATIONS,
  MAX_SESSION_RECITATIONS,
  sanitizeDated,
  sanitizeTally,
} from './progressData'

/**
 * One preset (or the free count) on one day. Times are milliseconds since the epoch; one is
 * missing only where a stored time was not a plausible instant and was dropped on loading.
 */
export interface TasbihRecord {
  /** The first count of the day. */
  startedAt?: number
  /** The latest count, or count taken back. */
  lastAt?: number
  /** Counted that day, every round together. A count taken back is subtracted; "Reset" is not. */
  count: number
  /** What the counter shows now: back to 0 after "Reset". Never more than `count`. */
  current: number
}

export interface TasbihDay {
  /** By preset: a dhikr id of the dataset's tasbih list. */
  presets: Record<string, TasbihRecord>
  /** Counted freely, with no dhikr chosen. */
  free?: TasbihRecord
}

/** The tasbih counter. Added in version 3 of the store. */
export interface TasbihProgress {
  /** What was counted on each day, kept as long as the session records. */
  days: Record<DateKey, TasbihDay>
  /** Lifetime count per preset. Never pruned. */
  totals: Record<string, number>
  /** Lifetime free count. Never pruned. */
  free: number
}

export function emptyTasbih(): TasbihProgress {
  return { days: {}, totals: {}, free: 0 }
}

/** A record whose counts are sound, or `null`. A time that is not a plausible instant is dropped on its own. */
export function sanitizeTasbihRecord(value: unknown): TasbihRecord | null {
  if (!isRecord(value)) return null
  const { count, current } = value
  if (!isWhole(count, MAX_SESSION_RECITATIONS) || count === 0 || !isWhole(current, count)) return null
  const record: TasbihRecord = { count, current }
  if (isInstant(value.startedAt)) record.startedAt = value.startedAt
  if (isInstant(value.lastAt)) record.lastAt = value.lastAt
  return record
}

function sanitizeTasbihDay(value: unknown): TasbihDay | null {
  if (!isRecord(value)) return null
  const presets = isRecord(value.presets) ? value.presets : {}
  const entries = Object.keys(presets).flatMap((id) => {
    const record = isDhikrId(id) ? sanitizeTasbihRecord(presets[id]) : null
    return record ? [[id, record] as const] : []
  })
  const free = sanitizeTasbihRecord(value.free)
  if (entries.length === 0 && !free) return null
  // fromEntries defines own properties, so an id such as "__proto__" stays inert.
  const day: TasbihDay = { presets: Object.fromEntries(entries) }
  if (free) day.free = free
  return day
}

/** Keeps what is certainly tasbih progress, as `sanitizeProgress` does for the sessions. */
export function sanitizeTasbih(value: unknown): TasbihProgress {
  const data = emptyTasbih()
  if (!isRecord(value)) return data
  data.days = sanitizeDated(value.days, sanitizeTasbihDay)
  data.totals = sanitizeTally(value.totals, MAX_LIFETIME_RECITATIONS) ?? {}
  data.free = isWhole(value.free, MAX_LIFETIME_RECITATIONS) ? value.free : 0
  return data
}

/** Everything counted on a day, presets and free count together. */
export function tasbihDayCount(day: TasbihDay | undefined): number {
  if (!day) return 0
  return Object.values(day.presets).reduce((sum, record) => sum + record.count, day.free?.count ?? 0)
}
