import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLocationStore } from '../../shared/location'
import { storageKey } from '../../shared/storage'
import { TIME_SLOTS } from '../../shared/types'
import type { TimeSlot } from '../../shared/types'
import { clampAdjustment, DEFAULT_CALCULATION, HIGH_LATITUDE_RULES, NO_ADJUSTMENTS } from './engine/compute'
import type { Adjustments, CalculationConfig, HighLatitudeSetting, PolarSetting } from './engine/compute'
import { isMethodId } from './engine/methods'
import type { MadhabSetting, MethodSetting } from './engine/methods'

export const PRAYER_TIMES_STORAGE_KEY = storageKey('prayer-times')
/**
 * 1: calculation settings and the prayer reminder switch.
 * 2: adds `azkarReminders`.
 * 3: adds `unloggedReminders`.
 */
export const PRAYER_TIMES_VERSION = 3

export type AzkarSession = 'morning' | 'evening'

/** When the morning azkar reminder comes: as Fajr begins, or once the sun has risen. */
export type MorningReminderTime = 'fajr' | 'sunrise'

export interface AzkarReminderSettings {
  morning: boolean
  evening: boolean
  morningAt: MorningReminderTime
}

/** Where Isha's time is taken to end for its "not logged yet" reminder. */
export type IshaDeadline = 'middle' | 'fajr'

/** How long before a prayer's time ends its "not logged yet" reminder can come, in minutes. */
export const UNLOGGED_LEAD_MINUTES = [10, 15, 30, 45, 60] as const
export type UnloggedLeadMinutes = (typeof UNLOGGED_LEAD_MINUTES)[number]

export function isUnloggedLead(value: unknown): value is UnloggedLeadMinutes {
  return (UNLOGGED_LEAD_MINUTES as readonly unknown[]).includes(value)
}

export interface UnloggedReminderSettings {
  enabled: boolean
  leadMinutes: UnloggedLeadMinutes
  /**
   * `middle`: the middle of the night between Maghrib and the next Fajr, the end
   * of Isha's preferred time (Sahih Muslim). `fajr`: the next Fajr.
   */
  ishaEnds: IshaDeadline
}

export interface PrayerTimesSettings extends CalculationConfig {
  /**
   * Remind at each of the five prayer times: by the system in the installed app,
   * while the page is open on the web.
   */
  notifications: boolean
  /** Reminders to read the morning azkar (at Fajr or after sunrise) and the evening azkar (at Asr). */
  azkarReminders: AzkarReminderSettings
  /** A reminder shortly before each prayer's time ends while it is not logged. */
  unloggedReminders: UnloggedReminderSettings
}

export interface PrayerTimesState extends PrayerTimesSettings {
  setMethod: (method: MethodSetting) => void
  setMadhab: (madhab: MadhabSetting) => void
  setHighLatitudeRule: (rule: HighLatitudeSetting) => void
  setPolar: (polar: PolarSetting) => void
  setAdjustment: (slot: TimeSlot, minutes: number) => void
  resetAdjustments: () => void
  setNotifications: (enabled: boolean) => void
  setAzkarReminder: (session: AzkarSession, enabled: boolean) => void
  setMorningReminderTime: (at: MorningReminderTime) => void
  setUnloggedReminders: (enabled: boolean) => void
  setUnloggedLeadMinutes: (minutes: UnloggedLeadMinutes) => void
  setIshaDeadline: (ends: IshaDeadline) => void
}

export const DEFAULT_AZKAR_REMINDERS: AzkarReminderSettings = { morning: false, evening: false, morningAt: 'fajr' }

/** On, so they come as soon as notifications are allowed; the switch in Settings turns them off. */
export const DEFAULT_UNLOGGED_REMINDERS: UnloggedReminderSettings = { enabled: true, leadMinutes: 15, ishaEnds: 'middle' }

export const DEFAULT_PRAYER_TIMES_SETTINGS: PrayerTimesSettings = {
  ...DEFAULT_CALCULATION,
  notifications: false,
  azkarReminders: DEFAULT_AZKAR_REMINDERS,
  unloggedReminders: DEFAULT_UNLOGGED_REMINDERS,
}

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

function sanitizeAzkarReminders(value: unknown): AzkarReminderSettings {
  const stored = isRecord(value) ? value : {}
  return {
    morning: stored.morning === true,
    evening: stored.evening === true,
    morningAt: stored.morningAt === 'sunrise' ? 'sunrise' : DEFAULT_AZKAR_REMINDERS.morningAt,
  }
}

