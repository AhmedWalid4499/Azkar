// Public surface of the prayer-log feature. Other features import only from here.
// The names and signatures below are a contract with the Today page.
export { LogRoutes } from './LogRoutes'
export { PrayerLogToggle } from './PrayerLogToggle'
export type { PrayerLogToggleProps } from './PrayerLogToggle'

// Extras for features that want to read the log.
export { useDayLog, usePrayerLog, usePrayerStatus } from './store'
export { completionRate, computeStreaks, firstLoggedDay, monthBreakdown, summarizeDay } from './stats'
export type { CompletionRate, DayStanding, DaySummary, MonthBreakdown, StatusCounts, Streaks } from './stats'
export { PRAYER_STATUSES } from './types'
export type { DayLog, LogEntries, PrayerStatus } from './types'
