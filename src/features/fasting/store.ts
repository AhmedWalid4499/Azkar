import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { dateKeyInZone, deviceTimeZone, isValidDateKey } from '../../shared/date'
import { useLocationStore } from '../../shared/location'
import { storageKey } from '../../shared/storage'
import type { DateKey } from '../../shared/types'
import { sanitizeFasting, sanitizeOwedBefore } from './sanitize'
import type { PersistedFasting } from './sanitize'
import { isFastKind, isFastStatus } from './types'
import type { FastingDays, FastKind, FastRecord, FastStatus } from './types'

export const FASTING_STORAGE_KEY = storageKey('fasting')
/** 1: `days` and `owedBefore`. */
export const FASTING_VERSION = 1

export interface FastChoice {
  kind: FastKind
  status: FastStatus
}

export interface FastingState extends PersistedFasting {
  /**
   * Logs a day's fast and stamps the time of the change, or clears the day
   * with `null`. Choosing what is already logged changes nothing, its time
   * included. Days that have not begun cannot be logged, only cleared.
   */
  setFast: (dateKey: DateKey, fast: FastChoice | null) => void
  /** Sets the days owed from before the log began: a whole number from 0, capped. */
  setOwedBefore: (days: number) => void
}

/** Today where the user is, worked out exactly as the pages work it out (see `useTodayKey`). */
function currentDateKey(): DateKey {
  const now = new Date()
  try {
    return dateKeyInZone(now, useLocationStore.getState().location?.timeZone ?? deviceTimeZone())
  } catch {
    return dateKeyInZone(now, deviceTimeZone())
  }
}

export const useFasting = create<FastingState>()(
  persist(
    (set) => ({
      days: {},
      owedBefore: 0,
      setFast: (dateKey, fast) =>
        set((state) => {
          if (!isValidDateKey(dateKey)) return state
          const current = Object.prototype.hasOwnProperty.call(state.days, dateKey) ? state.days[dateKey] : undefined
          if (fast === null) {
            if (!current) return state
            const days = { ...state.days }
            delete days[dateKey]
            return { days }
          }
          if (!isFastKind(fast.kind) || !isFastStatus(fast.status)) return state
          if (current?.kind === fast.kind && current.status === fast.status) return state
          if (dateKey > currentDateKey()) return state
          const record: FastRecord = { kind: fast.kind, status: fast.status, at: Date.now() }
          return { days: { ...state.days, [dateKey]: record } }
        }),
      setOwedBefore: (days) =>
        set((state) => {
          // Anything that is not a number is a mistake, not a request to forget the figure.
          if (typeof days !== 'number' || !Number.isFinite(days)) return state
          const owedBefore = sanitizeOwedBefore(Math.round(days))
          return owedBefore === state.owedBefore ? state : { owedBefore }
        }),
    }),
    {
      name: FASTING_STORAGE_KEY,
      version: FASTING_VERSION,
      partialize: (state): PersistedFasting => ({ days: state.days, owedBefore: state.owedBefore }),
      // Data stamped with any version, a backup from a newer build say, is read
      // as far as it can be understood.
      migrate: (persisted) => sanitizeFasting(persisted),
      // Stored data can come from an imported or hand-edited backup, so it is
      // validated on every load, whatever version it claims to be.
      merge: (persisted, current) => (persisted === undefined ? current : { ...current, ...sanitizeFasting(persisted) }),
    },
  ),
)

/** One day's fast, or `undefined` when none is logged. */
export function useFast(dateKey: DateKey): FastRecord | undefined {
  return useFasting((state) =>
    Object.prototype.hasOwnProperty.call(state.days, dateKey) ? state.days[dateKey] : undefined,
  )
}

/** Every logged fast. */
export function useFastingDays(): FastingDays {
  return useFasting((state) => state.days)
}

/** The days of `days` from `from` to `to`, both included. */
export function pickFastingRange(days: FastingDays, from: DateKey, to: DateKey): FastingDays {
  const picked: FastingDays = {}
  for (const [key, record] of Object.entries(days)) {
    if (key >= from && key <= to && isValidDateKey(key)) picked[key] = record
  }
  return picked
}

/**
 * The fasts from `from` to `to`, both included, for a month view. Keeps its
 * identity while nothing in the range changes.
 */
export function useFastingRange(from: DateKey, to: DateKey): FastingDays {
  return useFasting(useShallow((state) => pickFastingRange(state.days, from, to)))
}
