// Public surface of the prayer-log feature. Other features import only from here.
// The names and signatures below are a contract with the Today page.
export { LogRoutes } from './LogRoutes'
export { PrayerLogToggle } from './PrayerLogToggle'
export type { PrayerLogToggleProps } from './PrayerLogToggle'
export { SunnahToggle } from './SunnahToggle'
export type { SunnahToggleProps } from './SunnahToggle'

// Extras for features that want to read the log.
export {
  pickRange,
  useDayLog,
  useLoggedAt,
  useLogRange,
  usePrayerLog,
  usePrayerLoggedAt,
  usePrayerStatus,
  useSunnahAt,
  useSunnahDay,
  useSunnahDone,
} from './store'
export type { LogRange, PrayerLogState } from './store'
export {
  completionRate,
  computeStreaks,
  firstLoggedDay,
  monthBreakdown,
  outstandingMissed,
  summarizeDay,
  totalOf,
  wholePercent,
} from './stats'
export type {
  CompletionRate,
  DayStanding,
  DaySummary,
  MissedPrayer,
  MonthBreakdown,
  OutstandingMissed,
  StatusCounts,
  Streaks,
} from './stats'
export {
  firstSunnahDay,
  isSunnahExcused,
  rawatibStreaks,
  summarizeSunnahDay,
  sunnahCompletion,
  sunnahStreaks,
  witrStreaks,
} from './sunnahStats'
export type { SunnahCompletion, SunnahDaySummary } from './sunnahStats'
export { sunnahLabelKey } from './sunnahLabels'
export {
  isNightSunnah,
  isRawatibPrayer,
  isSunnahPrayer,
  NIGHT_SUNNAH,
  PRAYER_STATUSES,
  RAWATIB,
  RAWATIB_RAKAHS,
  SUNNAH_PRAYERS,
} from './types'
export type {
  DayLog,
  LogEntries,
  LoggedAtDay,
  LoggedAtEntries,
  PrayerStatus,
  RawatibPrayer,
  SunnahDay,
  SunnahEntries,
  SunnahPrayer,
} from './types'
