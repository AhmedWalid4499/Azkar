import { Check, CheckCheck, ChevronLeft, ChevronRight, Redo2, Undo2 } from 'lucide-react'
import type { KeyboardEvent, RefObject } from 'react'
import { useI18n } from '../../../shared/i18n'
import { IconButton } from '../../../shared/ui'
import { cx } from '../cx'
import styles from './reader.module.css'

/** From this many repetitions on, counting them all by hand becomes optional. */
const MARK_ALL_FROM = 10

interface CounterDockProps {
  count: number
  target: number
  /** Every dhikr of the session has reached its count. */
  sessionComplete: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  onPrimary: () => void
  onUndo: () => void
  onMarkAll: () => void
  onPrevious: () => void
  onNext: () => void
  counterRef: RefObject<HTMLButtonElement | null>
}

/** A held-down key must not run up the count. */
function ignoreKeyRepeat(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
}

/**
 * The controls pinned above the tab bar: the big counter, with undo and
 * navigation over it, or beside it where the screen is short.
 */
export function CounterDock({
  count,
  target,
  sessionComplete,
  canGoPrevious,
  canGoNext,
  onPrimary,
  onUndo,
  onMarkAll,
  onPrevious,
  onNext,
  counterRef,
}: CounterDockProps) {
  const { t, tp, dir } = useI18n()
  const done = count >= target
  const Previous = dir === 'rtl' ? ChevronRight : ChevronLeft
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight
  // Undo points back the way the text came from. Lucide's redo arrow is its undo arrow mirrored.
  const Undo = dir === 'rtl' ? Redo2 : Undo2

  // Once the count is reached the same button moves on, so one thumb does everything.
  const hint = !done ? t('azkar.counter.hint') : sessionComplete ? t('azkar.counter.finish') : t('azkar.reader.next')
  const label = !done
    ? tp('azkar.counter.remaining', target - count)
    : sessionComplete
      ? t('azkar.counter.doneFinish')
      : t('azkar.counter.doneNext')

  return (
    <div className={styles.dock}>
      <div className={styles.dockInner}>
        {/*
          aria-disabled rather than disabled: each of these can run out under the reader's finger
          (the first or last dhikr, a count back at zero), and a disabled button drops keyboard focus.
        */}
        <div className={styles.tools}>
          <IconButton label={t('azkar.reader.previous')} aria-disabled={!canGoPrevious} onClick={onPrevious}>
            <Previous aria-hidden size={22} />
          </IconButton>
          <div className={styles.toolsMiddle}>
            <IconButton label={t('azkar.counter.undo')} aria-disabled={count === 0} onClick={onUndo}>
              <Undo aria-hidden size={20} />
            </IconButton>
            {target >= MARK_ALL_FROM && !done && (
              <button type="button" className={styles.tool} onClick={onMarkAll}>
                <CheckCheck aria-hidden size={18} />
                <span className={styles.toolLabel}>{t('azkar.counter.markAll')}</span>
              </button>
            )}
          </div>
          <IconButton label={t('azkar.reader.next')} aria-disabled={!canGoNext} onClick={onNext}>
            <Next aria-hidden size={22} />
          </IconButton>
        </div>

        <button
          ref={counterRef}
          type="button"
          className={cx(styles.counter, done && styles.counterDone)}
          aria-label={label}
          onClick={onPrimary}
          onKeyDown={ignoreKeyRepeat}
        >
          <span className={cx(styles.counterValue, 'tabular')} aria-hidden>
            {done && <Check aria-hidden size={22} strokeWidth={2.5} />}
            {t('azkar.counter.count', { done: count, total: target })}
          </span>
          <span className={styles.counterHint} aria-hidden>
            {hint}
          </span>
        </button>
      </div>
    </div>
  )
}
