import { Check } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui'
import { cx } from '../cx'
import styles from './reader.module.css'

const ACCEPTANCE_DUA = 'تَقَبَّلَ اللهُ مِنَّا وَمِنْكُمْ'

interface CompletionScreenProps {
  /** E.g. "Morning azkar complete". */
  title: string
  onReview: () => void
}

/** The quiet end of a reading. */
export function CompletionScreen({ title, onReview }: CompletionScreenProps) {
  const { t, lang } = useI18n()
  const headingId = useId()
  const heading = useRef<HTMLHeadingElement>(null)

  // The reader's controls are gone, so hand focus (and the screen reader) to the result.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section className={styles.complete} aria-labelledby={headingId}>
      <div className={styles.completeMark} aria-hidden>
        <Check size={34} strokeWidth={2.25} />
      </div>
      <h1 id={headingId} ref={heading} tabIndex={-1} className={styles.completeTitle}>
        {title}
      </h1>
      <p className={cx('recitation', styles.completeDua)} lang="ar" dir="rtl">
        {ACCEPTANCE_DUA}
      </p>
      {lang !== 'ar' && <p className={styles.completeDuaTranslation}>{t('azkar.complete.dua')}</p>}

      <div className={styles.completeActions}>
        <Link to="/" className="ui-button ui-button--primary ui-button--m ui-button--block">
          {t('azkar.complete.today')}
        </Link>
        <Button block onClick={onReview}>
          {t('azkar.complete.review')}
        </Button>
      </div>
    </section>
  )
}
