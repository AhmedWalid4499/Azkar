import { Check, ChevronLeft, ChevronRight, Circle, CircleDashed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n'
import type { DateKey } from '../../shared/types'
import { Card, ProgressBar } from '../../shared/ui'
import {
  availableCollections,
  COLLECTION_IDS,
  COLLECTION_META,
  collectionPath,
  DAILY_COLLECTIONS,
  sessionDateKey,
  useDaySessions,
} from '../azkar'
import type { AzkarClock, CollectionId, SessionRecord } from '../azkar'
import { cx } from './cx'
import styles from './DayPanel.module.css'
import { useWhen } from './stamps'

interface DayAzkarProps {
  dateKey: DateKey
  clock: AzkarClock
}

/**
 * The day's azkar sessions: how far each got, when it was begun and finished, and
 * the repetitions counted, with the way into the session that is still open.
 * Bedtime azkar are listed only on a day they were read. A session with a record
 * is always listed, even one the app no longer offers.
 */
export function DayAzkar({ dateKey, clock }: DayAzkarProps) {
  const { t } = useI18n()
  const sessions = useDaySessions(dateKey)
  const available = availableCollections()
  const daily: readonly CollectionId[] = DAILY_COLLECTIONS
  const collections = COLLECTION_IDS.filter(
    (collection) => sessions?.[collection] !== undefined || (daily.includes(collection) && available.includes(collection)),
  )
  if (collections.length === 0) return null

  return (
    <Card className={styles.group}>
      <h3 className={styles.groupTitle}>{t('log.azkar.title')}</h3>
      <ul className={styles.sessions}>
        {collections.map((collection) => (
          <SessionRow
            key={collection}
            collection={collection}
            dateKey={dateKey}
            record={sessions?.[collection]}
            open={available.includes(collection) && sessionDateKey(collection, clock.today, clock.phase) === dateKey}
          />
        ))}
      </ul>
    </Card>
  )
}

interface SessionRowProps {
  collection: CollectionId
  dateKey: DateKey
  record: SessionRecord | undefined
  /** Today's session for this collection, which can still be read. */
  open: boolean
}

function SessionRow({ collection, dateKey, record, open }: SessionRowProps) {
  const { t, n, dir } = useI18n()
  const when = useWhen()
  const Icon = COLLECTION_META[collection].icon
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight
  const name = t(`azkar.collection.${collection}`)
  const completed = record?.completed === true

  let state: string
  let StateIcon = CircleDashed
  if (completed) {
    state = t('log.azkar.completed')
    StateIcon = Check
  } else if (record) {
    state = t('log.azkar.started')
    StateIcon = Circle
  } else {
    state = t('log.azkar.none')
  }

  const total = record?.total ?? 0
  const done = completed ? total : (record?.done ?? 0)
  // After "Start over" a completed session can be read a second time; that reading is shown too.
  const again = completed && record && record.done > 0 && record.done < record.total
  // Once completed, the last count is news only when it came later: a second reading, or a
  // completion carried over from the first version of the store that was counted again.
  const completedAt = record?.completedAt
  const lastAt =
    record?.lastAt !== undefined && (!completed || completedAt === undefined || record.lastAt > completedAt)
      ? record.lastAt
      : undefined
  const action = completed ? 'again' : record ? 'continue' : 'start'
  const actionLabel = t(`log.azkar.link.${action}`)

  return (
    <li className={styles.session} data-session={collection}>
      <div className={styles.sessionHead}>
        <Icon aria-hidden size={18} className={styles.sessionIcon} />
        <h4 className={styles.sessionName}>{name}</h4>
        <span className={cx(styles.sessionState, completed && styles.sessionDone)}>
          <StateIcon aria-hidden size={14} strokeWidth={2.5} />
          <span>{state}</span>
        </span>
      </div>
      {record && total > 0 && (
        <>
          <div aria-hidden>
            <ProgressBar value={done / total} label={name} />
          </div>
          <p className={cx(styles.note, 'tabular')}>
            {again
              ? t('log.azkar.again', { done: record.done, total })
              : t('log.azkar.progress', { done, total })}
          </p>
        </>
      )}
      {record && (
        <dl className={cx(styles.facts, 'tabular')}>
          {record.startedAt !== undefined && (
            <div className={styles.fact}>
              <dt>{t('log.azkar.startedAt')}</dt>
              <dd>{when(record.startedAt, dateKey)}</dd>
            </div>
          )}
          {completed && (
            <div className={styles.fact}>
              <dt>{t('log.azkar.finishedAt')}</dt>
              <dd>
                {record.completedAt === undefined ? t('log.azkar.timeUnknown') : when(record.completedAt, dateKey)}
              </dd>
            </div>
          )}
          {lastAt !== undefined && (
            <div className={styles.fact}>
              <dt>{t('log.azkar.lastAt')}</dt>
              <dd>{when(lastAt, dateKey)}</dd>
            </div>
          )}
          {record.recitations > 0 && (
            <div className={styles.fact}>
              <dt>{t('log.azkar.recitations')}</dt>
              <dd>{n(record.recitations)}</dd>
            </div>
          )}
        </dl>
      )}
      {open && (
        <Link
          to={collectionPath(collection)}
          className={styles.sessionLink}
          aria-label={t('log.azkar.link', { action: actionLabel, session: name })}
        >
          <span>{actionLabel}</span>
          <Chevron aria-hidden size={16} />
        </Link>
      )}
    </li>
  )
}
