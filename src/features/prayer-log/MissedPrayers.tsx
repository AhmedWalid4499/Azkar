import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Sheet } from '../../shared/ui'
import styles from './MissedPrayers.module.css'
import { outstandingMissed } from './stats'
import { usePrayerLog } from './store'

const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }

interface MissedPrayersProps {
  today: DateKey
  onOpenDay: (dateKey: DateKey) => void
}

/** How many prayers logged as missed are still to be made up, opening onto the days they fall on. */
export function MissedPrayers({ today, onOpenDay }: MissedPrayersProps) {
  const { t, tp, dir, locale } = useI18n()
  const entries = usePrayerLog((state) => state.entries)
  const missed = useMemo(() => outstandingMissed(entries, today), [entries, today])
  const [open, setOpen] = useState(false)
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  // Built only while the sheet is open, in one pass: a long list of prayers to make up would
  // otherwise be regrouped and every date formatted again on each render of the page.
  const days = useMemo(() => {
    if (!open) return []
    const byDate = new Map<DateKey, string[]>()
    for (const { dateKey, prayer } of missed.prayers) {
      const names = byDate.get(dateKey) ?? []
      names.push(t(`prayer.${prayer}`))
      byDate.set(dateKey, names)
    }
    return missed.dates.map((dateKey) => ({
      dateKey,
      date: formatDateKey(dateKey, locale, FULL_DATE),
      prayers: (byDate.get(dateKey) ?? []).join(t('log.list.separator')),
    }))
  }, [open, missed, locale, t])

  if (missed.count === 0) {
    return (
      <p className={styles.none}>
        <CircleCheck aria-hidden size={18} className={styles.noneIcon} />
        <span>{t('log.missed.none')}</span>
      </p>
    )
  }

  return (
    <>
      <button type="button" className={styles.open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <CircleAlert aria-hidden size={20} className={styles.openIcon} />
        <span className={styles.openText}>{tp('log.missed.count', missed.count)}</span>
        <Chevron aria-hidden size={18} className={styles.chevron} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('log.missed.title')}>
        <p className={styles.body}>{t('log.missed.body')}</p>
        <ul className={styles.days}>
          {days.map(({ dateKey, date, prayers }) => (
            <li key={dateKey}>
              <button
                type="button"
                className={styles.day}
                aria-label={t('log.missed.day', { date, prayers })}
                onClick={() => {
                  setOpen(false)
                  onOpenDay(dateKey)
                }}
              >
                <span className={styles.dayText}>
                  <span className={styles.date}>{date}</span>
                  <span className={styles.prayers}>{prayers}</span>
                </span>
                <Chevron aria-hidden size={18} className={styles.chevron} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
