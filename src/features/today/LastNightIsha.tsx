import { MoonStar } from 'lucide-react'
import { useId, useState } from 'react'
import { formatDateKey, shiftDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useActiveTimeZone, useNow } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { Card } from '../../shared/ui'
import { PrayerLogToggle, usePrayerStatus } from '../prayer-log'
import { usePrayerDay } from '../prayer-times'
import { isBeforeDawn } from './night'
import styles from './TodayPage.module.css'

interface LastNightIshaProps {
  /** Today's calendar day at the saved location. */
  today: DateKey
}

function Row({ today, yesterday }: { today: DateKey; yesterday: DateKey }) {
  const { t, locale } = useI18n()
  const labelId = useId()
  const timeZone = useActiveTimeZone()
  const now = useNow(15_000)
  const prayerDay = usePrayerDay(today)
  const status = usePrayerStatus(yesterday, 'isha')
  // Logged from here, the row stays for the rest of the visit: the tap shows its
  // result, keeps the focus and can be corrected. It is gone the next time the page opens.
  const [unloggedOnArrival] = useState(status === null)

  if (!isBeforeDawn(now, timeZone, prayerDay)) return null
  if (status !== null && !unloggedOnArrival) return null

  return (
    <Card flush>
      {/* The toggle names only the prayer; the group says which night's it is. */}
      <div className={styles.lastNight} role="group" aria-labelledby={labelId}>
        <MoonStar aria-hidden className={styles.lastNightIcon} size={20} strokeWidth={1.9} />
        <span id={labelId} className={styles.lastNightLabel}>
          <span className={styles.lastNightName}>{t('today.lastNightIsha')}</span>{' '}
          <span className={styles.lastNightDay}>
            {t('today.lastNightIsha.day', { date: formatDateKey(yesterday, locale) })}
          </span>
        </span>
        <span className={styles.lastNightToggle}>
          <PrayerLogToggle prayer="isha" dateKey={yesterday} />
        </span>
      </div>
    </Card>
  )
}

/**
 * After midnight the timetable already shows the new day, and its Isha toggle
 * means the coming night's. Until Fajr this row offers the Isha of the night
 * that is ending, while it is still unlogged, so that ticking it off after
 * midnight files it under the day it belongs to.
 */
export function LastNightIsha({ today }: LastNightIshaProps) {
  const yesterday = shiftDateKey(today, -1)
  // Keyed by the night, so what the row remembers about one does not carry into the next.
  return <Row key={yesterday} today={today} yesterday={yesterday} />
}
