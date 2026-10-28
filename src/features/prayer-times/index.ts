// Public surface of the prayer-times feature. Other features import only from here.
// The names and signatures below are a contract with the Today and Settings pages.
export { CalculationSettingsSection } from './CalculationSettingsSection'
export { isValidTime } from './engine/compute'
export { useNextPrayer, usePrayerDay } from './hooks'
export { LocationPrompt } from './location/LocationPrompt'
export { LocationSettingsSection } from './location/LocationSettingsSection'
export { useLocationLabel } from './location/useLocationLabel'
export { NextPrayerCard } from './NextPrayerCard'
export { NotificationSettingsSection } from './NotificationSettingsSection'
export { PrayerNotifier } from './PrayerNotifier'
export { PrayerTimesList } from './PrayerTimesList'
export type { PrayerTimesListProps } from './PrayerTimesList'
export { ReminderPrompt } from './reminders/ReminderPrompt'
// The id of the pending "not logged yet" reminder of a prayer, which the widget cancels when the prayer is ticked off there.
export { UNLOGGED_GROUP, UNLOGGED_ID_BASE, unloggedReminderId } from './reminders/plan'
