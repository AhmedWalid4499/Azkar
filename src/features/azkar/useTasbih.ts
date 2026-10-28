import { useMemo } from 'react'
import type { DateKey } from '../../shared/types'
import { useAzkarClock } from './clock'
import { useAzkarProgress } from './progressStore'
import type { TasbihDay } from './tasbihData'
import { tasbihDateKey, tasbihInRange, tasbihLifetime } from './tasbihTracking'
import type { DatedTasbih, TasbihLifetime } from './tasbihTracking'

/** The day a tasbih count made now is filed under: today, or yesterday until Fajr. */
export function useTasbihDateKey(): DateKey {
  const { today, phase } = useAzkarClock()
  return tasbihDateKey(today, phase)
}

/** What was counted on one day, or `undefined` when nothing was. */
export function useTasbihDay(dateKey: DateKey): TasbihDay | undefined {
  return useAzkarProgress((state) => state.tasbih.days[dateKey])
}

/** Days from `from` to `to`, both included, on which anything was counted; oldest first. */
export function useTasbihInRange(from: DateKey, to: DateKey): DatedTasbih[] {
  const days = useAzkarProgress((state) => state.tasbih.days)
  return useMemo(() => tasbihInRange(days, from, to), [days, from, to])
}

/** Every count of the tasbih counter, by preset and free. */
export function useTasbihLifetime(): TasbihLifetime {
  const tasbih = useAzkarProgress((state) => state.tasbih)
  return useMemo(() => tasbihLifetime(tasbih), [tasbih])
}
