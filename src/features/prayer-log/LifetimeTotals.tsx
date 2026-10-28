import { BookOpenCheck, CheckCheck, MoonStar, Repeat } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { useAzkarLifetime } from '../azkar'
import styles from './LifetimeTotals.module.css'
import { usePrayerLog } from './store'
import { Tile, Tiles } from './Tile'
import { lifetimePrayers } from './trackerStats'

interface LifetimeTotalsProps {
  today: DateKey
}

/** Everything ever recorded: prayers prayed, sunnah prayers, azkar sessions completed and recitations. */
export function LifetimeTotals({ today }: LifetimeTotalsProps) {
  const { t, locale } = useI18n()
  const headingId = useId()
  const entries = usePrayerLog((state) => state.entries)
  const sunnah = usePrayerLog((state) => state.sunnah)
  const azkar = useAzkarLifetime()
  const prayers = useMemo(() => lifetimePrayers(entries, sunnah, today), [entries, sunnah, today])
  // These grow into the thousands, so they are grouped the locale's way.
  const count = useMemo(() => new Intl.NumberFormat(locale).format, [locale])

  const { morning, evening, sleep } = azkar.sessionsCompleted
  const sessions = { morning: count(morning), evening: count(evening), sleep: count(sleep) }

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {t('log.lifetime.title')}
      </h2>
      <Tiles four>
        <Tile
          icon={CheckCheck}
          label={t('log.lifetime.prayers')}
          value={count(prayers.prayed)}
          detail={t('log.lifetime.prayers.detail', { count: count(prayers.logged) })}
        />
        <Tile icon={MoonStar} accent label={t('log.lifetime.sunnah')} value={count(prayers.sunnah)} />
        <Tile
          icon={BookOpenCheck}
          label={t('log.lifetime.sessions')}
          value={count(morning + evening + sleep)}
          detail={t(sleep > 0 ? 'log.lifetime.sessions.detail.sleep' : 'log.lifetime.sessions.detail', sessions)}
        />
        <Tile
          icon={Repeat}
          accent
          label={t('log.lifetime.recitations')}
          value={count(azkar.recitations)}
          detail={t('log.lifetime.recitations.detail')}
        />
      </Tiles>
    </section>
  )
}
