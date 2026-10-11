import { Sprout } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../../shared/i18n'
import { useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { Card, PageHeader } from '../../shared/ui'
import { compareMonths, monthOfDateKey } from './calendar'
import type { MonthRef } from './calendar'
import { DayPanel } from './DayPanel'
import styles from './LogPage.module.css'
import { MonthBreakdown } from './MonthBreakdown'
import { MonthCalendar } from './MonthCalendar'
import { firstLoggedDay } from './stats'
import { StatsRow } from './StatsRow'
import { usePrayerLog } from './store'

/** The log: streaks and rates, a month calendar, the selected day's prayers and the month's breakdown. */
export function LogPage() {
  const { t } = useI18n()
  const today = useTodayKey()
  const entries = usePrayerLog((state) => state.entries)
  // `null` means "follow today", so an open page moves on with the date at midnight.
  const [pickedDay, setPickedDay] = useState<DateKey | null>(null)
  const [pickedMonth, setPickedMonth] = useState<MonthRef | null>(null)

  const currentMonth = monthOfDateKey(today)
  const selected = pickedDay !== null && pickedDay <= today ? pickedDay : today
  const month = pickedMonth !== null && compareMonths(pickedMonth, currentMonth) < 0 ? pickedMonth : currentMonth

  const hasLog = useMemo(() => firstLoggedDay(entries, today) !== null, [entries, today])

  const selectDay = useCallback((dateKey: DateKey) => setPickedDay(dateKey === today ? null : dateKey), [today])
  const backToToday = useCallback(() => {
    setPickedDay(null)
    setPickedMonth(null)
  }, [])

  return (
    <div className="page">
      <PageHeader title={t('log.title')} />

      {hasLog ? (
        <StatsRow entries={entries} today={today} />
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

      <DayPanel dateKey={selected} isToday={selected === today} />

      {hasLog && <MonthBreakdown month={month} today={today} entries={entries} />}
    </div>
  )
}
