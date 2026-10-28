import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { haptic } from '../../../native'
import { useI18n } from '../../../shared/i18n'
import type { DateKey } from '../../../shared/types'
import { IconButton, ProgressBar } from '../../../shared/ui'
import { cx } from '../cx'
import { readingActions, useReading } from '../readings'
import type { Reading } from '../readings'
import { countOf, isDone, nextUnfinished, targetOf } from '../session'
import { useReaderPrefs } from '../settingsStore'
import { useSwipe } from '../useSwipe'
import { useWakeLock } from '../useWakeLock'
import { CompletionScreen } from './CompletionScreen'
import { CounterDock } from './CounterDock'
import { DhikrBody } from './DhikrBody'
import { OverviewSheet } from './OverviewSheet'
import styles from './reader.module.css'

/** How long the "done" state shows before the reader moves on by itself. */
export const ADVANCE_DELAY_MS = 500
/**
 * After a dhikr completes, the counter ignores taps for this long (on top of
 * the advance delay), so a thumb still tapping out a tasbih does not skip
 * ahead or start counting the next dhikr.
 */
export const SETTLE_MS = 400

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ReaderProps {
  reading: Reading
  /** The day this reading's counts are filed under. */
  dateKey: DateKey
  title: string
  /** Heading of the end screen. */
  completeTitle: string
  /** Shown before the position when the reader is not on the day the clock would choose. */
  dateLabel?: string
}

