import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storageKey } from '../../shared/storage'
import { TIME_SLOTS } from '../../shared/types'
import type { TimeSlot } from '../../shared/types'
import { clampAdjustment, DEFAULT_CALCULATION, HIGH_LATITUDE_RULES, NO_ADJUSTMENTS } from './engine/compute'
import type {
  Adjustments,
  CalculationConfig,
  HighLatitudeSetting,
  MadhabSetting,
  PolarSetting,
} from './engine/compute'
import { isMethodId } from './engine/methods'
import type { MethodSetting } from './engine/methods'

export const PRAYER_TIMES_STORAGE_KEY = storageKey('prayer-times')
export const PRAYER_TIMES_VERSION = 1

export interface PrayerTimesSettings extends CalculationConfig {
  /** Show a notification at each prayer time while the app is open. */
  notifications: boolean
}

export interface PrayerTimesState extends PrayerTimesSettings {
  setMethod: (method: MethodSetting) => void
  setMadhab: (madhab: MadhabSetting) => void
  setHighLatitudeRule: (rule: HighLatitudeSetting) => void
  setPolar: (polar: PolarSetting) => void
  setAdjustment: (slot: TimeSlot, minutes: number) => void
  resetAdjustments: () => void
  setNotifications: (enabled: boolean) => void
}

export const DEFAULT_PRAYER_TIMES_SETTINGS: PrayerTimesSettings = { ...DEFAULT_CALCULATION, notifications: false }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeAdjustments(value: unknown): Adjustments {
  const adjustments = { ...NO_ADJUSTMENTS }
  if (!isRecord(value)) return adjustments
  for (const slot of TIME_SLOTS) {
    const minutes = Object.hasOwn(value, slot) ? value[slot] : 0
    adjustments[slot] = typeof minutes === 'number' ? clampAdjustment(minutes) : 0
  }
  return adjustments
}

/**
 * Reads settings out of whatever was stored. The data can come from an imported
 * or hand-edited backup, so each field is checked and falls back to its
 * default on its own; one bad value does not discard the rest.
 */
export function sanitizeSettings(value: unknown): PrayerTimesSettings {
  const stored = isRecord(value) ? value : {}
  const { method, madhab, highLatitudeRule, polar } = stored
  return {
    method: method === 'auto' || isMethodId(method) ? method : DEFAULT_CALCULATION.method,
    madhab: madhab === 'hanafi' || madhab === 'shafi' ? madhab : DEFAULT_CALCULATION.madhab,
    highLatitudeRule:
      highLatitudeRule === 'auto' || (HIGH_LATITUDE_RULES as readonly unknown[]).includes(highLatitudeRule)
        ? (highLatitudeRule as HighLatitudeSetting)
        : DEFAULT_CALCULATION.highLatitudeRule,
    polar: polar === 'nearestLatitude' || polar === 'unresolved' ? polar : DEFAULT_CALCULATION.polar,
    adjustments: sanitizeAdjustments(stored.adjustments),
    notifications: stored.notifications === true,
  }
}

export const usePrayerTimesStore = create<PrayerTimesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PRAYER_TIMES_SETTINGS,
      setMethod: (method) => set({ method }),
      setMadhab: (madhab) => set({ madhab }),
      setHighLatitudeRule: (highLatitudeRule) => set({ highLatitudeRule }),
      setPolar: (polar) => set({ polar }),
      setAdjustment: (slot, minutes) =>
        set((state) => ({ adjustments: { ...state.adjustments, [slot]: clampAdjustment(minutes) } })),
      resetAdjustments: () => set({ adjustments: NO_ADJUSTMENTS }),
      setNotifications: (notifications) => set({ notifications }),
    }),
    {
      name: PRAYER_TIMES_STORAGE_KEY,
      version: PRAYER_TIMES_VERSION,
      partialize: ({ method, madhab, highLatitudeRule, polar, adjustments, notifications }): PrayerTimesSettings => ({
        method,
        madhab,
        highLatitudeRule,
        polar,
        adjustments,
        notifications,
      }),
      // Version 1 is the only shape so far; anything stamped differently is
      // read field by field like every other load.
      migrate: (persisted) => sanitizeSettings(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
)

let lastCalculation: CalculationConfig = DEFAULT_CALCULATION

/**
 * The calculation settings as one object, the same one for every caller until a
 * setting changes, so results computed from it can be shared and memoised.
 */
export function selectCalculation(state: CalculationConfig): CalculationConfig {
  const last = lastCalculation
  if (
    last.method !== state.method ||
    last.madhab !== state.madhab ||
    last.highLatitudeRule !== state.highLatitudeRule ||
    last.polar !== state.polar ||
    last.adjustments !== state.adjustments
  ) {
    const { method, madhab, highLatitudeRule, polar, adjustments } = state
    lastCalculation = { method, madhab, highLatitudeRule, polar, adjustments }
  }
  return lastCalculation
}

export function useCalculationConfig(): CalculationConfig {
  return usePrayerTimesStore(selectCalculation)
}
