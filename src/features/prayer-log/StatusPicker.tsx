import { useId } from 'react'
import type { Ref } from 'react'
import { useI18n } from '../../shared/i18n'
import { cx } from './cx'
import tone from './status.module.css'
import { StatusIcon } from './StatusIcon'
import { statusLabelKey } from './statusLabels'
import styles from './StatusPicker.module.css'
import { PRAYER_STATUSES } from './types'
import type { PrayerStatus } from './types'

interface StatusPickerProps {
  value: PrayerStatus | null
  onChange: (status: PrayerStatus) => void
  /** Accessible name for the group, e.g. "Fajr status". */
  label: string
  ref?: Ref<HTMLDivElement>
}

/** Five-way status choice as a row of large radio buttons. Nothing is selected until a status is logged. */
export function StatusPicker({ value, onChange, label, ref }: StatusPickerProps) {
  const { t } = useI18n()
  const name = useId()

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={styles.picker}>
      {PRAYER_STATUSES.map((status) => (
        <label key={status} className={cx(styles.option, tone[status])}>
          <input
            type="radio"
            className="visually-hidden"
            name={name}
            value={status}
            checked={value === status}
            onChange={() => onChange(status)}
          />
          <span className={styles.face}>
            <StatusIcon status={status} size={20} />
            <span className={styles.label}>{t(statusLabelKey(status))}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
