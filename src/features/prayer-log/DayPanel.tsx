import { MoonStar } from 'lucide-react'
import { useId, useRef } from 'react'
import type { Ref } from 'react'
import { formatClock, formatDateKey, formatHijri, shiftDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { PRAYERS } from '../../shared/types'
import type { DateKey, PrayerDay, PrayerName } from '../../shared/types'
import { Button, Card } from '../../shared/ui'
import { useAzkarClock } from '../azkar'
import { usePrayerDay } from '../prayer-times'
import { cx } from './cx'
import { DayAzkar } from './DayAzkar'
import styles from './DayPanel.module.css'
import { DaySunnah } from './DaySunnah'
import { useStamp } from './stamps'
import { StatusPicker } from './StatusPicker'
import { usePrayerLog, usePrayerLoggedAt, usePrayerStatus } from './store'

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
  /** The day's heading, focusable, for a page that sends the reader here from elsewhere. */
  headingRef?: Ref<HTMLHeadingElement>
  /** Selects another day, for the way back to last night before Fajr. */
  onOpenDay: (dateKey: DateKey) => void
}

/**
 * Everything recorded for one day: the five prayers with their full status choice
 * and when each was logged, the sunnah prayers, and the morning and evening azkar.
 */
export function DayPanel({ dateKey, isToday, headingRef, onOpenDay }: DayPanelProps) {
  const { t, locale } = useI18n()
  // Read before the timetable of the day on show, which is the one asked for last.
  const clock = useAzkarClock()
  const hijriOffset = useSettings((state) => state.hijriOffset)
  const hour12 = useSettings((state) => state.timeFormat) === '12h'
  const prayerDay = usePrayerDay(dateKey)
  const headingId = useId()
  const prayersId = useId()
  const night = isToday && clock.phase === 'beforeDawn'

  return (
    <section aria-labelledby={headingId} className={styles.panel}>
      <Card>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.date}>
              {formatDateKey(dateKey, locale, FULL_DATE)}
            </h2>
            <p className={styles.hijri}>{formatHijri(dateKey, locale, hijriOffset)}</p>
          </div>
          {isToday && <span className={styles.today}>{t('log.day.today')}</span>}
        </header>
        {night && (
          <div className={styles.night}>
            <MoonStar aria-hidden size={18} className={styles.nightIcon} />
            <p className={styles.nightText}>{t('log.day.night')}</p>
            <Button variant="ghost" size="s" className={styles.nightOpen} onClick={() => onOpenDay(shiftDateKey(dateKey, -1))}>
              {t('log.day.night.open')}
            </Button>
          </div>
        )}
        <h3 id={prayersId} className={styles.groupTitle}>
          {t('log.day.obligatory')}
        </h3>
        <ul className={styles.prayers} aria-labelledby={prayersId}>
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
      <DaySunnah dateKey={dateKey} />
      <DayAzkar dateKey={dateKey} clock={clock} />
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
  const loggedAt = usePrayerLoggedAt(dateKey, prayer)
  const setStatus = usePrayerLog((state) => state.setStatus)
  const stamp = useStamp()
  const picker = useRef<HTMLDivElement>(null)
  const name = t(`prayer.${prayer}`)

  const clear = () => {
    // The button unmounts once the entry is gone; hand focus to the choices it belonged to.
    picker.current?.querySelector('input')?.focus()
    setStatus(dateKey, prayer, null)
  }

  // Entries kept from before times were recorded have a status but no time.
  let logged: string | null = null
  if (status !== null && loggedAt !== null) {
    const { time: at, date } = stamp(loggedAt, dateKey)
    logged = date === null ? t('log.day.loggedAt', { time: at }) : t('log.day.loggedOn', { date, time: at })
  }

  return (
    <li className={styles.prayer}>
      <div className={styles.prayerHead}>
        <h4 className={styles.prayerName}>{name}</h4>
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
      {logged !== null && <p className={cx(styles.loggedAt, 'tabular')}>{logged}</p>}
    </li>
  )
}