function sanitizeUnloggedReminders(value: unknown): UnloggedReminderSettings {
  const stored = isRecord(value) ? value : {}
  return {
    // A choice made is kept either way; anything else is the default, which is on.
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_UNLOGGED_REMINDERS.enabled,
    leadMinutes: isUnloggedLead(stored.leadMinutes) ? stored.leadMinutes : DEFAULT_UNLOGGED_REMINDERS.leadMinutes,
    ishaEnds: stored.ishaEnds === 'fajr' || stored.ishaEnds === 'middle' ? stored.ishaEnds : DEFAULT_UNLOGGED_REMINDERS.ishaEnds,
  }
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
    madhab: madhab === 'auto' || madhab === 'hanafi' || madhab === 'shafi' ? madhab : DEFAULT_CALCULATION.madhab,
    highLatitudeRule:
      highLatitudeRule === 'auto' || (HIGH_LATITUDE_RULES as readonly unknown[]).includes(highLatitudeRule)
        ? (highLatitudeRule as HighLatitudeSetting)
        : DEFAULT_CALCULATION.highLatitudeRule,
    polar: polar === 'nearestLatitude' || polar === 'unresolved' ? polar : DEFAULT_CALCULATION.polar,
    adjustments: sanitizeAdjustments(stored.adjustments),
    notifications: stored.notifications === true,
    azkarReminders: sanitizeAzkarReminders(stored.azkarReminders),
    unloggedReminders: sanitizeUnloggedReminders(stored.unloggedReminders),
  }
}

/**
 * What an install with nothing saved here starts from. Before the Asr school
 * could follow the country, the settings were only written once one of them
 * was changed, and until then Asr was the standard one. Such an install is
 * told from a new one by the location it already has, and it keeps the
 * standard Asr: an update must never move a prayer by an hour on its own.
 */
function unsavedSettings(): Partial<PrayerTimesSettings> | undefined {
  return useLocationStore.getState().location ? { madhab: 'shafi' } : undefined
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
      setAzkarReminder: (session, enabled) =>
        set((state) => ({ azkarReminders: { ...state.azkarReminders, [session]: enabled } })),
      setMorningReminderTime: (morningAt) => set((state) => ({ azkarReminders: { ...state.azkarReminders, morningAt } })),
      setUnloggedReminders: (enabled) => set((state) => ({ unloggedReminders: { ...state.unloggedReminders, enabled } })),
      setUnloggedLeadMinutes: (minutes) =>
        set((state) =>
          isUnloggedLead(minutes) ? { unloggedReminders: { ...state.unloggedReminders, leadMinutes: minutes } } : state,
        ),
      setIshaDeadline: (ishaEnds) =>
        set((state) =>
          ishaEnds === 'middle' || ishaEnds === 'fajr' ? { unloggedReminders: { ...state.unloggedReminders, ishaEnds } } : state,
        ),
    }),
    {
      name: PRAYER_TIMES_STORAGE_KEY,
      version: PRAYER_TIMES_VERSION,
      partialize: ({
        method,
        madhab,
        highLatitudeRule,
        polar,
        adjustments,
        notifications,
        azkarReminders,
        unloggedReminders,
      }): PrayerTimesSettings => ({
        method,
        madhab,
        highLatitudeRule,
        polar,
        adjustments,
        notifications,
        azkarReminders,
        unloggedReminders,
      }),
      // Version 2 only added `azkarReminders`, so version 1 data keeps every
      // field it has and gets the azkar reminders off. Version 3 only added
      // `unloggedReminders`, so older data keeps every field it has and gets
      // them at their defaults. Anything stamped otherwise, older, newer or
      // hand-made, is read field by field like every load.
      // Adding 'auto' to the Asr school needed no new version: a saved school
      // is kept exactly as it is.
      migrate: (persisted) => sanitizeSettings(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted ?? unsavedSettings()) }),
    },
  ),
)

// A new install would look like an older one (see `unsavedSettings`) as soon as
// it saved its first location. Its settings are written down at that moment, so
// the automatic Asr school it started with is still its own the next time.
useLocationStore.subscribe((state, previous) => {
  if (!state.location || previous.location) return
  try {
    if (localStorage.getItem(PRAYER_TIMES_STORAGE_KEY) !== null) return
    // An empty change: no setting differs, but the store saves on every call and
    // tells its listeners, the tab sync among them, that it has.
    usePrayerTimesStore.setState({})
  } catch {
    // Storage is full or unavailable: nothing here may stop the location from being saved.
  }
})

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
