import type { ReactNode } from 'react'
import styles from './reader.module.css'

/**
 * A word followed by a Qur'anic pause mark or by the sajdah sign. The canonical text writes each
 * pause mark as a space plus a combining sign (U+06D6–U+06DC), which left alone can wrap onto the
 * next line and is drawn high enough to read as part of the line above. The sajdah sign (U+06E9),
 * which Tanzil prints after the last word of an ayah of prostration, is a symbol of its own after a
 * space: it is not a pause mark, but left alone it too can wrap and stand at the head of a line.
 * The rub' al-hizb sign (U+06DE) opens a line, before a space, and is left as it is.
 */
const WORD_WITH_SIGN = /(\S+)( [\u06D6-\u06DC]| \u06E9)/g
const SAJDAH = ' \u06E9'

/**
 * Renders recitation text with each pause mark, and the sajdah sign, kept on its word's line, the
 * pause marks set at a readable height. The text content is unchanged, character for character.
 */
export function Recitation({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(WORD_WITH_SIGN)) {
    const [whole, word, sign] = match
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(
      sign === SAJDAH ? (
        <span key={match.index} className={styles.signGroup}>
          {word}
          {sign}
        </span>
      ) : (
        <span key={match.index} className={styles.pauseGroup}>
          {word}
          <span className={styles.pauseMark}>{sign}</span>
        </span>
      ),
    )
    cursor = match.index + whole.length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
