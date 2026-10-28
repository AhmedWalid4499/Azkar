import { isValidDateKey, shiftDateKey } from '../../shared/date'
import type { DateKey } from '../../shared/types'
import type { DayPhase } from './clock'
import { sessionDateKey } from './clock'
import { tasbihDayCount } from './tasbihData'
import type { TasbihDay, TasbihProgress } from './tasbihData'
import { dhikrTotals } from './tracking'
import type { DhikrTotal } from './tracking'

/**
 * The day a tasbih count is filed under: today, or yesterday until Fajr, as the evening and
 * bedtime azkar are, so a count kept up past midnight stays one day's.
 */
export function tasbihDateKey(today: DateKey, phase: DayPhase): DateKey {
  return sessionDateKey('evening', today, phase)
}

export interface DatedTasbih {
  dateKey: DateKey
  day: TasbihDay
  /** Everything counted that day, presets and free count together. */
  count: number
}

/** Days from `from` to `to`, both included, on which anything was counted; oldest first. */
export function tasbihInRange(days: TasbihProgress['days'], from: DateKey, to: DateKey): DatedTasbih[] {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return []
  return Object.keys(days)
    .filter((key) => isValidDateKey(key) && key >= from && key <= to)
    .sort()
    .flatMap((dateKey) => {
      const day = days[dateKey]
      return day ? [{ dateKey, day, count: tasbihDayCount(day) }] : []
    })
}

export interface TasbihLifetime {
  /** Every count, presets and free count together. */
  count: number
  /** Counted freely, with no dhikr chosen. */
  free: number
  /** By preset, most counted first (`recitations` is the count). */
  byPreset: DhikrTotal[]
  /** Days on which anything was counted, over every day still kept. */
  days: number
}

export function tasbihLifetime(data: TasbihProgress): TasbihLifetime {
  const byPreset = dhikrTotals(data.totals)
  return {
    count: byPreset.reduce((sum, row) => sum + row.recitations, data.free),
    free: data.free,
    byPreset,
    days: Object.keys(data.days).filter(isValidDateKey).length,
  }
}

/** Everything counted over the last `days` calendar days, today included. */
export function tasbihCountSince(data: TasbihProgress, today: DateKey, days: number): number {
  if (!isValidDateKey(today) || days <= 0) return 0
  const from = shiftDateKey(today, -(Math.floor(days) - 1))
  return tasbihInRange(data.days, from, today).reduce((sum, entry) => sum + entry.count, 0)
}
