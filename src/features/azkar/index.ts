// Public surface of the adhkar feature. Other features import only from here.
// The names and signatures below are a contract with the Today and Settings pages.
export { AzkarRoutes } from './AzkarRoutes'
export { AzkarSettingsSection } from './AzkarSettingsSection'
export { AzkarSourcesSection } from './AzkarSourcesSection'
export { AzkarTodayCards } from './AzkarTodayCards'

// Tracking: what was read on which day, streaks, completion rates and lifetime totals.
export {
  useAzkarCompletionRate,
  useAzkarLifetime,
  useAzkarStreaks,
  useDaySessions,
  useSessionsInRange,
  useSleepCompletionRate,
  useSleepStreak,
} from './useTracking'
export {
  azkarCompletionRate,
  computeAzkarStreaks,
  computeSleepStreak,
  lifetimeTotals,
  ratePercent,
  sessionsInRange,
  sleepCompletionRate,
} from './tracking'
export type {
  AzkarCompletionRates,
  AzkarLifetime,
  AzkarRate,
  AzkarStreaks,
  DatedSessions,
  DhikrTotal,
  SessionHistory,
  Streak,
} from './tracking'
export { useAzkarProgress, useSessionRecord } from './progressStore'
export type { DaySessions, SessionRecord } from './progressStore'
export { useCompletedLabel, useTimeOfDay } from './useSessionStanding'

// The session day rule (evening azkar after midnight count for the evening before) and the sessions.
export { sessionDateKey, useAzkarClock } from './clock'
export type { AzkarClock, DayPhase } from './clock'
export { COLLECTION_META, collectionPath, DAILY_COLLECTIONS } from './collections'
export { availableCollections, COLLECTION_IDS } from './data'
export type { CollectionId } from './data'

// The azkar after the five prayers: the prompt shown once a prayer is logged, where to read
// them, and what the tracker reads (records per day, streaks, rates and lifetime totals).
export { AfterPrayerPrompt } from './AfterPrayerPrompt'
export { afterPrayerDateKey, afterPrayerPath, availableAfterPrayers } from './afterPrayer'
export type { AfterPrayerDay } from './afterPrayerData'
export {
  afterPrayerCompletionRate,
  afterPrayerInRange,
  afterPrayerLifetime,
  computeAfterPrayerStreaks,
} from './afterPrayerTracking'
export type {
  AfterPrayerHistory,
  AfterPrayerLifetime,
  AfterPrayerRates,
  AfterPrayerStreaks,
  DatedAfterPrayer,
} from './afterPrayerTracking'
export {
  useAfterPrayerCompletionRate,
  useAfterPrayerDateKey,
  useAfterPrayerInRange,
  useAfterPrayerLifetime,
  useAfterPrayerSessions,
  useAfterPrayerStanding,
  useAfterPrayerStreaks,
} from './useAfterPrayer'
export type { SessionStanding } from './useSessionStanding'

// The tasbih counter: where it is, and what was counted on which day, with lifetime totals.
export { TASBIH_PATH } from './collections'
export { tasbihDayCount } from './tasbihData'
export type { TasbihDay, TasbihRecord } from './tasbihData'
export { tasbihCountSince, tasbihDateKey, tasbihInRange, tasbihLifetime } from './tasbihTracking'
export type { DatedTasbih, TasbihLifetime } from './tasbihTracking'
export { useTasbihDateKey, useTasbihDay, useTasbihInRange, useTasbihLifetime } from './useTasbih'
