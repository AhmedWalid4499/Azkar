import { useMemo } from 'react'
import type { DateKey } from '../../shared/types'
import { useFast } from './store'
import type { FastingDays, FastKind, FastRecord, FastStatus } from './types'

/** What a calendar cell shows of a day's fast. */
export interface FastingMark {
  kind: FastKind
  status: FastStatus
  /** Fasted to the end, so worth a mark of its own. */
  fasted: boolean
}

export function fastingMarkOf(record: FastRecord | undefined): FastingMark | null {
  return record ? { kind: record.kind, status: record.status, fasted: record.status === 'fasted' } : null
}

/** The mark of one day in a map of fasts, as from `useFastingRange`. */
export function fastingMarkOn(days: FastingDays, dateKey: DateKey): FastingMark | null {
  return fastingMarkOf(Object.prototype.hasOwnProperty.call(days, dateKey) ? days[dateKey] : undefined)
}

/** A day's mark, or `null` when no fast is logged for it. */
export function useFastingMark(dateKey: DateKey): FastingMark | null {
  const record = useFast(dateKey)
  return useMemo(() => fastingMarkOf(record), [record])
}
