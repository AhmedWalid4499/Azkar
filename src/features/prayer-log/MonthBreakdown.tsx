import { useId, useMemo } from 'react'
import { useI18n } from '../../shared/i18n'
import { PRAYERS } from '../../shared/types'
import type { DateKey } from '../../shared/types'
import { Card } from '../../shared/ui'
import { formatMonthTitle } from './calendar'
import type { MonthRef } from './calendar'
import { cx } from './cx'
import styles from './MonthBreakdown.module.css'
import { monthBreakdown, totalOf } from './stats'
import tone from './status.module.css'
import { StatusIcon } from './StatusIcon'
import { statusLabelKey } from './statusLabels'
import { PRAYER_STATUSES } from './types'
import type { LogEntries } from './types'

interface MonthBreakdownProps {
  month: MonthRef
  today: DateKey
  entries: LogEntries
}

/**
 * For each prayer, how the month's days split across the statuses.
 *
 * A bar's full length is the days of the month so far; what is not coloured
 * was not logged. The bars are a picture only: every count is also written out
 * for screen readers, and the legend gives the month's totals in figures.
 */
export function MonthBreakdown({ month, today, entries }: MonthBreakdownProps) {
  const { t, n, locale } = useI18n()
  const headingId = useId()
  const data = useMemo(
    () => monthBreakdown(entries, { year: month.year, month: month.month }, today),
    [entries, month.year, month.month, today],
  )

  const item = (status: string, count: number) => t('log.breakdown.item', { status, count })

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {t('log.breakdown.title', { month: formatMonthTitle(month, locale) })}
      </h2>
      <Card>
        {data.logged === 0 ? (
          <p className={styles.empty}>{t('log.breakdown.empty')}</p>
        ) : (
          <>
            <ul className={styles.rows}>
              {PRAYERS.map((prayer) => {
                const counts = data.byPrayer[prayer]
                const unlogged = data.elapsedDays - totalOf(counts)
                const name = t(`prayer.${prayer}`)
                const details = PRAYER_STATUSES.filter((status) => counts[status] > 0).map((status) =>
                  item(t(statusLabelKey(status)), counts[status]),
                )
                if (unlogged > 0) details.push(item(t('log.status.none'), unlogged))

                return (
                  <li key={prayer} className={styles.row}>
                    <span className={styles.name} aria-hidden>
                      {name}
                    </span>
                    <span className="visually-hidden">
                      {t('log.breakdown.row', { prayer: name, details: details.join(t('log.list.separator')) })}
                    </span>
                    <span className={styles.bar} aria-hidden>
                      {PRAYER_STATUSES.filter((status) => counts[status] > 0).map((status) => (
                        <span
                          key={status}
                          className={cx(styles.segment, tone[status])}
                          data-status={status}
                          style={{ flexGrow: counts[status] }}
                        />
                      ))}
                      {unlogged > 0 && <span className={styles.rest} style={{ flexGrow: unlogged }} />}
                    </span>
                  </li>
                )
              })}
            </ul>
            <ul className={styles.legend} aria-label={t('log.breakdown.legend')}>
              {PRAYER_STATUSES.map((status) => (
                <li key={status} className={cx(styles.legendItem, tone[status])}>
                  <span className={styles.swatch}>
                    <StatusIcon status={status} size={11} />
                  </span>
                  <span>{t(statusLabelKey(status))}</span>
                  <span className={cx(styles.count, 'tabular')}>{n(data.byStatus[status])}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  )
}
