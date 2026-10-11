import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { formatDateKey, partsOfDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { PRAYERS } from '../../shared/types'
import type { DateKey } from '../../shared/types'
import { Button, Card, IconButton } from '../../shared/ui'
import {
  buildMonthGrid,
  compareMonths,
  dateKeyInMonth,
  formatMonthTitle,
  hijriSpanOfMonth,
  isInMonth,
  monthOfDateKey,
  moveInGrid,
  shiftMonth,
  weekdayNames,
  weekdayOrder,
  weekStartOf,
} from './calendar'
import type { MonthRef } from './calendar'
import { cx } from './cx'
import styles from './MonthCalendar.module.css'
import tone from './status.module.css'
import { usePrayerLog } from './store'
import type { DayLog } from './types'

const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }

interface MonthCalendarProps {
  /** The month on show. Never later than today's month. */
  month: MonthRef
  today: DateKey
  selected: DateKey
  onSelect: (dateKey: DateKey) => void
  onMonthChange: (month: MonthRef) => void
  /** Return the calendar to today's month with today selected. */
  onToday: () => void
}

/**
 * Month grid of the log. Each day shows five marks, one per prayer.
 *
 * Keyboard: the grid is a single tab stop. Arrow keys move by day (left and
 * right follow the reading direction) and by week, Home and End go to the
 * edges of the week, PageUp and PageDown change month, and Enter or Space
 * selects the focused day. Focus never moves past today.
 */
