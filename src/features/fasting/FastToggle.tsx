import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { haptic } from '../../native'
import { cx } from './format'
import styles from './FastToggle.module.css'

interface FastToggleProps {
  pressed: boolean
  onToggle: () => void
  children: ReactNode
  /** The quieter look, for a second choice beside the main one. */
  secondary?: boolean
}

/** A chip that logs or clears today's fast in one tap. A toggle button: `aria-pressed` says whether it is logged. */
export function FastToggle({ pressed, onToggle, children, secondary }: FastToggleProps) {
  return (
    <button
      type="button"
      className={cx(styles.chip, secondary && styles.secondary, pressed && styles.pressed)}
      aria-pressed={pressed}
      onClick={() => {
        onToggle()
        haptic('tick')
      }}
    >
      <span className={styles.mark}>{pressed && <Check aria-hidden size={14} strokeWidth={3} />}</span>
      <span className={styles.label}>{children}</span>
    </button>
  )
}
