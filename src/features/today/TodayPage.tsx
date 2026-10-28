import { MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import { formatDateKey, formatHijri } from '../../shared/date'
import { isolate, useI18n } from '../../shared/i18n'
import { useLocationStore } from '../../shared/location'
import { useSettings } from '../../shared/settings'
import { useTodayKey } from '../../shared/time'
import { AzkarTodayCards } from '../azkar'
import { PrayerLogToggle } from '../prayer-log'
import { LocationPrompt, NextPrayerCard, PrayerTimesList, ReminderPrompt, useLocationLabel } from '../prayer-times'
import { LastNightIsha } from './LastNightIsha'
import { SunnahCard } from './SunnahCard'
import styles from './TodayPage.module.css'

/** Long enough to be read out, then removed so it is not found later as stray text. */
const ANNOUNCEMENT_MS = 6000

/**
 * Saving the first location swaps the prompt, and the button or sheet that was
 * in use, for the next-prayer card. This moves the focus to what replaced them
 * and reports for a moment that there is something to announce. It only reacts
 * to a location arriving while the page is open, never to one already saved.
 */
function useLocationArrival(hasLocation: boolean, target: RefObject<HTMLElement | null>): boolean {
  const [arrived, setArrived] = useState(false)
  const hadLocation = useRef(hasLocation)

  useEffect(() => {
    const isNew = hasLocation && !hadLocation.current
    hadLocation.current = hasLocation
    if (!isNew) return
    setArrived(true)
    target.current?.focus()
  }, [hasLocation, target])

  useEffect(() => {
    if (!arrived) return
    const id = window.setTimeout(() => setArrived(false), ANNOUNCEMENT_MS)
    return () => window.clearTimeout(id)
  }, [arrived])

  return arrived
}

export function TodayPage() {
  const { t, locale } = useI18n()
  const today = useTodayKey()
  const location = useLocationStore((state) => state.location)
  const place = useLocationLabel()
  const hijriOffset = useSettings((state) => state.hijriOffset)
  const name = useSettings((state) => state.name)
  const nextPrayer = useRef<HTMLDivElement>(null)
  const arrived = useLocationArrival(location !== null, nextPrayer)

  const placeText = place ?? t('today.locationUnset')

  return (
    <div className="page">
      <header className={styles.header}>
        <p className={styles.greeting}>{name ? t('today.greeting.named', { name: isolate(name) }) : t('today.greeting')}</p>
        <h1 className={styles.date}>{formatDateKey(today, locale)}</h1>
        <p className={styles.hijri}>{formatHijri(today, locale, hijriOffset)}</p>
        {/* The name starts with the visible text, so the place is spoken and "click Cairo" finds the link. */}
        <Link to="/settings" className={styles.location} aria-label={t('today.locationLink', { place: placeText })}>
          <MapPin aria-hidden size={16} />
          {/* A place name keeps the language it was saved in; it sets its own direction. */}
          <span dir="auto">{placeText}</span>
        </Link>
      </header>

      {location ? (
        <div ref={nextPrayer} tabIndex={-1} className={styles.arrival}>
          <NextPrayerCard />
        </div>
      ) : (
        <LocationPrompt />
      )}
      <ReminderPrompt />
      {/* The name can still improve after the first announcement, when the lookup answers. */}
      <p className="visually-hidden" role="status">
        {arrived && place ? t('today.locationSet', { place }) : ''}
      </p>

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
          <LastNightIsha today={today} />
          <PrayerTimesList
            dateKey={today}
            renderTrailing={(prayer) => <PrayerLogToggle prayer={prayer} dateKey={today} />}
          />
          <SunnahCard today={today} />
        </section>
      )}
    </div>
  )
}
