import { useCallback, useMemo } from 'react'
import { formatClock } from '../../shared/date'
import { useI18n } from '../../shared/i18n'
import { useSettings } from '../../shared/settings'
import { useActiveTimeZone } from '../../shared/time'
import type { DateKey } from '../../shared/types'
import type { CollectionId } from './data'
import type { SessionRecord } from './progressData'
import { useSessionRecord } from './progressStore'
import type { SessionStatus, SessionSummary } from './session'
import { useSession } from './useSession'

/** Where a session stands for a day, as the cards show it. */
export interface SessionStanding {
  status: SessionStatus
  done: number
  total: number
  /** 0 to 1. */
  fraction: number
  /** When the session was completed, if it is and the time is known. */
  completedAt: number | undefined
}

/**
 * The day's counts, overruled by its record once the session was completed: a completion
 * stays on show after "Start over", while the counts begin again for a second reading.
 */
export function standingOf(summary: SessionSummary, record: SessionRecord | undefined): SessionStanding {
  const { total } = summary
  if (summary.status === 'complete' || record?.completed === true) {
    return { status: 'complete', done: total, total, fraction: 1, completedAt: record?.completedAt }
  }
  return { status: summary.status, done: summary.done, total, fraction: summary.fraction, completedAt: undefined }
}

export function useSessionStanding(collection: CollectionId, dateKey: DateKey): SessionStanding {
  const { summary } = useSession(collection, dateKey)
  const record = useSessionRecord(dateKey, collection)
  return useMemo(() => standingOf(summary, record), [summary, record])
}

/** Formats a stored instant as a wall-clock time in the active zone, honouring the 12/24-hour setting. */
export function useTimeOfDay(): (at: number) => string {
  const { locale } = useI18n()
  const timeZone = useActiveTimeZone()
  const hour12 = useSettings((state) => state.timeFormat === '12h')
  return useCallback((at) => formatClock(new Date(at), locale, timeZone, hour12), [locale, timeZone, hour12])
}

/** "Done at 6:12 AM" for a completed session, or just "Completed" when the time is not known. */
export function useCompletedLabel(): (completedAt: number | undefined) => string {
  const { t } = useI18n()
  const timeOfDay = useTimeOfDay()
  return useCallback(
    (completedAt) =>
      completedAt === undefined ? t('azkar.state.completed') : t('azkar.doneAt', { time: timeOfDay(completedAt) }),
    [t, timeOfDay],
  )
}
