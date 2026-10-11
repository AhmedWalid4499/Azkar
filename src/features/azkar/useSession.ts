import { useMemo } from 'react'
import type { DateKey } from '../../shared/types'
import { getCollection } from './data'
import type { CollectionId, Dhikr } from './data'
import { useSessionCounts } from './progressStore'
import { summarize } from './session'
import type { Counts, SessionSummary } from './session'

export interface Session {
  items: Dhikr[]
  counts: Counts | undefined
  summary: SessionSummary
}

/** A session's adhkar with the counts recorded for `dateKey`. */
export function useSession(collection: CollectionId, dateKey: DateKey): Session {
  const items = useMemo(() => getCollection(collection), [collection])
  const counts = useSessionCounts(dateKey, collection)
  const summary = useMemo(() => summarize(items, counts), [items, counts])
  return { items, counts, summary }
}
