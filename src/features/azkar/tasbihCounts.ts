import type { DateKey } from '../../shared/types'
import { MAX_LIFETIME_RECITATIONS, MAX_SESSION_RECITATIONS, pruneOlderThan, SESSION_DAYS } from './progressData'
import { withTally } from './readingCounts'
import type { TasbihDay, TasbihProgress, TasbihRecord } from './tasbihData'

/** What the tasbih counter counts: a preset's dhikr id, or `null` for a free count. */
export type TasbihSlot = string | null

export function tasbihRecordOf(day: TasbihDay | undefined, slot: TasbihSlot): TasbihRecord | undefined {
  if (!day) return undefined
  if (slot === null) return day.free
  return Object.hasOwn(day.presets, slot) ? day.presets[slot] : undefined
}

function withRecord(days: TasbihProgress['days'], dateKey: DateKey, slot: TasbihSlot, record: TasbihRecord | null) {
  const before = days[dateKey]
  const day: TasbihDay = { presets: { ...before?.presets } }
  if (before?.free) day.free = before.free
  if (slot === null) {
    if (record) day.free = record
    else delete day.free
  } else if (record) {
    day.presets[slot] = record
  } else {
    delete day.presets[slot]
  }

  const next = { ...days }
  if (Object.keys(day.presets).length > 0 || day.free) next[dateKey] = day
  else delete next[dateKey]
  return pruneOlderThan(next, dateKey, SESSION_DAYS)
}

function withLifetime(tasbih: TasbihProgress, slot: TasbihSlot, change: number): Pick<TasbihProgress, 'totals' | 'free'> {
  if (slot !== null) return { totals: withTally(tasbih.totals, slot, change), free: tasbih.free }
  return { totals: tasbih.totals, free: Math.min(MAX_LIFETIME_RECITATIONS, Math.max(0, tasbih.free + change)) }
}

/**
 * One count added (`+1`) or taken back (`-1`) on the counter of `slot` for `dateKey`, with the
 * day's record and the lifetime totals in step. A count can only be taken back while the
 * counter shows one. `null` when nothing changes. A record left with nothing counted goes.
 */
export function tasbihCounted(tasbih: TasbihProgress, dateKey: DateKey, slot: TasbihSlot, change: 1 | -1) {
  const previous = tasbihRecordOf(tasbih.days[dateKey], slot)
  const at = Date.now()
  let record: TasbihRecord | null
  if (change > 0) {
    if (previous && previous.count >= MAX_SESSION_RECITATIONS) return null
    record = previous
      ? { ...previous, lastAt: at, count: previous.count + 1, current: previous.current + 1 }
      : { startedAt: at, lastAt: at, count: 1, current: 1 }
  } else {
    if (!previous || previous.current === 0) return null
    record = { ...previous, lastAt: at, count: previous.count - 1, current: previous.current - 1 }
    if (record.count === 0) record = null
  }
  return { ...tasbih, days: withRecord(tasbih.days, dateKey, slot, record), ...withLifetime(tasbih, slot, change) }
}

/** Puts the counter of `slot` back to 0. What was counted that day stays counted. `null` when it shows 0 already. */
export function tasbihReset(tasbih: TasbihProgress, dateKey: DateKey, slot: TasbihSlot): TasbihProgress | null {
  const previous = tasbihRecordOf(tasbih.days[dateKey], slot)
  if (!previous || previous.current === 0) return null
  return { ...tasbih, days: withRecord(tasbih.days, dateKey, slot, { ...previous, current: 0 }) }
}
