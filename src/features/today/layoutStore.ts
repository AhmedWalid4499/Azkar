import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKey } from '../../shared/storage'

export const TODAY_LAYOUT_STORAGE_KEY = storageKey('today-layout')
export const TODAY_LAYOUT_VERSION = 1

/** How the user has arranged the Today page. */
export interface TodayLayout {
  /** The sunnah prayers card shows only its heading. */
  sunnahCollapsed: boolean
}

interface TodayLayoutState extends TodayLayout {
  setSunnahCollapsed: (collapsed: boolean) => void
}

export const DEFAULT_TODAY_LAYOUT: TodayLayout = { sunnahCollapsed: false }

/** Each field that is valid is kept; the rest fall back to their defaults. Nothing is coerced. */
export function sanitizeTodayLayout(value: unknown): TodayLayout {
  const stored = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    sunnahCollapsed:
      typeof stored.sunnahCollapsed === 'boolean' ? stored.sunnahCollapsed : DEFAULT_TODAY_LAYOUT.sunnahCollapsed,
  }
}

export const useTodayLayout = create<TodayLayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_TODAY_LAYOUT,
      setSunnahCollapsed: (collapsed) => set(sanitizeTodayLayout({ sunnahCollapsed: collapsed })),
    }),
    {
      name: TODAY_LAYOUT_STORAGE_KEY,
      version: TODAY_LAYOUT_VERSION,
      partialize: (state): TodayLayout => sanitizeTodayLayout(state),
      // Version 1 is the only shape so far; other versions are read field by field.
      migrate: (persisted) => sanitizeTodayLayout(persisted),
      // Validated on every load: stored data can come from an imported backup.
      merge: (persisted, current) =>
        persisted === undefined ? current : { ...current, ...sanitizeTodayLayout(persisted) },
    },
  ),
)
