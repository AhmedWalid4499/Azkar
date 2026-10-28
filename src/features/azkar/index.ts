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
} from './useTracking'
export { azkarCompletionRate, computeAzkarStreaks, lifetimeTotals, ratePercent, sessionsInRange } from './tracking'
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
