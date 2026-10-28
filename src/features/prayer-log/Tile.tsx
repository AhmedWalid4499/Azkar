import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './Tile.module.css'

interface TileProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  /** Gold instead of emerald for the icon. */
  accent?: boolean
  /** A line of detail under the figure. */
  detail?: ReactNode
}

/** One figure with its label: a `dt` and `dd` pair, so it goes inside a `dl`. */
export function Tile({ icon: Icon, label, value, accent, detail }: TileProps) {
  return (
    <div className={styles.tile}>
      <dt className={styles.label}>
        <Icon aria-hidden size={16} className={cx(styles.icon, accent && styles.accent)} />
        <span>{label}</span>
      </dt>
      <dd className={styles.figure}>
        <span className={cx(styles.value, 'tabular')}>{value}</span>
        {detail !== undefined && <span className={styles.detail}>{detail}</span>}
      </dd>
    </div>
  )
}

interface TilesProps {
  children: ReactNode
  /** Four tiles: they go four across from 520px. */
  four?: boolean
}

/** A grid of tiles, two across. */
export function Tiles({ children, four }: TilesProps) {
  return <dl className={cx(styles.tiles, four && styles.four)}>{children}</dl>
}
