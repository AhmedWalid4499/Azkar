import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateKey, formatHijri } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useLocationStore } from '../../shared/location'
import { useSettings } from '../../shared/settings'
import { useTodayKey } from '../../shared/time'
import { AzkarTodayCards } from '../azkar'
import { PrayerLogToggle } from '../prayer-log'
import { LocationPrompt, NextPrayerCard, PrayerTimesList } from '../prayer-times'
import styles from './TodayPage.module.css'

export function TodayPage() {
  const { t, locale } = useI18n()
  const today = useTodayKey()
  const location = useLocationStore((state) => state.location)
  const hijriOffset = useSettings((state) => state.hijriOffset)

  return (
    <div className="page">
      <header className={styles.header}>
        <p className={styles.greeting}>{t('today.greeting')}</p>
        <h1 className={styles.date}>{formatDateKey(today, locale)}</h1>
        <p className={styles.hijri}>{formatHijri(today, locale, hijriOffset)}</p>
        <Link to="/settings" className={styles.location} aria-label={t('today.changeLocation')}>
          <MapPin aria-hidden size={16} />
          <span>{location ? location.label || t('today.changeLocation') : t('today.locationUnset')}</span>
        </Link>
      </header>

      {location ? <NextPrayerCard /> : <LocationPrompt />}

      <section className={styles.block} aria-labelledby="today-azkar">
        <h2 id="today-azkar" className={styles.heading}>
          {t('today.azkar')}
        </h2>
        <AzkarTodayCards />
      </section>

      {location && (
        <section className={styles.block} aria-labelledby="today-prayers">
          <h2 id="today-prayers" className={styles.heading}>
            {t('today.prayers')}
          </h2>
          <PrayerTimesList
            dateKey={today}
            renderTrailing={(prayer) => <PrayerLogToggle prayer={prayer} dateKey={today} />}
          />
        </section>
      )}
    </div>
  )
}
