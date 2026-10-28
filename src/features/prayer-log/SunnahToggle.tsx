import { Check } from 'lucide-react'
import { haptic } from '../../native'
import { useI18n } from '../../shared/i18n'
import { useTodayKey } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import { cx } from './cx'
import { usePrayerLog, useSunnahDone } from './store'
import { sunnahLabelKey } from './sunnahLabels'
import styles from './SunnahToggle.module.css'
import type { SunnahPrayer } from './types'

export interface SunnahToggleProps {
  sunnah: SunnahPrayer
  /** The day it is filed under. A night prayer belongs to the day whose Isha came before it. */
  dateKey: DateKey
}

/**
 * A chip that ticks one sunnah prayer off for one day, and unticks it, in a
 * single tap. A toggle button: its name is the prayer, `aria-pressed` says
 * whether it is done. Put several in an element with `role="group"` that names
 * the day. Days that have not begun are disabled.
 */
export function SunnahToggle({ sunnah, dateKey }: SunnahToggleProps) {
  const { t } = useI18n()
  const today = useTodayKey()
  const done = useSunnahDone(dateKey, sunnah)
  const setSunnah = usePrayerLog((state) => state.setSunnah)

  const toggle = () => {
    setSunnah(dateKey, sunnah, !done)
    haptic('tick')
  }

  return (
    <button
      type="button"
      className={cx(styles.chip, done && styles.done)}
      aria-pressed={done}
      disabled={dateKey > today}
      onClick={toggle}
    >
      <span className={styles.mark}>{done && <Check aria-hidden size={14} strokeWidth={3} />}</span>
      <span className={styles.label}>{t(sunnahLabelKey(sunnah))}</span>
    </button>
  )
}
