import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { formatDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Card } from '../../shared/ui'
import { useAzkarProgress } from '../azkar'
import { weekdayNames, weekStartOf } from './calendar'
import { cx } from './cx'
import { usePrayerLog } from './store'
import { DAILY_MAXIMUM, weeklyTotals } from './trackerStats'
import type { WeekTotals } from './trackerStats'
import styles from './Trends.module.css'

/** Weeks shown, the one under way included. */
export const TREND_WEEKS = 8

type Measure = keyof typeof DAILY_MAXIMUM

const CHARTS: ReadonlyArray<{ measure: Measure; title: 'log.trends.prayers' | 'log.trends.sunnah' | 'log.trends.azkar' }> =
  [
    { measure: 'prayed', title: 'log.trends.prayers' },
    { measure: 'sunnah', title: 'log.trends.sunnah' },
    { measure: 'azkar', title: 'log.trends.azkar' },
  ]

interface TrendsProps {
  today: DateKey
  /** Whether anything has been recorded yet; until then the section explains what it will show. */
  hasRecord: boolean
}

/** The last eight weeks as small bar charts: prayers prayed, sunnah prayers and azkar sessions completed. */
export function Trends({ today, hasRecord }: TrendsProps) {
  const { t, tp, lang, locale } = useI18n()
  const headingId = useId()
  const entries = usePrayerLog((state) => state.entries)
  const sunnah = usePrayerLog((state) => state.sunnah)
  const sessions = useAzkarProgress((state) => state.sessions)
  const weekStart = useMemo(() => weekStartOf(lang), [lang])
  const weeks = useMemo(
    () => weeklyTotals({ entries, sunnah, sessions }, today, weekStart, TREND_WEEKS),
    [entries, sunnah, sessions, today, weekStart],
  )
  const weekday = useMemo(() => weekdayNames(locale, 'long')[weekStart], [locale, weekStart])

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {tp('log.trends.title', TREND_WEEKS)}
      </h2>
      <Card className={styles.card}>
        {hasRecord ? (
          <>
            {CHARTS.map(({ measure, title }) => (
              <WeekChart key={measure} title={t(title)} measure={measure} weeks={weeks} />
            ))}
            <p className={styles.note}>{t('log.trends.note', { weekday: weekday ?? '' })}</p>
          </>
        ) : (
          <p className={styles.empty}>{t('log.trends.empty')}</p>
        )}
      </Card>
    </section>
  )
}

interface WeekChartProps {
  title: string
  measure: Measure
  weeks: WeekTotals[]
}

/**
 * One measure, one bar per week, each against the most a whole week could hold.
 * The bars and figures are drawn for the eye only; each week is also written out
 * in full for screen readers.
 */
function WeekChart({ title, measure, weeks }: WeekChartProps) {
  const { t, n, locale } = useI18n()
  const captionId = useId()
  const max = DAILY_MAXIMUM[measure] * 7
  const shortDate = (key: DateKey) => formatDateKey(key, locale, { day: 'numeric', month: 'numeric' })
  const longDate = (key: DateKey) => formatDateKey(key, locale, { day: 'numeric', month: 'long' })

  return (
    <figure className={styles.chart} aria-labelledby={captionId} data-measure={measure}>
      <figcaption className={styles.caption}>
        <span id={captionId} className={styles.title}>
          {title}
        </span>
        <span className={styles.max}>{t('log.trends.max', { max })}</span>
      </figcaption>
      <ol className={styles.bars}>
        {weeks.map((week) => {
          const value = week[measure]
          const share = Math.min(1, value / max)
          return (
            <li key={week.start} className={styles.week} data-current={week.current || undefined}>
              <span className="visually-hidden">
                {week.current
                  ? t('log.trends.thisWeek', { date: longDate(week.start), count: value })
                  : t('log.trends.week', { date: longDate(week.start), count: value, max })}
              </span>
              <span className={cx(styles.value, 'tabular')} aria-hidden>
                {n(value)}
              </span>
              <span className={cx(styles.track, week.current && styles.current)} aria-hidden>
                <span
                  className={cx(styles.fill, value > 0 && styles.some)}
                  style={{ '--share': share } as CSSProperties}
                />
              </span>
              <span className={cx(styles.label, 'tabular')} aria-hidden>
                {shortDate(week.start)}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
