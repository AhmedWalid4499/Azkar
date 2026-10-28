import { Check, ChevronLeft, ChevronRight, HandHeart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import type { DateKey, PrayerName } from '../../shared/types'
import { ProgressBar } from '../../shared/ui'
import { afterPrayerPath } from './afterPrayer'
import styles from './AfterPrayerPrompt.module.css'
import { cx } from './cx'
import { STATE_LABEL } from './stateLabel'
import { useAfterPrayerDateKey, useAfterPrayerStanding } from './useAfterPrayer'
import { useCompletedLabel } from './useSessionStanding'

interface AfterPrayerPromptProps {
  prayer: PrayerName
  /** The day the prayer belongs to, as the prayer log files it (last night's Isha after midnight, say). */
  dateKey: DateKey
}

/**
 * A compact card inviting the user to read the azkar after `prayer`, with how far they got if
 * they began, and the way into the reader for that day. Renders nothing when the dataset has no
 * after-prayer azkar for the prayer. Fits on a page or in a sheet.
 */
export function AfterPrayerPrompt({ prayer, dateKey }: AfterPrayerPromptProps) {
  const { t, dir } = useI18n()
  const standing = useAfterPrayerStanding(prayer, dateKey)
  const completedLabel = useCompletedLabel()
  const current = useAfterPrayerDateKey()
  if (standing.total === 0) return null

  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  const complete = standing.status === 'complete'
  const active = standing.status === 'active'
  const progress = t('azkar.progress', { done: standing.done, total: standing.total })
  const state = complete ? completedLabel(standing.completedAt) : active ? progress : t('azkar.after.prompt')
  // The reader follows the clock when this is the day it would open anyway.
  const to = afterPrayerPath(prayer, dateKey === current ? undefined : dateKey)

  return (
    <div className={cx(styles.prompt, complete && styles.complete)}>
      <span className={styles.icon} aria-hidden>
        {complete ? <Check size={20} strokeWidth={2.5} /> : <HandHeart size={20} />}
      </span>
      <div className={styles.text}>
        <p className={styles.title}>
          <Link to={to} className={styles.link}>
            {t('azkar.after.title', { prayer: t(`prayer.${prayer}`) })}
          </Link>
        </p>
        <p className={cx(styles.state, 'tabular')}>{state}</p>
        {active && <ProgressBar value={standing.fraction} label={progress} />}
      </div>
      {!complete && (
        <span className={styles.action} aria-hidden>
          {t(STATE_LABEL[standing.status])}
          <Chevron size={16} />
        </span>
      )}
    </div>
  )
}
