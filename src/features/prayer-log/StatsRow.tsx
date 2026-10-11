import { CalendarDays, CalendarRange, Sprout, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { ProgressBar } from '../../shared/ui'
import { cx } from './cx'
import { completionRate, computeStreaks, wholePercent } from './stats'
import type { CompletionRate } from './stats'
import styles from './StatsRow.module.css'
import type { LogEntries } from './types'

interface StatsRowProps {
  entries: LogEntries
  today: DateKey
}

/** Current and best streak, and how much of the last week and month was prayed. */
export function StatsRow({ entries, today }: StatsRowProps) {
  const { t, tp } = useI18n()
  const headingId = useId()
  const stats = useMemo(
    () => ({
      streaks: computeStreaks(entries, today),
      week: completionRate(entries, today, 7),
      month: completionRate(entries, today, 30),
    }),
    [entries, today],
  )

  return (
    <section aria-labelledby={headingId} className={styles.stats}>
      <h2 id={headingId} className="visually-hidden">
        {t('log.stats.heading')}
      </h2>
      <dl className={styles.tiles}>
        <Tile icon={Sprout} label={t('log.stats.current')} value={tp('log.days', stats.streaks.current)} />
        <Tile icon={Star} accent label={t('log.stats.best')} value={tp('log.days', stats.streaks.best)} />
        <RateTile icon={CalendarDays} label={tp('log.stats.window', 7)} rate={stats.week} />
        <RateTile icon={CalendarRange} label={tp('log.stats.window', 30)} rate={stats.month} />
      </dl>
      <p className={styles.note}>{t('log.stats.note')}</p>
    </section>
  )
}

interface TileProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  /** Gold instead of emerald for the icon. */
  accent?: boolean
  children?: ReactNode
}

function Tile({ icon: Icon, label, value, accent, children }: TileProps) {
  return (
    <div className={styles.tile}>
      <dt className={styles.label}>
        <Icon aria-hidden size={16} className={cx(styles.icon, accent && styles.accent)} />
        <span>{label}</span>
      </dt>
      <dd className={styles.figure}>
        <span className={cx(styles.value, 'tabular')}>{value}</span>
        {children}
      </dd>
    </div>
  )
}

interface RateTileProps {
  icon: LucideIcon
  label: string
  rate: CompletionRate
}

function RateTile({ icon, label, rate }: RateTileProps) {
  const { t, locale } = useI18n()
  const percent = wholePercent(rate)

  if (percent === null) {
    return (
      <Tile icon={icon} label={label} value={<span aria-hidden>—</span>}>
        <span className={styles.detail}>{t('log.stats.noData')}</span>
      </Tile>
    )
  }

  const formatted = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100)
  return (
    <Tile icon={icon} label={label} value={formatted}>
      {/* The bar repeats the figure beside it, so it is kept out of the accessibility tree. */}
      <div aria-hidden>
        <ProgressBar value={percent / 100} label={label} />
      </div>
      <span className={styles.detail}>{t('log.stats.detail', { prayed: rate.prayed, due: rate.due })}</span>
    </Tile>
  )
}