/** One dhikr at a time, with the counter. Mount it afresh (via `key`) for each reading and day. */
export function Reader({ reading, dateKey, title, completeTitle, dateLabel }: ReaderProps) {
  const { t, dir } = useI18n()
  const prefs = useReaderPrefs()
  const { items, counts, summary } = useReading(reading, dateKey)
  const progress = readingActions(reading, dateKey)

  // Resume where the session was left: the first dhikr still short of its count.
  const [view, setView] = useState<'reading' | 'complete'>(() => (summary.status === 'complete' ? 'complete' : 'reading'))
  const [index, setIndex] = useState(() => Math.max(0, summary.firstUnfinished))
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const advanceTimer = useRef<number | null>(null)
  // On the monotonic clock, so a device clock correction cannot leave the counter locked.
  const lockedUntil = useRef(0)
  const counter = useRef<HTMLButtonElement>(null)
  const focusCounterNext = useRef(false)

  useWakeLock(prefs.keepAwake && view === 'reading')

  const cancelAdvance = () => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    advanceTimer.current = null
  }

  useEffect(() => cancelAdvance, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [index, view])

  useEffect(() => {
    if (view === 'reading' && focusCounterNext.current) {
      focusCounterNext.current = false
      counter.current?.focus()
    }
  }, [view])

  const dhikr = items[index]
  const count = dhikr ? countOf(dhikr, counts) : 0
  const target = dhikr ? targetOf(dhikr) : 1

  /** Moves past the dhikr at `from`: to the next unfinished one, or to the end screen. */
  const advanceFrom = (from: number) => {
    cancelAdvance()
    const next = nextUnfinished(items, progress.counts(), from)
    if (next === -1) setView('complete')
    else setIndex(next)
  }

  const dhikrCompleted = (at: number) => {
    if (prefs.haptics) haptic('done')
    setAnnouncement(t('azkar.announce.done', { current: at + 1, total: items.length }))
    lockedUntil.current = performance.now() + SETTLE_MS + (prefs.autoAdvance ? ADVANCE_DELAY_MS : 0)
    if (!prefs.autoAdvance) return
    cancelAdvance()
    if (prefersReducedMotion()) advanceFrom(at)
    else advanceTimer.current = window.setTimeout(() => advanceFrom(at), ADVANCE_DELAY_MS)
  }

  const primary = () => {
    if (!dhikr || performance.now() < lockedUntil.current) return
    if (isDone(dhikr, progress.counts())) {
      advanceFrom(index)
      return
    }
    progress.increment(dhikr.id)
    if (isDone(dhikr, progress.counts())) dhikrCompleted(index)
    else if (prefs.haptics) haptic('tick')
  }

  const undo = () => {
    if (!dhikr) return
    cancelAdvance()
    lockedUntil.current = 0
    setAnnouncement('')
    progress.decrement(dhikr.id)
    if (prefs.haptics) haptic('tick')
  }

  const markAll = () => {
    if (!dhikr || isDone(dhikr, progress.counts())) return
    progress.complete(dhikr.id)
    dhikrCompleted(index)
  }

  const goTo = (to: number) => {
    if (to < 0 || to >= items.length) return
    cancelAdvance()
    lockedUntil.current = 0
    setIndex(to)
  }

  /** Forward in reading order is rightwards in a left-to-right interface and leftwards in a right-to-left one. */
  const step = (towards: 'left' | 'right') => {
    const forward = (towards === 'right') === (dir === 'ltr')
    goTo(forward ? index + 1 : index - 1)
  }

  const restart = () => {
    cancelAdvance()
    lockedUntil.current = 0
    setAnnouncement('')
    progress.reset()
    setOverviewOpen(false)
    setIndex(0)
    setView('reading')
  }

  const review = () => {
    focusCounterNext.current = true
    setIndex(0)
    setView('reading')
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (view !== 'reading' || overviewOpen) return
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    const origin = event.target instanceof Element ? event.target : null
    if (origin?.closest('dialog, input, select, textarea, [contenteditable="true"]')) return

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      step(event.key === 'ArrowLeft' ? 'left' : 'right')
      return
    }
    if (event.key === ' ' || event.key === 'Enter') {
      // A focused button, link or disclosure handles its own activation.
      if (origin?.closest('button, a, summary')) return
      event.preventDefault()
      if (!event.repeat) primary()
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // A swipe drags the page along: swiping left reveals what lies to the right.
  const gestures = useSwipe((direction) => step(direction === 'left' ? 'right' : 'left'))

  if (!dhikr) return <Navigate to="/azkar" replace />

  const Back = dir === 'rtl' ? ChevronRight : ChevronLeft

  return (
    <div className={styles.reader}>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      {view === 'complete' ? (
        <CompletionScreen title={completeTitle} onReview={review} />
      ) : (
        <>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <Link to="/azkar" className="ui-icon-button" aria-label={t('action.back')}>
                <Back aria-hidden size={22} />
              </Link>
              <div className={styles.headerText}>
                <h1 className={styles.title}>{title}</h1>
                <p className={cx(styles.position, 'tabular')}>
                  {dateLabel === undefined
                    ? t('azkar.reader.position', { current: index + 1, total: items.length })
                    : t('azkar.reader.datedPosition', { date: dateLabel, current: index + 1, total: items.length })}
                </p>
              </div>
              <IconButton label={t('azkar.reader.overview')} onClick={() => setOverviewOpen(true)}>
                <ListChecks aria-hidden size={22} />
              </IconButton>
            </div>
            <ProgressBar
              value={summary.fraction}
              label={t('azkar.progress', { done: summary.done, total: summary.total })}
            />
          </header>

          <DhikrBody
            key={dhikr.id}
            dhikr={dhikr}
            position={index + 1}
            total={items.length}
            prefs={prefs}
            gestures={gestures}
          />

          <CounterDock
            count={count}
            target={target}
            sessionComplete={summary.status === 'complete'}
            canGoPrevious={index > 0}
            canGoNext={index < items.length - 1}
            onPrimary={primary}
            onUndo={undo}
            onMarkAll={markAll}
            onPrevious={() => goTo(index - 1)}
            onNext={() => goTo(index + 1)}
            counterRef={counter}
          />

          <OverviewSheet
            open={overviewOpen}
            onClose={() => setOverviewOpen(false)}
            sessionTitle={title}
            items={items}
            counts={counts}
            currentIndex={index}
            onJump={(to) => {
              setOverviewOpen(false)
              goTo(to)
            }}
            onRestart={restart}
          />
        </>
      )}
    </div>
  )
}