export function MonthCalendar({ month, today, selected, onSelect, onMonthChange, onToday }: MonthCalendarProps) {
  const { t, lang, dir, locale } = useI18n()
  const hijriOffset = useSettings((state) => state.hijriOffset)
  const entries = usePrayerLog((state) => state.entries)
  const titleId = useId()
  const grid = useRef<HTMLTableElement>(null)
  // A day to focus once it has rendered, for moves that land in another month.
  const focusAfterRender = useRef<DateKey | null>(null)
  const [focusKey, setFocusKey] = useState<DateKey | null>(null)

  const weekStart = useMemo(() => weekStartOf(lang), [lang])
  const weeks = useMemo(
    () => buildMonthGrid({ year: month.year, month: month.month }, weekStart),
    [month.year, month.month, weekStart],
  )
  const weekdays = useMemo(
    () => ({
      // Arabic has no abbreviated weekday names; its calendars use the initial letter.
      short: weekdayNames(locale, lang === 'ar' ? 'narrow' : 'short'),
      long: weekdayNames(locale, 'long'),
    }),
    [locale, lang],
  )
  const hijri = useMemo(
    () => hijriSpanOfMonth({ year: month.year, month: month.month }, locale, hijriOffset),
    [month.year, month.month, locale, hijriOffset],
  )

  const atCurrentMonth = compareMonths(month, monthOfDateKey(today)) >= 0
  const awayFromToday = selected !== today || !isInMonth(today, month)

  // Roving tab stop: wherever focus last was, else the selected day, else today, else the 1st.
  const canFocus = (key: DateKey | null): key is DateKey => key !== null && key <= today && isInMonth(key, month)
  const tabStop = [focusKey, selected, today].find(canFocus) ?? dateKeyInMonth(month, 1)

  const findDay = (key: DateKey) => grid.current?.querySelector<HTMLButtonElement>(`button[data-date="${key}"]`)

  useEffect(() => {
    const key = focusAfterRender.current
    if (key === null) return
    focusAfterRender.current = null
    findDay(key)?.focus()
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const from = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]')?.dataset.date
    if (!from) return
    const target = moveInGrid(event.key, from, { dir, weekStart, today })
    if (target === null) return
    event.preventDefault()
    if (target === from) return

    setFocusKey(target)
    if (isInMonth(target, month)) {
      findDay(target)?.focus()
    } else {
      focusAfterRender.current = target
      onMonthChange(monthOfDateKey(target))
    }
  }

  const goToToday = () => {
    // The button disappears once we are back; today's cell is the natural place for focus to land.
    focusAfterRender.current = today
    setFocusKey(today)
    onToday()
  }

  const Previous = dir === 'rtl' ? ChevronRight : ChevronLeft
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight

  return (
    <section aria-labelledby={titleId}>
      <Card flush>
        <div className={styles.body}>
          <div className={styles.header}>
            <IconButton label={t('log.calendar.prev')} onClick={() => onMonthChange(shiftMonth(month, -1))}>
              <Previous aria-hidden size={22} />
            </IconButton>
            <div className={styles.title} aria-live="polite" aria-atomic>
              <h2 id={titleId} className={styles.gregorian}>
                {formatMonthTitle(month, locale)}
              </h2>
              <p className={styles.hijri}>
                {hijri.to === null ? hijri.from : t('log.range', { from: hijri.from, to: hijri.to })}
              </p>
            </div>
            {/* aria-disabled rather than disabled, so focus is not dropped when the last step is reached. */}
            <IconButton
              label={t('log.calendar.next')}
              className={cx(atCurrentMonth && styles.navDisabled)}
              aria-disabled={atCurrentMonth}
              onClick={() => {
                if (!atCurrentMonth) onMonthChange(shiftMonth(month, 1))
              }}
            >
              <Next aria-hidden size={22} />
            </IconButton>
          </div>

          <table ref={grid} role="grid" aria-labelledby={titleId} className={styles.grid}>
            <thead>
              <tr>
                {weekdayOrder(weekStart).map((weekday) => (
                  <th key={weekday} scope="col" className={styles.weekday}>
                    <span aria-hidden>{weekdays.short[weekday]}</span>
                    <span className="visually-hidden">{weekdays.long[weekday]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody onKeyDown={handleKeyDown}>
              {weeks.map((week, row) => (
                <tr key={row}>
                  {week.map((key, column) =>
                    key === null ? (
                      <td key={column} role="gridcell" className={styles.cell} />
                    ) : (
                      <DayCell
                        key={key}
                        dateKey={key}
                        log={entries[key]}
                        isToday={key === today}
                        isFuture={key > today}
                        isSelected={key === selected}
                        isTabStop={key === tabStop}
                        onSelect={onSelect}
                        onFocusDay={setFocusKey}
                      />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {awayFromToday && (
            <div className={styles.footer}>
              <Button variant="ghost" onClick={goToToday}>
                {t('log.calendar.today')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}

interface DayCellProps {
  dateKey: DateKey
  log: DayLog | undefined
  isToday: boolean
  isFuture: boolean
  isSelected: boolean
  isTabStop: boolean
  onSelect: (dateKey: DateKey) => void
  onFocusDay: (dateKey: DateKey) => void
}

const DayCell = memo(function DayCell({
  dateKey,
  log,
  isToday,
  isFuture,
  isSelected,
  isTabStop,
  onSelect,
  onFocusDay,
}: DayCellProps) {
  const { t, tp, n, locale } = useI18n()
  const date = formatDateKey(dateKey, locale, FULL_DATE)

  let label: string
  if (isFuture) {
    label = t('log.calendar.day.future', { date })
  } else {
    const logged = PRAYERS.filter((prayer) => log?.[prayer] !== undefined).length
    const summary = tp('log.summary', logged, { total: PRAYERS.length })
    label = t(isToday ? 'log.calendar.day.today' : 'log.calendar.day', { date, summary })
  }

  return (
    <td role="gridcell" aria-selected={isFuture ? undefined : isSelected} className={styles.cell}>
      <button
        type="button"
        className={cx(styles.day, isToday && styles.today, isSelected && styles.selected)}
        data-date={dateKey}
        aria-label={label}
        aria-current={isToday ? 'date' : undefined}
        tabIndex={isTabStop ? 0 : -1}
        disabled={isFuture}
        onClick={() => {
          // Safari does not focus a button on click, so keep the tab stop in step by hand.
          onFocusDay(dateKey)
          onSelect(dateKey)
        }}
        onFocus={() => onFocusDay(dateKey)}
      >
        <span className={styles.number}>{n(partsOfDateKey(dateKey).day)}</span>
        <span className={styles.marks} aria-hidden>
          {PRAYERS.map((prayer) => {
            const status = isFuture ? undefined : log?.[prayer]
            return (
              <span
                key={prayer}
                className={cx(styles.mark, status !== undefined && styles.filled, status !== undefined && tone[status])}
                data-status={status ?? 'none'}
              />
            )
          })}
        </span>
      </button>
    </td>
  )
})
