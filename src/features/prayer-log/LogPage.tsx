import { Sprout } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Card, PageHeader } from '../../shared/ui'
import { useAzkarClock, useAzkarProgress } from '../azkar'
import { compareMonths, monthOfDateKey } from './calendar'
import type { MonthRef } from './calendar'
import { DayPanel } from './DayPanel'
import { ExportHistory } from './ExportHistory'
import { LifetimeTotals } from './LifetimeTotals'
import styles from './LogPage.module.css'
import { MonthBreakdown } from './MonthBreakdown'
import { MonthCalendar } from './MonthCalendar'
import { Overview } from './Overview'
import { RecentRates } from './RecentRates'
import { firstLoggedDay } from './stats'
import { usePrayerLog } from './store'
import { hasAnyRecord, statsDayOf } from './trackerStats'
import { Trends } from './Trends'

/**
 * The tracker: everything recorded, in one place. Streaks, the last week and month,
 * missed prayers still owed and all-time totals; a month calendar; the selected day
 * in full; the month by prayer; the last eight weeks; and the export of it all.
 */
export function LogPage() {
  const { t } = useI18n()
  const { today, phase } = useAzkarClock()
  const entries = usePrayerLog((state) => state.entries)
  const sunnah = usePrayerLog((state) => state.sunnah)
  const sessions = useAzkarProgress((state) => state.sessions)
  // `null` means "follow today", so an open page moves on with the date at midnight.
  const [pickedDay, setPickedDay] = useState<DateKey | null>(null)
  const [pickedMonth, setPickedMonth] = useState<MonthRef | null>(null)
  const dayHeading = useRef<HTMLHeadingElement>(null)
  const focusDay = useRef(false)

  const currentMonth = monthOfDateKey(today)
  const selected = pickedDay !== null && pickedDay <= today ? pickedDay : today
  const month = pickedMonth !== null && compareMonths(pickedMonth, currentMonth) < 0 ? pickedMonth : currentMonth
  const statsDay = statsDayOf(today, phase)

  const hasLog = useMemo(() => firstLoggedDay(entries, today) !== null, [entries, today])
  const hasRecord = useMemo(() => hasAnyRecord(entries, sunnah, sessions, today), [entries, sunnah, sessions, today])

  const selectDay = useCallback((dateKey: DateKey) => setPickedDay(dateKey === today ? null : dateKey), [today])
  const backToToday = useCallback(() => {
    setPickedDay(null)
    setPickedMonth(null)
  }, [])
  // From the list of missed prayers, or last night's link: show the day, then take the reader to it.
  const openDay = useCallback(
    (dateKey: DateKey) => {
      setPickedDay(dateKey === today ? null : dateKey)
      setPickedMonth(monthOfDateKey(dateKey))
      focusDay.current = true
    },
    [today],
  )

  useEffect(() => {
    if (!focusDay.current) return
    focusDay.current = false
    const heading = dayHeading.current
    heading?.focus()
    heading?.scrollIntoView?.({ block: 'start' })
  })

  return (
    <div className="page">
      <PageHeader title={t('log.title')} subtitle={t('log.subtitle')} />

      {hasRecord ? (
        <>
          <Overview today={today} statsDay={statsDay} onOpenDay={openDay} />
          <RecentRates statsDay={statsDay} />
          <LifetimeTotals today={today} />
        </>
      ) : (
        <Card className={styles.welcome}>
          <span className={styles.welcomeIcon}>
            <Sprout aria-hidden size={22} />
          </span>
          <div>
            <h2 className={styles.welcomeTitle}>{t('log.empty.title')}</h2>
            <p className={styles.welcomeBody}>{t('log.empty.body')}</p>
          </div>
        </Card>
      )}

      <MonthCalendar
        month={month}
        today={today}
        selected={selected}
        onSelect={selectDay}
        onMonthChange={setPickedMonth}
        onToday={backToToday}
      />

      <DayPanel dateKey={selected} isToday={selected === today} headingRef={dayHeading} onOpenDay={openDay} />

      {hasLog && <MonthBreakdown month={month} today={today} entries={entries} />}

      <Trends today={today} hasRecord={hasRecord} />

      <ExportHistory hasRecord={hasRecord} />
    </div>
  )
}
