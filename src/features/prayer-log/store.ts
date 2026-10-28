import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { dateKeyInZone, deviceTimeZone, isValidDateKey } from '../../shared/date'
import { useLocationStore } from '../../shared/location'
import { storageKey } from '../../shared/storage'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import { sanitizeLog } from './sanitize'
import type { PersistedLog } from './sanitize'
import { isPrayerStatus, isSunnahPrayer } from './types'
import type {
  DayLog,
  LogEntries,
  LoggedAtDay,
  LoggedAtEntries,
  PrayerStatus,
  SunnahDay,
  SunnahEntries,
  SunnahPrayer,
} from './types'

export { sanitizeEntries } from './sanitize'

export const PRAYER_LOG_STORAGE_KEY = storageKey('prayer-log')
/**
 * 1: `entries` only.
 * 2: adds `loggedAt` and `sunnah`.
 */
export const PRAYER_LOG_VERSION = 2

export interface PrayerLogState extends PersistedLog {
  /**
   * Logs `status` for one prayer and stamps the time of the change in
   * `loggedAt`, or clears both with `null`. A day left with nothing logged is
   * removed. Days that have not begun cannot be logged, only cleared.
   */
  setStatus: (dateKey: DateKey, prayer: PrayerName, status: PrayerStatus | null) => void
  /**
   * Ticks one sunnah prayer off for a day, stamped with the time, or unticks it.
   * A day left with nothing ticked is removed. Days that have not begun cannot be ticked.
   */
  setSunnah: (dateKey: DateKey, sunnah: SunnahPrayer, done: boolean) => void
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

/** `map` with `day` filed under `dateKey`, or without that key when `day` is empty. */
function withDay<T extends object>(map: Record<DateKey, T>, dateKey: DateKey, day: T): Record<DateKey, T> {
  const next = { ...map }
  if (Object.keys(day).length === 0) delete next[dateKey]
  else next[dateKey] = day
  return next
}

export const usePrayerLog = create<PrayerLogState>()(
  persist(
    (set) => ({
      entries: {},
      loggedAt: {},
      sunnah: {},
      setStatus: (dateKey, prayer, status) =>
        set((state) => {
          if (!isValidDateKey(dateKey) || !PRAYERS.includes(prayer)) return state
          if (status !== null && !isPrayerStatus(status)) return state
          if ((state.entries[dateKey]?.[prayer] ?? null) === status) return state
          if (status !== null && dateKey > currentDateKey()) return state

          const day: DayLog = { ...state.entries[dateKey] }
          const stamps: LoggedAtDay = { ...state.loggedAt[dateKey] }
          if (status === null) {
            delete day[prayer]
            delete stamps[prayer]
          } else {
            day[prayer] = status
            stamps[prayer] = Date.now()
          }
          return { entries: withDay(state.entries, dateKey, day), loggedAt: withDay(state.loggedAt, dateKey, stamps) }
        }),
      setSunnah: (dateKey, sunnah, done) =>
        set((state) => {
          if (!isValidDateKey(dateKey) || !isSunnahPrayer(sunnah) || typeof done !== 'boolean') return state
          if ((state.sunnah[dateKey]?.[sunnah] !== undefined) === done) return state
          if (done && dateKey > currentDateKey()) return state

          const day: SunnahDay = { ...state.sunnah[dateKey] }
          if (done) day[sunnah] = Date.now()
          else delete day[sunnah]
          return { sunnah: withDay(state.sunnah, dateKey, day) }
        }),
    }),
    {
      name: PRAYER_LOG_STORAGE_KEY,
      version: PRAYER_LOG_VERSION,
      partialize: (state): PersistedLog => ({ entries: state.entries, loggedAt: state.loggedAt, sunnah: state.sunnah }),
      // Every version so far, and data stamped with any other one (a backup from a
      // newer build, say), is read as far as it can be understood. Version 1 keeps
      // all its entries and gains two empty maps.
      migrate: (persisted) => sanitizeLog(persisted),
      // Stored data can come from an imported or hand-edited backup, so it is
      // validated on every load, whatever version it claims to be.
      merge: (persisted, current) => (persisted === undefined ? current : { ...current, ...sanitizeLog(persisted) }),
    },
  ),
)

/** One day's log, or `undefined` when nothing is logged for it. */
export function useDayLog(dateKey: DateKey): DayLog | undefined {
  return usePrayerLog((state) => state.entries[dateKey])
}

/** One prayer's logged status, or `null` when it is not logged. */
export function usePrayerStatus(dateKey: DateKey, prayer: PrayerName): PrayerStatus | null {
  return usePrayerLog((state) => state.entries[dateKey]?.[prayer] ?? null)
}

/** When each of a day's statuses last changed, or `undefined` when none has a time. */
export function useLoggedAt(dateKey: DateKey): LoggedAtDay | undefined {
  return usePrayerLog((state) => state.loggedAt[dateKey])
}

/** When one prayer's status last changed (epoch ms), or `null`: not logged, or logged before times were kept. */
export function usePrayerLoggedAt(dateKey: DateKey, prayer: PrayerName): number | null {
  return usePrayerLog((state) => state.loggedAt[dateKey]?.[prayer] ?? null)
}

/** One day's ticked sunnah prayers, or `undefined` when none is ticked. */
export function useSunnahDay(dateKey: DateKey): SunnahDay | undefined {
  return usePrayerLog((state) => state.sunnah[dateKey])
}

/** When one sunnah prayer was ticked (epoch ms), or `null` when it is not ticked. */
export function useSunnahAt(dateKey: DateKey, sunnah: SunnahPrayer): number | null {
  return usePrayerLog((state) => state.sunnah[dateKey]?.[sunnah] ?? null)
}

export function useSunnahDone(dateKey: DateKey, sunnah: SunnahPrayer): boolean {
  return useSunnahAt(dateKey, sunnah) !== null
}

/** The days of `map` from `from` to `to`, both included. */
export function pickRange<T>(map: Record<DateKey, T>, from: DateKey, to: DateKey): Record<DateKey, T> {
  const picked: Record<DateKey, T> = {}
  for (const [key, value] of Object.entries(map)) {
    if (key >= from && key <= to && isValidDateKey(key)) picked[key] = value
  }
  return picked
}

export interface LogRange {
  entries: LogEntries
  loggedAt: LoggedAtEntries
  sunnah: SunnahEntries
}

/**
 * The three maps cut to the days from `from` to `to`, both included. Each map
 * keeps its identity while nothing in the range changes, so a month view does
 * not re-render for a change in another month.
 */
export function useLogRange(from: DateKey, to: DateKey): LogRange {
  const entries = usePrayerLog(useShallow((state) => pickRange(state.entries, from, to)))
  const loggedAt = usePrayerLog(useShallow((state) => pickRange(state.loggedAt, from, to)))
  const sunnah = usePrayerLog(useShallow((state) => pickRange(state.sunnah, from, to)))
  return useMemo(() => ({ entries, loggedAt, sunnah }), [entries, loggedAt, sunnah])
}
