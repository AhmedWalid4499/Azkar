import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Notice, PageHeader, ProgressBar } from '../../shared/ui'
import { sessionDateKey, useAzkarClock } from './clock'
import { COLLECTION_META, collectionPath } from './collections'
import { cx } from './cx'
import { availableCollections } from './data'
import type { CollectionId } from './data'
import mood from './mood.module.css'
import styles from './PickerPage.module.css'
import { STATE_LABEL } from './stateLabel'
import { useCompletedLabel, useSessionStanding } from './useSessionStanding'

interface SessionCardProps {
  collection: CollectionId
  dateKey: DateKey
  recommended: boolean
}

function SessionCard({ collection, dateKey, recommended }: SessionCardProps) {
  const { t, tp, lang, dir } = useI18n()
  const standing = useSessionStanding(collection, dateKey)
  const completedLabel = useCompletedLabel()
  const { arabicTitle, icon: Icon } = COLLECTION_META[collection]
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight
  const progress = t('azkar.progress', { done: standing.done, total: standing.total })
  const complete = standing.status === 'complete'

  return (
    <article className={cx(styles.card, mood[collection])}>
      <div className={styles.top}>
        <Icon aria-hidden size={28} strokeWidth={1.75} />
        {recommended && <span className={styles.badge}>{t('azkar.recommended')}</span>}
      </div>

      <h2 className={styles.heading}>
        <Link to={collectionPath(collection)} className={styles.link}>
          <span className={styles.arabicTitle} lang="ar" dir="rtl">
            {arabicTitle}
          </span>
          {lang !== 'ar' && <span className={styles.title}>{t(`azkar.collection.${collection}`)}</span>}
        </Link>
      </h2>
      <p className={styles.meta}>{tp('azkar.count', standing.total)}</p>

      <div className={styles.progress}>
        <ProgressBar value={standing.fraction} label={progress} />
        <span className={cx(styles.progressText, 'tabular')} aria-hidden>
          {progress}
        </span>
      </div>

      <p className={cx(styles.state, complete && 'tabular')}>
        {complete && <Check aria-hidden size={18} />}
        {complete ? completedLabel(standing.completedAt) : t(STATE_LABEL[standing.status])}
        {!complete && <Arrow aria-hidden size={18} />}
      </p>
    </article>
  )
}

/** `/azkar`: choose a session. */
export function PickerPage() {
  const { t } = useI18n()
  const clock = useAzkarClock()
  const collections = availableCollections()

  return (
    <div className="page">
      <PageHeader title={t('azkar.title')} subtitle={t('azkar.subtitle')} />
      {collections.length === 0 ? (
        <Notice>{t('azkar.empty')}</Notice>
      ) : (
        <ul className={styles.list}>
          {collections.map((collection) => (
            <li key={collection}>
              <SessionCard
                collection={collection}
                dateKey={sessionDateKey(collection, clock.today, clock.phase)}
                recommended={clock.recommended === collection}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
