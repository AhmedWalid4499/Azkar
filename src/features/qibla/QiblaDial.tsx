import { useI18n } from '../../shared/i18n'
import type { StringKey } from '../../shared/i18n'
import styles from './QiblaDial.module.css'

// Drawn on a 240 × 256 grid: the dial's centre sits low enough to leave room for the fixed mark above it.
const CX = 120
const CY = 136
const FACE_R = 108
const TICK_OUTER = 104
const LETTER_R = 84

const point = (degrees: number, radius: number) => {
  const angle = (degrees * Math.PI) / 180
  return { x: CX + radius * Math.sin(angle), y: CY - radius * Math.cos(angle) }
}

const round = (value: number) => Math.round(value * 100) / 100

// The card's graduations never change, so they are built once.
const TICKS = Array.from({ length: 36 }, (_, index) => {
  const degrees = index * 10
  const length = degrees % 90 === 0 ? 12 : degrees % 30 === 0 ? 8 : 5
  const outer = point(degrees, TICK_OUTER)
  const inner = point(degrees, TICK_OUTER - length)
  return (
    <line
      key={degrees}
      className={degrees % 30 === 0 ? styles.tickMajor : styles.tick}
      x1={round(outer.x)}
      y1={round(outer.y)}
      x2={round(inner.x)}
      y2={round(inner.y)}
    />
  )
})

const LETTERS: ReadonlyArray<{ degrees: number; key: StringKey }> = [
  { degrees: 0, key: 'qibla.dial.n' },
  { degrees: 90, key: 'qibla.dial.e' },
  { degrees: 180, key: 'qibla.dial.s' },
  { degrees: 270, key: 'qibla.dial.w' },
]

interface QiblaDialProps {
  /** Degrees clockwise from north. */
  bearing: number
  /** Where the top of the screen points, degrees clockwise from north; 0 keeps north at the top. */
  heading: number
  aligned: boolean
  /** The dial's text alternative. */
  label: string
}

/**
 * A compass card that turns so its north matches the world's, with the Qibla
 * marked on it, under a fixed mark for where the phone points. It is drawn the
 * same way in both directions of text: east is on the right of a compass in any language.
 */
export function QiblaDial({ bearing, heading, aligned, label }: QiblaDialProps) {
  const { t } = useI18n()
  const card = round(-heading)
  return (
    <svg
      className={`${styles.dial} ${aligned ? styles.aligned : ''}`}
      viewBox="0 0 240 256"
      role="img"
      aria-label={label}
      data-aligned={aligned}
    >
      <polygon className={styles.index} points={`${CX - 8},8 ${CX + 8},8 ${CX},22`} />
      <circle className={styles.face} cx={CX} cy={CY} r={FACE_R} />
      <g data-part="card" transform={`rotate(${card} ${CX} ${CY})`}>
        {TICKS}
        {LETTERS.map(({ degrees, key }) => {
          const at = point(degrees, LETTER_R)
          const x = round(at.x)
          const y = round(at.y)
          return (
            <text
              key={key}
              className={degrees === 0 ? styles.north : styles.letter}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              // Each letter turns back as the card turns, so it always reads upright.
              transform={`rotate(${-card} ${x} ${y})`}
            >
              {t(key)}
            </text>
          )
        })}
        <g data-part="qibla" transform={`rotate(${round(bearing)} ${CX} ${CY})`}>
          <line className={styles.shaft} x1={CX} y1={CY + 14} x2={CX} y2={CY - 38} />
          <polygon className={styles.head} points={`${CX},${CY - 52} ${CX - 9},${CY - 34} ${CX + 9},${CY - 34}`} />
          <rect className={styles.kaaba} x={CX - 8} y={CY - 74} width={16} height={17} rx={2} />
          <rect className={styles.kaabaBand} x={CX - 8} y={CY - 70} width={16} height={3} />
        </g>
      </g>
      <circle className={styles.pivot} cx={CX} cy={CY} r={6} />
    </svg>
  )
}
