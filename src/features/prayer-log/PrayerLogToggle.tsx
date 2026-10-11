import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDateKey } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useTodayKey } from '../../shared/time'
import type { DateKey, PrayerName } from '../../shared/types'
import { Sheet } from '../../shared/ui'
import { cx } from './cx'
import styles from './PrayerLogToggle.module.css'
import tone from './status.module.css'
import { StatusChoices } from './StatusChoices'
import { StatusIcon } from './StatusIcon'
import { statusLabelKey } from './statusLabels'
import { usePrayerLog, usePrayerStatus } from './store'
import type { PrayerStatus } from './types'

export interface PrayerLogToggleProps {
  prayer: PrayerName
  dateKey: DateKey
}

const CONFIRMATION_MS = 4000

function lightHaptic() {
  // Absent on iOS Safari; a no-op elsewhere until the user has interacted.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10)
}

/**
 * Compact control that shows and changes one prayer's logged status. Sits at
 * the end of a timetable row.
 *
 * An unlogged prayer is logged as on time with a single tap, since that is by
 * far the common case; a logged one opens a sheet with every status. A prayer
 * of today can be logged before its computed time: the timetable can be a
 * little off, and refusing a real prayer is worse than allowing an early tap.
 * Only days that have not begun are disabled.
 */
export function PrayerLogToggle({ prayer, dateKey }: PrayerLogToggleProps) {
  const { t, locale } = useI18n()
  const today = useTodayKey()
  const status = usePrayerStatus(dateKey, prayer)
  const setStatus = usePrayerLog((state) => state.setStatus)
  const [choosing, setChoosing] = useState(false)
  // Spoken once after a one-tap log: the button keeps focus, so nothing else would confirm it.
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (!confirmation) return
    // Long enough to be read out, then removed so it is not found later as stray text.
    const id = window.setTimeout(() => setConfirmation(''), CONFIRMATION_MS)
    return () => window.clearTimeout(id)
  }, [confirmation])

  const isFuture = dateKey > today
  const prayerName = t(`prayer.${prayer}`)

  let label: string
  if (status !== null) label = t('log.toggle.change', { prayer: prayerName, status: t(statusLabelKey(status)) })
  else if (isFuture) label = t('log.toggle.future', { prayer: prayerName })
  else label = t('log.toggle.log', { prayer: prayerName })

  const handleClick = () => {
    if (status === null) {
      setStatus(dateKey, prayer, 'ontime')
      setConfirmation(t('log.toggle.logged', { prayer: prayerName }))
      lightHaptic()
    } else {
      setChoosing(true)
    }
  }

  const handleChoose = (next: PrayerStatus | null) => {
    setStatus(dateKey, prayer, next)
    setChoosing(false)
  }

  return (
    <>
      <button
        type="button"
        className={cx(styles.toggle, status !== null && tone[status])}
        data-status={status ?? 'none'}
        aria-label={label}
        aria-haspopup={status !== null ? 'dialog' : undefined}
        disabled={isFuture}
        onClick={handleClick}
      >
        {status !== null ? (
          <span className={styles.badge}>
            <StatusIcon status={status} size={17} />
          </span>
        ) : (
          <span className={styles.ring} />
        )}
      </button>
      {/* Portalled so the host row holds nothing but the button: the sheet does not
          inherit the row's styles, and no dialog ends up nested in its markup. */}
      {createPortal(
        <>
          <Sheet
            open={choosing}
            onClose={() => setChoosing(false)}
            title={t('log.sheet.title', { prayer: prayerName, date: formatDateKey(dateKey, locale) })}
          >
            <StatusChoices value={status} onChoose={handleChoose} />
          </Sheet>
          <span role="status" className="visually-hidden">
            {confirmation}
          </span>
        </>,
        document.body,
      )}
    </>
  )
}
