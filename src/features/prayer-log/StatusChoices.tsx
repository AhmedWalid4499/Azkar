import { Check } from 'lucide-react'
import { useId } from 'react'
import { useI18n } from '../../shared/i18n'
import { Button } from '../../shared/ui'
import { cx } from './cx'
import tone from './status.module.css'
import styles from './StatusChoices.module.css'
import { StatusIcon } from './StatusIcon'
import { statusHintKey, statusLabelKey } from './statusLabels'
import { PRAYER_STATUSES } from './types'
import type { PrayerStatus } from './types'

interface StatusChoicesProps {
  value: PrayerStatus | null
  /** Called with the chosen status, or `null` to clear the entry. */
  onChoose: (status: PrayerStatus | null) => void
}

/** The five statuses as a list of large buttons, each explained, plus a way to clear. For use in a sheet. */
export function StatusChoices({ value, onChoose }: StatusChoicesProps) {
  const { t } = useI18n()
  const id = useId()

  return (
    <div className={styles.choices}>
      <ul className={styles.list}>
        {PRAYER_STATUSES.map((status) => (
          <li key={status}>
            <button
              type="button"
              className={cx(styles.choice, tone[status])}
              aria-pressed={value === status}
              aria-labelledby={`${id}-${status}-label`}
              aria-describedby={`${id}-${status}-hint`}
              onClick={() => onChoose(status)}
            >
              <span className={styles.badge}>
                <StatusIcon status={status} />
              </span>
              <span className={styles.text}>
                <span id={`${id}-${status}-label`} className={styles.label}>
                  {t(statusLabelKey(status))}
                </span>
                <span id={`${id}-${status}-hint`} className={styles.hint}>
                  {t(statusHintKey(status))}
                </span>
              </span>
              {value === status && <Check aria-hidden size={20} className={styles.current} />}
            </button>
          </li>
        ))}
      </ul>
      {value !== null && (
        <Button block variant="ghost" onClick={() => onChoose(null)}>
          {t('log.clear')}
        </Button>
      )}
    </div>
  )
}
