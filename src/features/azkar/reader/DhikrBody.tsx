import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import type { HTMLAttributes } from 'react'
import { useI18n } from '../../../shared/i18n'
import { cx } from '../cx'
import type { Dhikr } from '../data'
import type { ReaderPrefs } from '../settingsStore'
import styles from './reader.module.css'
import { Recitation } from './Recitation'
import { isShortPassage, localized } from './text'

interface DhikrBodyProps {
  dhikr: Dhikr
  /** 1-based position in the session. */
  position: number
  total: number
  prefs: ReaderPrefs
  /** Pointer handlers for swipe navigation. */
  gestures?: HTMLAttributes<HTMLElement>
}

export function DhikrBody({ dhikr, position, total, prefs, gestures }: DhikrBodyProps) {
  const { t, lang } = useI18n()
  const headingId = useId()
  const transliteration = prefs.showTransliteration ? dhikr.transliteration?.trim() : undefined
  const translation = prefs.showTranslation ? dhikr.translation?.trim() : undefined
  const reference = localized(dhikr.reference, lang)
  const virtue = dhikr.virtue ? localized(dhikr.virtue, lang) : ''
  const note = dhikr.note ? localized(dhikr.note, lang) : ''

  return (
    <article
      className={cx(styles.body, isShortPassage(dhikr.arabic) && styles.centered)}
      aria-labelledby={headingId}
      {...gestures}
    >
      <h2 id={headingId} className="visually-hidden">
        {t('azkar.reader.heading', { current: position, total })}
      </h2>

      <p
        className={cx('recitation', styles.arabic)}
        lang="ar"
        dir="rtl"
        style={{ fontSize: prefs.arabicFontSize }}
      >
        <Recitation text={dhikr.arabic} />
      </p>

      {note && (
        <p className={styles.note} dir="auto">
          {note}
        </p>
      )}

      {(transliteration || translation) && <div className={styles.ornament} aria-hidden />}

      {transliteration && (
        <p className={styles.transliteration} lang="en" dir="ltr">
          {transliteration}
        </p>
      )}
      {translation && (
        <p className={styles.translation} lang="en" dir="ltr">
          {translation}
        </p>
      )}

      {reference && (
        <p className={styles.reference}>
          <span className={styles.referenceLabel}>{t('azkar.reader.reference')}</span>
          <span dir="auto">{reference}</span>
        </p>
      )}

      {virtue && (
        <details className={styles.virtue}>
          <summary className={styles.virtueSummary}>
            {t('azkar.reader.virtue')}
            <ChevronDown aria-hidden size={18} className={styles.virtueChevron} />
          </summary>
          <p className={styles.virtueText} dir="auto">
            {virtue}
          </p>
        </details>
      )}
    </article>
  )
}
