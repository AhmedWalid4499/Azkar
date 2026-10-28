import { ChevronDown, MoonStar } from 'lucide-react'
import { useId } from 'react'
import { formatDateKey, shiftDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useActiveTimeZone, useNow } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { Card } from '../../shared/ui'
import { SUNNAH_PRAYERS, SunnahToggle, usePrayerLog } from '../prayer-log'
import { usePrayerDay } from '../prayer-times'
import { useTodayLayout } from './layoutStore'
import { isBeforeDawn, sunnahDateKey } from './night'
import styles from './SunnahCard.module.css'

interface SunnahCardProps {
  /** Today's calendar day at the saved location. */
  today: DateKey
}

/**
 * Today's sunnah prayers as a row of chips, one tap each. Between midnight and
 * Fajr the prayers of the night still count for the night that is ending, so
 * they are set apart under the day they are filed for, like last night's Isha.
 * The card folds down to its heading, and stays that way until it is opened again.
 */
export function SunnahCard({ today }: SunnahCardProps) {
  const { t, locale } = useI18n()
  const bodyId = useId()
  const nightId = useId()
  const timeZone = useActiveTimeZone()
  const now = useNow(15_000)
  const prayerDay = usePrayerDay(today)
  const collapsed = useTodayLayout((state) => state.sunnahCollapsed)
  const setCollapsed = useTodayLayout((state) => state.setSunnahCollapsed)

  const beforeDawn = isBeforeDawn(now, timeZone, prayerDay)
  const filed = SUNNAH_PRAYERS.map((sunnah) => ({ sunnah, dateKey: sunnahDateKey(sunnah, today, beforeDawn) }))
  const ofToday = filed.filter((item) => item.dateKey === today)
  const ofLastNight = filed.filter((item) => item.dateKey !== today)
  const done = usePrayerLog(
    (state) => filed.filter(({ sunnah, dateKey }) => state.sunnah[dateKey]?.[sunnah] !== undefined).length,
  )

  return (
    <Card className={styles.card}>
      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed(!collapsed)}
        >
          <span className={styles.title}>{t('today.sunnah.title')}</span>{' '}
          <span className={`${styles.count} tabular`}>{t('today.sunnah.count', { done, total: filed.length })}</span>
          <ChevronDown aria-hidden size={20} className={styles.chevron} />
        </button>
      </h3>
      <div id={bodyId} className={styles.body} hidden={collapsed}>
        <div role="group" aria-label={t('today.sunnah.title')} className={styles.chips}>
          {ofToday.map(({ sunnah, dateKey }) => (
            <SunnahToggle key={sunnah} sunnah={sunnah} dateKey={dateKey} />
          ))}
        </div>
        {ofLastNight.length > 0 && (
          <div role="group" aria-labelledby={nightId} className={styles.night}>
            <p id={nightId} className={styles.nightLabel}>
              <MoonStar aria-hidden size={16} className={styles.nightIcon} />
              <span className={styles.nightName}>{t('today.sunnah.night')}</span>{' '}
              <span className={styles.nightDay}>
                {t('today.sunnah.night.day', { date: formatDateKey(shiftDateKey(today, -1), locale) })}
              </span>
            </p>
            <div className={styles.chips}>
              {ofLastNight.map(({ sunnah, dateKey }) => (
                <SunnahToggle key={sunnah} sunnah={sunnah} dateKey={dateKey} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
