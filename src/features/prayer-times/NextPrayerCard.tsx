import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { dateKeyInZone } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { Card, Notice } from '../../shared/ui'
import { describeDuration, formatCountdown, useClockFormat } from './format'
import { usePrayerClock } from './hooks'
import styles from './NextPrayerCard.module.css'

/**
 * Speaks the new "next prayer" once when it changes (five times a day), and
 * stays silent on first render and between changes.
 */
function useChangeAnnouncement(key: string | null, text: string): string {
  const [announcement, setAnnouncement] = useState('')
  const previous = useRef(key)
  useEffect(() => {
    // A new language re-runs this with the same key, which is not news.
    if (previous.current !== null && key !== null && previous.current !== key) setAnnouncement(text)
    previous.current = key
  }, [key, text])
  return announcement
}

/** Hero card: the next prayer, its time and a live countdown. */
export function NextPrayerCard() {
  const i18n = useI18n()
  const { t } = i18n
  const formatTime = useClockFormat()
  const headingId = useId()
  const { now, schedule, next, current } = usePrayerClock()

  const prayer = next ? t(`prayer.${next.prayer}`) : ''
  const time = next && schedule ? formatTime(next.at, schedule.timeZone) : ''
  const announcement = useChangeAnnouncement(
    next ? `${next.dateKey}:${next.prayer}` : null,
    t('times.next.announce', { prayer, time }),
  )

  if (!schedule) {
    return (
      <Card className={styles.fallback}>
        <Notice tone="warn">{t('times.location.unusable')}</Notice>
        <Link to="/settings" className="ui-button ui-button--secondary ui-button--m">
          {t('times.location.openSettings')}
        </Link>
      </Card>
    )
  }

  if (!next) {
    return (
      <Card className={styles.fallback}>
        <Notice tone="warn">{t('times.next.none')}</Notice>
        <Link to="/settings" className="ui-button ui-button--secondary ui-button--m">
          {t('times.unavailable.action')}
        </Link>
      </Card>
    )
  }

  const remaining = next.at.getTime() - now.getTime()
  // Compared against the ticking clock, so the tag disappears on the stroke of midnight.
  const isTomorrow = next.dateKey > dateKeyInZone(now, schedule.timeZone)
  const sentence = t(isTomorrow ? 'times.next.srTomorrow' : 'times.next.sr', {
    prayer,
    time,
    duration: describeDuration(remaining, i18n),
  })

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.motif} aria-hidden />
      <h2 id={headingId} className={styles.eyebrow}>
        {t('times.next.label')}
      </h2>

      {/* The visual block ticks every second; assistive tech gets the sentence below instead. */}
      <div aria-hidden>
        <div className={styles.headline}>
          <span className={styles.name}>{prayer}</span>
          <span className={styles.when}>
            <span className={`${styles.time} tabular`}>{time}</span>
            {isTomorrow && <span className={styles.tomorrow}>{t('times.next.tomorrow')}</span>}
          </span>
        </div>
        <div className={styles.countdown}>
          <span className={`${styles.digits} tabular`} dir="ltr">
            {formatCountdown(remaining, i18n)}
          </span>
          <span className={styles.countdownLabel}>{t('times.next.remaining')}</span>
        </div>
      </div>
      <p className="visually-hidden">{sentence}</p>

      {current && <p className={styles.current}>{t('times.next.current', { prayer: t(`prayer.${current.prayer}`) })}</p>}

      <p className="visually-hidden" aria-live="polite" aria-atomic>
        {announcement}
      </p>
    </section>
  )
}
