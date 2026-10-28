import { MoonStar, Sprout, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Card } from '../../shared/ui'
import { COLLECTION_META, useAzkarStreaks } from '../azkar'
import type { Streak } from '../azkar'
import { MissedPrayers } from './MissedPrayers'
import styles from './Overview.module.css'
import { computeStreaks } from './stats'
import { usePrayerLog } from './store'
import { witrStreaks } from './sunnahStats'
import { Tile, Tiles } from './Tile'

interface OverviewProps {
  today: DateKey
  /** The day streaks are counted up to: the day before, between midnight and Fajr. */
  statsDay: DateKey
  /** Selects a day in the calendar and opens it in the day panel. */
  onOpenDay: (dateKey: DateKey) => void
}

/** The five prayers' streaks, the other streaks, and the missed prayers still to make up. */
export function Overview({ today, statsDay, onOpenDay }: OverviewProps) {
  const { t, tp } = useI18n()
  const headingId = useId()
  const entries = usePrayerLog((state) => state.entries)
  const sunnah = usePrayerLog((state) => state.sunnah)
  const azkar = useAzkarStreaks()
  const streaks = useMemo(
    () => ({ prayers: computeStreaks(entries, statsDay), witr: witrStreaks(sunnah, entries, statsDay) }),
    [entries, sunnah, statsDay],
  )

  return (
    <section aria-labelledby={headingId} className={styles.overview}>
      <h2 id={headingId} className="visually-hidden">
        {t('log.stats.heading')}
      </h2>
      <Tiles>
        <Tile icon={Sprout} label={t('log.stats.current')} value={tp('log.days', streaks.prayers.current)} />
        <Tile icon={Star} accent label={t('log.stats.best')} value={tp('log.days', streaks.prayers.best)} />
      </Tiles>
      <p className={styles.note}>{t('log.stats.note')}</p>
      <MoreStreaks
        rows={[
          { id: 'witr', icon: MoonStar, label: t('log.sunnah.witr'), streak: streaks.witr },
          { id: 'morning', icon: COLLECTION_META.morning.icon, label: t('azkar.collection.morning'), streak: azkar.morning },
          { id: 'evening', icon: COLLECTION_META.evening.icon, label: t('azkar.collection.evening'), streak: azkar.evening },
        ]}
      />
      <MissedPrayers today={today} onOpenDay={onOpenDay} />
    </section>
  )
}

interface StreakRow {
  id: string
  icon: LucideIcon
  label: string
  streak: Streak
}

function MoreStreaks({ rows }: { rows: StreakRow[] }) {
  const { t, tp } = useI18n()
  return (
    <Card className={styles.more}>
      <h3 className={styles.moreTitle}>{t('log.streaks.title')}</h3>
      <dl className={styles.streaks}>
        {rows.map(({ id, icon: Icon, label, streak }) => (
          <div key={id} className={styles.streak}>
            <dt className={styles.streakName}>
              <Icon aria-hidden size={16} className={styles.streakIcon} />
              <span>{label}</span>
            </dt>
            <dd className={styles.streakValue}>
              {t('log.streaks.value', { current: tp('log.days', streak.current), best: tp('log.days', streak.best) })}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
