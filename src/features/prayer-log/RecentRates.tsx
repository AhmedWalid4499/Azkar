import { CalendarCheck, MoonStar } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Card, ProgressBar } from '../../shared/ui'
import { COLLECTION_META, ratePercent, useAzkarCompletionRate } from '../azkar'
import type { AzkarRate } from '../azkar'
import styles from './RecentRates.module.css'
import { completionRate, wholePercent } from './stats'
import type { CompletionRate } from './stats'
import { usePrayerLog } from './store'
import { sunnahCompletion } from './sunnahStats'

const WEEK = 7
const MONTH = 30

interface Rate {
  percent: number | null
  detail: string
}

interface RateRow {
  id: string
  icon: LucideIcon
  label: string
  week: Rate
  month: Rate
}

interface RecentRatesProps {
  /** The day rates are counted up to: the day before, between midnight and Fajr. */
  statsDay: DateKey
}

/** The last 7 and 30 days for the obligatory prayers, the sunnah prayers and the morning and evening azkar. */
export function RecentRates({ statsDay }: RecentRatesProps) {
  const { t, tp } = useI18n()
  const headingId = useId()
  const entries = usePrayerLog((state) => state.entries)
  const sunnah = usePrayerLog((state) => state.sunnah)
  const azkarWeek = useAzkarCompletionRate(WEEK)
  const azkarMonth = useAzkarCompletionRate(MONTH)

  const prayers = useMemo(
    () => ({
      week: completionRate(entries, statsDay, WEEK),
      month: completionRate(entries, statsDay, MONTH),
      sunnahWeek: sunnahCompletion(sunnah, entries, statsDay, WEEK),
      sunnahMonth: sunnahCompletion(sunnah, entries, statsDay, MONTH),
    }),
    [entries, sunnah, statsDay],
  )

  const prayed = (rate: CompletionRate): Rate => ({
    percent: wholePercent(rate),
    detail: t('log.stats.detail', { prayed: rate.prayed, due: rate.due }),
  })
  const done = (rate: CompletionRate): Rate => ({
    percent: wholePercent(rate),
    detail: t('log.rates.sunnah.detail', { done: rate.prayed, due: rate.due }),
  })
  const completed = (rate: AzkarRate): Rate => ({
    percent: ratePercent(rate),
    detail: t('log.rates.azkar.detail', { done: rate.completed, due: rate.due }),
  })

  const rows: RateRow[] = [
    {
      id: 'prayers',
      icon: CalendarCheck,
      label: t('log.rates.prayers'),
      week: prayed(prayers.week),
      month: prayed(prayers.month),
    },
    {
      id: 'sunnah',
      icon: MoonStar,
      label: t('log.sunnah.title'),
      week: done(prayers.sunnahWeek),
      month: done(prayers.sunnahMonth),
    },
    {
      id: 'morning',
      icon: COLLECTION_META.morning.icon,
      label: t('azkar.collection.morning'),
      week: completed(azkarWeek.morning),
      month: completed(azkarMonth.morning),
    },
    {
      id: 'evening',
      icon: COLLECTION_META.evening.icon,
      label: t('azkar.collection.evening'),
      week: completed(azkarWeek.evening),
      month: completed(azkarMonth.evening),
    },
  ]

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {t('log.rates.title', { week: WEEK, month: MONTH })}
      </h2>
      <Card className={styles.card}>
        <table className={styles.table} aria-labelledby={headingId}>
          <thead>
            <tr>
              <td className={styles.corner} />
              <th scope="col" className={styles.column}>
                {tp('log.stats.window', WEEK)}
              </th>
              <th scope="col" className={styles.column}>
                {tp('log.stats.window', MONTH)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, icon: Icon, label, week, month }) => (
              <tr key={id} data-rate={id} className={styles.row}>
                <th scope="row" className={styles.name}>
                  <Icon aria-hidden size={16} className={styles.icon} />
                  <span>{label}</span>
                </th>
                <RateCell label={label} rate={week} />
                <RateCell label={label} rate={month} />
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  )
}

function RateCell({ label, rate }: { label: string; rate: Rate }) {
  const { t, locale } = useI18n()
  if (rate.percent === null) {
    return (
      <td className={styles.cell}>
        <span className={styles.value} aria-hidden>
          —
        </span>
        <span className={styles.detail}>{t('log.stats.noData')}</span>
      </td>
    )
  }
  const formatted = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(rate.percent / 100)
  return (
    <td className={styles.cell}>
      <span className={`${styles.value} tabular`}>{formatted}</span>
      {/* The bar repeats the figure beside it, so it is kept out of the accessibility tree. */}
      <div className={styles.bar} aria-hidden>
        <ProgressBar value={rate.percent / 100} label={label} />
      </div>
      <span className={styles.detail}>{rate.detail}</span>
    </td>
  )
}
