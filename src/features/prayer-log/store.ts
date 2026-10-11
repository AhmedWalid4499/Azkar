import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isValidDateKey } from '../../shared/date'
import { storageKey } from '../../shared/storage'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerName } from '../../shared/types'
import { isPrayerStatus } from './types'
import type { DayLog, LogEntries, PrayerStatus } from './types'

export const PRAYER_LOG_STORAGE_KEY = storageKey('prayer-log')
export const PRAYER_LOG_VERSION = 1

export interface PrayerLogState {
  entries: LogEntries
  /** Logs `status` for one prayer, or clears it with `null`. A day left with nothing logged is removed. */
  setStatus: (dateKey: DateKey, prayer: PrayerName, status: PrayerStatus | null) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeDay(value: unknown): DayLog | null {
  if (!isRecord(value)) return null
  const day: DayLog = {}
  for (const prayer of PRAYERS) {
    const status = Object.hasOwn(value, prayer) ? value[prayer] : undefined
    if (isPrayerStatus(status)) day[prayer] = status
  }
  return Object.keys(day).length > 0 ? day : null
}

/**
 * Keeps only what is certainly a log entry: real calendar days, the five
 * prayers, known statuses. Everything else is dropped rather than repaired, and
 * days left empty disappear.
 */
export function sanitizeEntries(value: unknown): LogEntries {
  const entries: LogEntries = {}
  if (!isRecord(value)) return entries
  for (const key of Object.keys(value)) {
    if (!isValidDateKey(key)) continue
    const day = sanitizeDay(value[key])
    if (day) entries[key] = day
  }
  return entries
}

function entriesOf(persisted: unknown): LogEntries {
  return sanitizeEntries(isRecord(persisted) ? persisted.entries : undefined)
}

export const usePrayerLog = create<PrayerLogState>()(
  persist(
    (set) => ({
      entries: {},
      setStatus: (dateKey, prayer, status) =>
        set((state) => {
          if (!isValidDateKey(dateKey) || !PRAYERS.includes(prayer)) return state
          if (status !== null && !isPrayerStatus(status)) return state
          if ((state.entries[dateKey]?.[prayer] ?? null) === status) return state

          const day: DayLog = { ...state.entries[dateKey] }
          if (status === null) delete day[prayer]
          else day[prayer] = status

          const entries = { ...state.entries }
          if (Object.keys(day).length === 0) delete entries[dateKey]
          else entries[dateKey] = day
          return { entries }
        }),
    }),
    {
      name: PRAYER_LOG_STORAGE_KEY,
      version: PRAYER_LOG_VERSION,
      partialize: (state) => ({ entries: state.entries }),
      // Version 1 is the only shape so far. Data stamped with any other version
      // (a backup from a newer build, say) is read as far as it can be understood.
      migrate: (persisted) => ({ entries: entriesOf(persisted) }),
      // Stored data can come from an imported or hand-edited backup, so it is
      // validated on every load, whatever version it claims to be.
      merge: (persisted, current) =>
        persisted === undefined ? current : { ...current, entries: entriesOf(persisted) },
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
