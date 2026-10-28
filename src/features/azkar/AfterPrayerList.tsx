import { Check, ChevronLeft, ChevronRight, CloudSun, Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import type { DateKey, PrayerName } from '../../shared/types'
import { ProgressRing } from '../../shared/ui'
import { afterPrayerPath, availableAfterPrayers } from './afterPrayer'
import { cx } from './cx'
import styles from './PickerPage.module.css'
import { STATE_LABEL } from './stateLabel'
import { useAfterPrayerStanding } from './useAfterPrayer'
import { useCompletedLabel } from './useSessionStanding'

const PRAYER_ICON: Record<PrayerName, LucideIcon> = {
  fajr: Sunrise,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: Sunset,
  isha: Moon,
}

function AfterPrayerRow({ prayer, dateKey }: { prayer: PrayerName; dateKey: DateKey }) {
  const { t, dir } = useI18n()
  const standing = useAfterPrayerStanding(prayer, dateKey)
  const completedLabel = useCompletedLabel()
  const Icon = PRAYER_ICON[prayer]
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  const complete = standing.status === 'complete'
  const state = complete
    ? completedLabel(standing.completedAt)
    : standing.status === 'active'
      ? t('azkar.progress', { done: standing.done, total: standing.total })
      : t(STATE_LABEL[standing.status])

  return (
    <Link to={afterPrayerPath(prayer)} className={styles.prayerRow}>
      <ProgressRing value={standing.fraction} size={40} thickness={3}>
        {complete ? <Check aria-hidden size={18} strokeWidth={2.5} /> : <Icon aria-hidden size={18} />}
      </ProgressRing>
      <span className={styles.prayerText}>
        <span className={styles.prayerName}>{t(`prayer.${prayer}`)}</span>
        <span className={cx(styles.prayerState, complete && styles.prayerDone, 'tabular')}>{state}</span>
      </span>
      <Chevron aria-hidden size={18} className={styles.prayerChevron} />
    </Link>
  )
}

/** The picker's after-prayer section: one row per prayer with how far its azkar got on `dateKey`. */
export function AfterPrayerList({ dateKey }: { dateKey: DateKey }) {
  const { t } = useI18n()
  const headingId = useId()
  const prayers = availableAfterPrayers()
  if (prayers.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className={styles.sectionTitle}>
          {t('azkar.after.heading')}
        </h2>
        <p className={styles.sectionDescription}>{t('azkar.after.description')}</p>
      </div>
      <ul className={styles.prayerList}>
        {prayers.map((prayer) => (
          <li key={prayer}>
            <AfterPrayerRow prayer={prayer} dateKey={dateKey} />
          </li>
        ))}
      </ul>
    </section>
  )
}
