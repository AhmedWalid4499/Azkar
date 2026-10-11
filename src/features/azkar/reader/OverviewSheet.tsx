import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Button, Sheet } from '../../../shared/ui'
import { cx } from '../cx'
import type { Dhikr } from '../data'
import { countOf, targetOf } from '../session'
import type { Counts } from '../session'
import styles from './reader.module.css'
import { snippet } from './text'

interface OverviewSheetProps {
  open: boolean
  onClose: () => void
  /** Title of the session, for the "start over" confirmation. */
  sessionTitle: string
  items: readonly Dhikr[]
  counts: Counts | undefined
  currentIndex: number
  onJump: (index: number) => void
  onRestart: () => void
}

/** Every dhikr of the session with its state, to jump to any of them or start over. */
export function OverviewSheet({
  open,
  onClose,
  sessionTitle,
  items,
  counts,
  currentIndex,
  onJump,
  onRestart,
}: OverviewSheetProps) {
  const { t, n } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const currentItem = useRef<HTMLButtonElement>(null)
  const started = items.some((dhikr) => countOf(dhikr, counts) > 0)

  useEffect(() => {
    if (open) currentItem.current?.scrollIntoView?.({ block: 'center' })
  }, [open])

  const close = () => {
    setConfirming(false)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={confirming ? t('azkar.overview.restart.title') : t('azkar.reader.overview')}
    >
      {confirming ? (
        <>
          <p className={styles.confirmBody}>{t('azkar.overview.restart.body', { title: sessionTitle })}</p>
          <div className={styles.sheetActions}>
            <Button
              block
              variant="danger"
              onClick={() => {
                setConfirming(false)
                onRestart()
              }}
            >
              {t('azkar.overview.restart')}
            </Button>
            <Button block variant="ghost" onClick={() => setConfirming(false)}>
              {t('action.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ol className={styles.overviewList}>
            {items.map((dhikr, index) => {
              const count = countOf(dhikr, counts)
              const target = targetOf(dhikr)
              const current = index === currentIndex
              return (
                <li key={`${index}:${dhikr.id}`}>
                  <button
                    ref={current ? currentItem : undefined}
                    type="button"
                    className={styles.overviewItem}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onJump(index)}
                  >
                    <span className={cx(styles.overviewIndex, 'tabular')}>{n(index + 1)}</span>
                    <span className={cx('recitation', styles.overviewText)} lang="ar" dir="rtl">
                      {snippet(dhikr.arabic)}
                    </span>
                    {count >= target ? (
                      <span className={cx(styles.overviewState, styles.overviewStateDone)}>
                        <Check aria-hidden size={20} strokeWidth={2.5} />
                        <span className="visually-hidden">{t('azkar.overview.done')}</span>
                      </span>
                    ) : (
                      <span className={cx(styles.overviewState, 'tabular')}>
                        {t('azkar.counter.count', { done: count, total: target })}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className={styles.sheetActions}>
            <Button block variant="ghost" disabled={!started} onClick={() => setConfirming(true)}>
              <RotateCcw aria-hidden size={18} />
              {t('azkar.overview.restart')}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
