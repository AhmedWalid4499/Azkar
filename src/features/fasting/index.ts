// Public surface of the fasting feature. Other features import only from here.

// Today page: Ramadan mode in Ramadan, the recommended-fast card on other days, or `FastingToday` for whichever fits.
export { FastingCard } from './FastingCard'
export type { FastingCardProps } from './FastingCard'
export { FastingToday } from './FastingToday'
export type { FastingTodayProps } from './FastingToday'
export { RamadanCard } from './RamadanCard'
export type { RamadanCardProps } from './RamadanCard'

// Tracker: one day's fast, the fasting figures, calendar marks and the CSV export's columns.
export { FastingDayPanel } from './FastingDayPanel'
export type { FastingDayPanelProps } from './FastingDayPanel'
export { FastingStats } from './FastingStats'
export type { FastingStatsProps } from './FastingStats'
export { fastingMarkOf, fastingMarkOn, useFastingMark } from './marks'
export type { FastingMark } from './marks'
export { fastingCsvColumns, fastingDayKeys } from './csv'
export type { FastingCsvColumn, FastingCsvOptions } from './csv'
export { describeFast, kindLabelKey, statusLabelKey } from './labels'

// The store and its hooks.
export {
  FASTING_STORAGE_KEY,
  FASTING_VERSION,
  pickFastingRange,
  useFast,
  useFasting,
  useFastingDays,
  useFastingRange,
} from './store'
export type { FastChoice, FastingState } from './store'
export { FAST_KINDS, FAST_STATUSES, isFastKind, isFastStatus } from './types'
export type { FastingDays, FastKind, FastRecord, FastStatus } from './types'

// The Hijri calendar and what it says about fasting.
export { useFastingDay, useFastingDayInfo, useHijriOffset, useOwedDays } from './hooks'
export type { FastingDay } from './hooks'
export { civilDaysOfHijriMonth, hijriOf, isRamadan, ramadanDayOf } from './hijri'
export type { HijriDate } from './hijri'
export { FASTING_REASONS, fastingDayInfo } from './occasions'
export type { FastingDayInfo, FastingReason, ForbiddenDay } from './occasions'
export { fastingStats, mondayThursdayStreak, owedDays, ramadanSummary, voluntaryCounts, whiteDaysStreak } from './stats'
export type { FastingStatsData, FastingStreak, OwedDays, RamadanSummary, VoluntaryCounts } from './stats'
