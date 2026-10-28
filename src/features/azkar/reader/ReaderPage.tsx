import { Navigate, useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n'
import { useSessionDay } from '../clock'
import { isCollectionId } from '../collections'
import { availableCollections } from '../data'
import type { CollectionId } from '../data'
import { sessionReading } from '../readings'
import { Reader } from './Reader'

function DatedReader({ collection }: { collection: CollectionId }) {
  const { t } = useI18n()
  const dateKey = useSessionDay(collection)
  // A new day is a new session: remounting resets the position and brings up that day's counts.
  return (
    <Reader
      key={`${collection}:${dateKey}`}
      reading={sessionReading(collection)}
      dateKey={dateKey}
      title={t(`azkar.collection.${collection}`)}
      completeTitle={t(`azkar.complete.title.${collection}`)}
    />
  )
}

/** `/azkar/:collection`. Anything that is not a session with content goes back to the picker. */
export function ReaderPage() {
  const { collection } = useParams()
  if (!isCollectionId(collection) || !availableCollections().includes(collection)) {
    return <Navigate to="/azkar" replace />
  }
  return <DatedReader collection={collection} />
}
