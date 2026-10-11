import type { Dhikr } from './data'

/** Repetitions recorded so far, by dhikr id. */
export type Counts = Readonly<Record<string, number>>

export type SessionStatus = 'idle' | 'active' | 'complete'

export interface SessionSummary {
  total: number
  /** Adhkar that have reached their count. */
  done: number
  /** 0 to 1, giving partial credit for a dhikr that is part-way through its repetitions. */
  fraction: number
  status: SessionStatus
  /** Index of the first dhikr still short of its count, or -1 when all are done. */
  firstUnfinished: number
}

/** How many times a dhikr is recited. Guards against a malformed dataset entry. */
export function targetOf(dhikr: Dhikr): number {
  return Number.isInteger(dhikr.repeat) && dhikr.repeat > 0 ? dhikr.repeat : 1
}

/** The recorded count for a dhikr, never above its target (the dataset may have changed since it was stored). */
export function countOf(dhikr: Dhikr, counts: Counts | undefined): number {
  const raw = counts && Object.hasOwn(counts, dhikr.id) ? counts[dhikr.id] : undefined
  if (typeof raw !== 'number' || !(raw > 0)) return 0
  return Math.min(Math.floor(raw), targetOf(dhikr))
}

export function isDone(dhikr: Dhikr, counts: Counts | undefined): boolean {
  return countOf(dhikr, counts) >= targetOf(dhikr)
}

export function summarize(items: readonly Dhikr[], counts: Counts | undefined): SessionSummary {
  let done = 0
  let credit = 0
  let touched = false
  let firstUnfinished = -1
  items.forEach((dhikr, index) => {
    const count = countOf(dhikr, counts)
    const target = targetOf(dhikr)
    if (count > 0) touched = true
    credit += count / target
    if (count >= target) done += 1
    else if (firstUnfinished === -1) firstUnfinished = index
  })
  const total = items.length
  const complete = total > 0 && done === total
  return {
    total,
    done,
    fraction: total === 0 ? 0 : credit / total,
    status: complete ? 'complete' : touched ? 'active' : 'idle',
    firstUnfinished,
  }
}

/**
 * Where to go after the dhikr at `from`: the next unfinished one, wrapping to
 * the start so adhkar skipped earlier are not forgotten. -1 when all are done.
 */
export function nextUnfinished(items: readonly Dhikr[], counts: Counts | undefined, from: number): number {
  for (let step = 1; step <= items.length; step++) {
    const index = (from + step) % items.length
    const dhikr = items[index]
    if (dhikr && !isDone(dhikr, counts)) return index
  }
  return -1
}
