// Public surface of the prayer-times feature. Other features import only from here.
// The names and signatures below are a contract with the Today and Settings pages.
export {
  CalculationSettingsSection,
  LocationPrompt,
  LocationSettingsSection,
  NextPrayerCard,
  NotificationSettingsSection,
  PrayerNotifier,
  PrayerTimesList,
  useNextPrayer,
  usePrayerDay,
} from './stub'
export type { PrayerTimesListProps } from './stub'
