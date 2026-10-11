import type { ReactNode } from 'react'
import styles from './reader.module.css'

/**
 * A word followed by a Qur'anic pause mark. The canonical text writes each
 * mark as a space plus a combining sign (U+06D6–U+06DC), which left alone can
 * wrap onto the next line and is drawn high enough to read as part of the line above.
 */
const WORD_WITH_PAUSE = /(\S+)( [ۖ-ۜ])/g

/**
 * Renders recitation text with each pause mark kept on its word's line and
 * set at a readable height. The text content is unchanged, character for character.
 */
export function Recitation({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(WORD_WITH_PAUSE)) {
    const [whole, word, pause] = match
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(
      <span key={match.index} className={styles.pauseGroup}>
        {word}
        <span className={styles.pauseMark}>{pause}</span>
      </span>,
    )
    cursor = match.index + whole.length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
