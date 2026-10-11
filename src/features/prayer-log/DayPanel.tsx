import { useId, useRef } from 'react'
import { formatClock, formatDateKey, formatHijri } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerDay, PrayerName } from '../../shared/types'
import { Button, Card } from '../../shared/ui'
import { usePrayerDay } from '../prayer-times'
import { cx } from './cx'
import styles from './DayPanel.module.css'
import { StatusPicker } from './StatusPicker'
import { usePrayerLog, usePrayerStatus } from './store'

const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }

function timeOf(day: PrayerDay | null, dateKey: DateKey, prayer: PrayerName): Date | null {
  // Times are optional here: there may be no saved location, or the hook may
  // still be holding another day's timetable.
  if (!day || day.dateKey !== dateKey) return null
  const at = day.times[prayer]
  return at instanceof Date && !Number.isNaN(at.getTime()) ? at : null
}

interface DayPanelProps {
  dateKey: DateKey
  isToday: boolean
}

/** One day's five prayers, each with its full status choice. */
export function DayPanel({ dateKey, isToday }: DayPanelProps) {
  const { t, locale } = useI18n()
  const hijriOffset = useSettings((state) => state.hijriOffset)
  const hour12 = useSettings((state) => state.timeFormat) === '12h'
  const prayerDay = usePrayerDay(dateKey)
  const headingId = useId()

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={headingId} className={styles.date}>
              {formatDateKey(dateKey, locale, FULL_DATE)}
            </h2>
            <p className={styles.hijri}>{formatHijri(dateKey, locale, hijriOffset)}</p>
          </div>
          {isToday && <span className={styles.today}>{t('log.day.today')}</span>}
        </header>
        <ul className={styles.prayers}>
          {PRAYERS.map((prayer) => {
            const at = timeOf(prayerDay, dateKey, prayer)
            return (
              <PrayerRow
                key={prayer}
                dateKey={dateKey}
                prayer={prayer}
                time={at && prayerDay ? formatClock(at, locale, prayerDay.timeZone, hour12) : null}
              />
            )
          })}
        </ul>
      </Card>
    </section>
  )
}

interface PrayerRowProps {
  dateKey: DateKey
  prayer: PrayerName
  time: string | null
}

function PrayerRow({ dateKey, prayer, time }: PrayerRowProps) {
  const { t } = useI18n()
  const status = usePrayerStatus(dateKey, prayer)
  const setStatus = usePrayerLog((state) => state.setStatus)
  const picker = useRef<HTMLDivElement>(null)
  const name = t(`prayer.${prayer}`)

  const clear = () => {
    // The button unmounts once the entry is gone; hand focus to the choices it belonged to.
    picker.current?.querySelector('input')?.focus()
    setStatus(dateKey, prayer, null)
  }

  return (
    <li className={styles.prayer}>
      <div className={styles.prayerHead}>
        <h3 className={styles.prayerName}>{name}</h3>
        <span className={cx(styles.time, 'tabular')}>{time}</span>
        {status !== null && (
          <Button
            variant="ghost"
            size="s"
            className={styles.clear}
            aria-label={t('log.clear.prayer', { prayer: name })}
            onClick={clear}
          >
            {t('log.clear.short')}
          </Button>
        )}
      </div>
      <StatusPicker
        ref={picker}
        label={t('log.picker.label', { prayer: name })}
        value={status}
        onChange={(next) => setStatus(dateKey, prayer, next)}
      />
    </li>
  )
}
