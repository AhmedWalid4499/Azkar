import { CloudSun, Haze, MoonStar, Sun, Sunrise, Sunset } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { memo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import { TIME_SLOTS } from '../../shared/types'
import type { DateKey, PrayerDay, PrayerName, TimeSlot } from '../../shared/types'
import { Card, Notice } from '../../shared/ui'
import { hasMissingTimes, isValidTime } from './engine/compute'
import { cx, useClockFormat } from './format'
import { useLocalToday, usePrayerClock, usePrayerDay } from './hooks'
import styles from './PrayerTimesList.module.css'

export interface PrayerTimesListProps {
  dateKey: DateKey
  /** Rendered at the end of each of the five prayer rows (not sunrise), e.g. a log toggle. */
  renderTrailing?: (prayer: PrayerName) => ReactNode
}

const ICONS: Record<TimeSlot, LucideIcon> = {
  fajr: Haze,
  sunrise: Sunrise,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: Sunset,
  isha: MoonStar,
}

interface TimetableProps {
  day: PrayerDay
  current: PrayerName | null
  next: PrayerName | null
  renderTrailing?: (prayer: PrayerName) => ReactNode
}

const Timetable = memo(function Timetable({ day, current, next, renderTrailing }: TimetableProps) {
  const { t } = useI18n()
  const formatTime = useClockFormat()

  return (
    <div className={styles.wrap}>
      <Card flush>
        <ul className={styles.list}>
          {TIME_SLOTS.map((slot) => {
            const Icon = ICONS[slot]
            const at = day.times[slot]
            const isCurrent = slot === current
            const isNext = slot === next
            return (
              <li
                key={slot}
                className={cx(
                  styles.row,
                  slot === 'sunrise' && styles.secondary,
                  isCurrent && styles.current,
                  isNext && styles.next,
                )}
                aria-current={isCurrent ? 'time' : undefined}
              >
                <Icon aria-hidden className={styles.icon} size={slot === 'sunrise' ? 18 : 20} strokeWidth={1.9} />
                <span className={styles.label}>
                  <span className={styles.name}>{t(`prayer.${slot}`)}</span>
                  {isCurrent && <span className={cx(styles.badge, styles.badgeNow)}>{t('times.badge.now')}</span>}
                  {isNext && <span className={cx(styles.badge, styles.badgeNext)}>{t('times.badge.next')}</span>}
                </span>
                {isValidTime(at) ? (
                  <time className={`${styles.time} tabular`} dateTime={at.toISOString()}>
                    {formatTime(at, day.timeZone)}
                  </time>
                ) : (
                  <span className={styles.time}>
                    <span aria-hidden>—</span>
                    <span className="visually-hidden">{t('times.unavailable')}</span>
                  </span>
                )}
                {/* The slot is reserved on every row so times line up and nothing shifts when a control mounts. */}
                {renderTrailing && <span className={styles.trailing}>{slot !== 'sunrise' && renderTrailing(slot)}</span>}
              </li>
            )
          })}
        </ul>
      </Card>
      {hasMissingTimes(day) && (
        <Notice tone="warn">
          {t('times.unavailable.hint')} <Link to="/settings">{t('times.unavailable.action')}</Link>
        </Notice>
      )}
    </div>
  )
})

/** Today's list follows the clock; only the two markers change, so the rows re-render five times a day. */
function LiveTimetable({ day, renderTrailing }: Pick<TimetableProps, 'day' | 'renderTrailing'>) {
  const { current, next } = usePrayerClock()
  return (
    <Timetable
      day={day}
      current={current?.dateKey === day.dateKey ? current.prayer : null}
      next={next?.dateKey === day.dateKey ? next.prayer : null}
      renderTrailing={renderTrailing}
    />
  )
}

/** The day's timetable: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha. */
export function PrayerTimesList({ dateKey, renderTrailing }: PrayerTimesListProps) {
  const day = usePrayerDay(dateKey)
  const today = useLocalToday()
  if (!day) return null
  return day.dateKey === today ? (
    <LiveTimetable day={day} renderTrailing={renderTrailing} />
  ) : (
    <Timetable day={day} current={null} next={null} renderTrailing={renderTrailing} />
  )
}
