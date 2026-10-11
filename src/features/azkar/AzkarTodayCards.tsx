import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { ProgressRing } from '../../shared/ui'
import styles from './AzkarTodayCards.module.css'
import { sessionDateKey, useAzkarClock } from './clock'
import { COLLECTION_META, collectionPath } from './collections'
import { cx } from './cx'
import { availableCollections } from './data'
import type { CollectionId } from './data'
import mood from './mood.module.css'
import { STATE_LABEL } from './stateLabel'
import { useSession } from './useSession'

/** Bedtime adhkar are left to the Azkar tab; Today shows the two daily sessions. */
const TODAY_COLLECTIONS: readonly CollectionId[] = ['morning', 'evening']

interface TodayCardProps {
  collection: CollectionId
  dateKey: DateKey
  recommended: boolean
}

function TodayCard({ collection, dateKey, recommended }: TodayCardProps) {
  const { t, dir } = useI18n()
  const { summary } = useSession(collection, dateKey)
  const Icon = COLLECTION_META[collection].icon
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  const complete = summary.status === 'complete'

  return (
    <article className={cx(styles.card, mood[collection], recommended && styles.recommended)}>
      <div className={styles.top}>
        <ProgressRing
          value={summary.fraction}
          size={48}
          thickness={4}
          label={t('azkar.progress', { done: summary.done, total: summary.total })}
        >
          {complete ? <Check aria-hidden size={22} strokeWidth={2.5} /> : <Icon aria-hidden size={20} />}
        </ProgressRing>
        {recommended && <span className={styles.badge}>{t('azkar.now')}</span>}
      </div>

      <div className={styles.text}>
        <h3 className={styles.title}>
          <Link to={collectionPath(collection)} className={styles.link}>
            {t(`azkar.collection.${collection}`)}
          </Link>
        </h3>
        <p className={styles.state}>
          {t(STATE_LABEL[summary.status])}
          {!complete && <Chevron aria-hidden size={16} />}
        </p>
      </div>
    </article>
  )
}

/** Morning and evening cards with today's progress, shown on the Today page. */
export function AzkarTodayCards() {
  const clock = useAzkarClock()
  const available = availableCollections()
  const collections = TODAY_COLLECTIONS.filter((collection) => available.includes(collection))
  if (collections.length === 0) return null

  return (
    <div className={styles.grid}>
      {collections.map((collection) => (
        <TodayCard
          key={collection}
          collection={collection}
          dateKey={sessionDateKey(collection, clock.today, clock.phase)}
          recommended={clock.recommended === collection}
        />
      ))}
    </div>
  )
}
