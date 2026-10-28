import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { ProgressRing } from '../../shared/ui'
import styles from './AzkarTodayCards.module.css'
import { sessionDateKey, useAzkarClock } from './clock'
import { COLLECTION_META, collectionPath, DAILY_COLLECTIONS } from './collections'
import { cx } from './cx'
import { availableCollections } from './data'
import type { CollectionId } from './data'
import mood from './mood.module.css'
import { STATE_LABEL } from './stateLabel'
import { useCompletedLabel, useSessionStanding } from './useSessionStanding'

interface TodayCardProps {
  collection: CollectionId
  dateKey: DateKey
  recommended: boolean
}

function TodayCard({ collection, dateKey, recommended }: TodayCardProps) {
  const { t, dir } = useI18n()
  const standing = useSessionStanding(collection, dateKey)
  const completedLabel = useCompletedLabel()
  const Icon = COLLECTION_META[collection].icon
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  const complete = standing.status === 'complete'
  const progress = t('azkar.progress', { done: standing.done, total: standing.total })
  const active = standing.status === 'active'
  // What was done: when it was finished, or how far it got; otherwise an invitation to start.
  const state = complete ? completedLabel(standing.completedAt) : active ? progress : t(STATE_LABEL[standing.status])

  return (
    <article className={cx(styles.card, mood[collection], recommended && styles.recommended)}>
      <div className={styles.top}>
        <ProgressRing value={standing.fraction} size={48} thickness={4} label={progress}>
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
        {/* The ring already announces the progress, so it is not read out a second time here. */}
        <p className={cx(styles.state, 'tabular')} aria-hidden={active || undefined}>
          {state}
          {!complete && <Chevron aria-hidden size={16} />}
        </p>
      </div>
    </article>
  )
}

/** Morning and evening cards with today's progress, shown on the Today page. Bedtime is left to the Azkar tab. */
export function AzkarTodayCards() {
  const clock = useAzkarClock()
  const available = availableCollections()
  const collections = DAILY_COLLECTIONS.filter((collection) => available.includes(collection))
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
