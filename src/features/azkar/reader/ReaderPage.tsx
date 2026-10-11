import { Navigate, useParams } from 'react-router-dom'
import { useSessionDay } from '../clock'
import { isCollectionId } from '../collections'
import { availableCollections } from '../data'
import type { CollectionId } from '../data'
import { Reader } from './Reader'

function DatedReader({ collection }: { collection: CollectionId }) {
  const dateKey = useSessionDay(collection)
  // A new day is a new session: remounting resets the position and brings up that day's counts.
  return <Reader key={`${collection}:${dateKey}`} collection={collection} dateKey={dateKey} />
}

/** `/azkar/:collection`. Anything that is not a session with content goes back to the picker. */
export function ReaderPage() {
  const { collection } = useParams()
  if (!isCollectionId(collection) || !availableCollections().includes(collection)) {
    return <Navigate to="/azkar" replace />
  }
  return <DatedReader collection={collection} />
}
