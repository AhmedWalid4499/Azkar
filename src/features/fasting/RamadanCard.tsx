import { MoonStar } from 'lucide-react'
import { useId } from 'react'
import { shiftDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useNow, useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { usePrayerDay } from '../prayer-times'
import { describeDuration, formatCountdown, useClock, useWhen } from './format'
import { FastToggle } from './FastToggle'
import { ramadanDayOf } from './hijri'
import { useFastingDay } from './hooks'
import { describeFast } from './labels'
import styles from './RamadanCard.module.css'
import { ramadanTimes } from './ramadanTimes'
import type { RamadanMoment } from './ramadanTimes'
import { useFasting } from './store'
import type { FastRecord } from './types'

export interface RamadanCardProps {
  /** Today's calendar day at the saved location; read from the clock when omitted. */
  today?: DateKey
}

/**
 * Ramadan mode for the Today page: the day of Ramadan, when suhoor ends (Fajr)
 * and iftar is (Maghrib), a live countdown to the next of them, and today's
 * fast in one tap. Renders nothing outside Ramadan.
 */
export function RamadanCard({ today: given }: RamadanCardProps) {
  const clockToday = useTodayKey()
  const today = given ?? clockToday
  const day = useFastingDay(today)
  if (day.ramadanDay === null) return null
  return <RamadanCardBody today={today} ramadanDay={day.ramadanDay} offsetDays={day.offsetDays} record={day.record} />
}

interface BodyProps {
  today: DateKey
  ramadanDay: number
  offsetDays: number
  record: FastRecord | undefined
}

function RamadanCardBody({ today, ramadanDay, offsetDays, record }: BodyProps) {
  const i18n = useI18n()
  const { t } = i18n
  const headingId = useId()
  const now = useNow(1000)
  const tomorrow = shiftDateKey(today, 1)
  const todayTimes = usePrayerDay(today)
  const tomorrowTimes = usePrayerDay(tomorrow)
  const clock = useClock()
  const when = useWhen()
  const setFast = useFasting((state) => state.setFast)

  const tomorrowIsRamadan = ramadanDayOf(tomorrow, offsetDays) !== null
  const times = ramadanTimes(now, { today, todayTimes, tomorrow, tomorrowTimes, tomorrowIsRamadan })
  const fasting = record?.kind === 'ramadan' && record.status === 'fasted'
  const excused = record?.kind === 'ramadan' && record.status === 'excused'
  const lastIftarPast = !tomorrowIsRamadan && times.iftar !== null && now.getTime() >= times.iftar.getTime()

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.head}>
        <MoonStar aria-hidden size={22} className={styles.icon} />
        <div className={styles.headText}>
          <p className={styles.eyebrow}>{t('fasting.ramadan.title')}</p>
          <h2 id={headingId} className={styles.title}>
            {t('fasting.ramadan.day', { day: ramadanDay })}
          </h2>
        </div>
      </div>

      {todayTimes === null ? (
        <p className={styles.note}>{t('fasting.ramadan.noLocation')}</p>
      ) : (
        <>
          <dl className={styles.times}>
            {times.suhoorEnds && (
              <div className={styles.time}>
                <dt className={styles.timeLabel}>
                  {t('fasting.ramadan.suhoor')} <span className={styles.prayer}>{t('prayer.fajr')}</span>
                </dt>
                <dd className={`${styles.timeValue} tabular`}>{clock(times.suhoorEnds, todayTimes.timeZone)}</dd>
              </div>
            )}
            {times.iftar && (
              <div className={styles.time}>
                <dt className={styles.timeLabel}>
                  {t('fasting.ramadan.iftar')} <span className={styles.prayer}>{t('prayer.maghrib')}</span>
                </dt>
                <dd className={`${styles.timeValue} tabular`}>{clock(times.iftar, todayTimes.timeZone)}</dd>
              </div>
            )}
          </dl>
          {times.next && <Countdown moment={times.next} now={now} timeZone={todayTimes.timeZone} />}
          {lastIftarPast && <p className={styles.note}>{t('fasting.ramadan.eid')}</p>}
        </>
      )}

      <div className={styles.toggles}>
        <FastToggle pressed={fasting} onToggle={() => setFast(today, fasting ? null : { kind: 'ramadan', status: 'fasted' })}>
          {t('fasting.today.fasting')}
        </FastToggle>
        <FastToggle
          secondary
          pressed={excused}
          onToggle={() => setFast(today, excused ? null : { kind: 'ramadan', status: 'excused' })}
        >
          {t('fasting.today.excused')}
        </FastToggle>
      </div>
      {record && !fasting && !excused && (
        <p className={styles.logged}>{t('fasting.today.status', { status: describeFast(record, i18n) })}</p>
      )}
      {record?.at !== undefined && <p className={styles.logged}>{t('fasting.loggedAt', { when: when(record.at, today) })}</p>}
    </section>
  )
}

function Countdown({ moment, now, timeZone }: { moment: RamadanMoment; now: Date; timeZone: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const clock = useClock()
  const remaining = moment.at.getTime() - now.getTime()
  const label =
    moment.kind === 'iftar'
      ? 'fasting.ramadan.until.iftar'
      : moment.tomorrow
        ? 'fasting.ramadan.until.suhoorTomorrow'
        : 'fasting.ramadan.until.suhoor'
  const sentence =
    moment.kind === 'iftar'
      ? 'fasting.ramadan.sr.iftar'
      : moment.tomorrow
        ? 'fasting.ramadan.sr.suhoorTomorrow'
        : 'fasting.ramadan.sr.suhoor'

  return (
    <div className={styles.countdown}>
      {/* Ticks every second, so assistive tech reads the sentence below instead, and only when asked. */}
      <div aria-hidden className={styles.countdownVisual}>
        <span className={`${styles.digits} tabular`} dir="ltr">
          {formatCountdown(remaining, i18n)}
        </span>
        <span className={styles.countdownLabel}>{t(label)}</span>
      </div>
      <p className="visually-hidden">
        {t(sentence, { time: clock(moment.at, timeZone), duration: describeDuration(remaining, i18n) })}
      </p>
    </div>
  )
}
