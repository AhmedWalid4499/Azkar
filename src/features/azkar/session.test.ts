import { describe, expect, it } from 'vitest'
import type { Dhikr } from './data'
import { countOf, nextUnfinished, summarize, targetOf } from './session'

function dhikr(id: string, repeat: number): Dhikr {
  return { id, arabic: id, translation: id, repeat, reference: { en: '', ar: '' } }
}

const items = [dhikr('a', 3), dhikr('b', 1), dhikr('c', 10)]

describe('countOf', () => {
  it('never reports more than the target, even if the stored count is higher', () => {
    expect(countOf(items[0]!, { a: 99 })).toBe(3)
  })

  it('treats missing, negative and non-numeric counts as zero', () => {
    expect(countOf(items[0]!, undefined)).toBe(0)
    expect(countOf(items[0]!, { a: -2 })).toBe(0)
    expect(countOf(items[0]!, { a: Number.NaN })).toBe(0)
    expect(countOf(items[0]!, { a: '2' } as never)).toBe(0)
  })

  it('does not read inherited properties as counts', () => {
    expect(countOf(dhikr('constructor', 3), {})).toBe(0)
    expect(countOf(dhikr('toString', 3), {})).toBe(0)
  })
})

describe('targetOf', () => {
  it('falls back to one repetition for a malformed repeat', () => {
    expect(targetOf(dhikr('x', 0))).toBe(1)
    expect(targetOf(dhikr('x', -3))).toBe(1)
    expect(targetOf(dhikr('x', 2.5))).toBe(1)
    expect(targetOf(dhikr('x', 100))).toBe(100)
  })
})

describe('summarize', () => {
  it('starts idle with nothing done', () => {
    expect(summarize(items, undefined)).toEqual({ total: 3, done: 0, fraction: 0, status: 'idle', firstUnfinished: 0 })
  })

  it('gives partial credit for a dhikr that is part-way through', () => {
    const summary = summarize(items, { a: 3, c: 5 })
    expect(summary.done).toBe(1)
    expect(summary.status).toBe('active')
    expect(summary.firstUnfinished).toBe(1)
    expect(summary.fraction).toBeCloseTo((1 + 0 + 0.5) / 3)
  })

  it('is complete only when every dhikr reaches its count', () => {
    expect(summarize(items, { a: 3, b: 1, c: 9 }).status).toBe('active')
    expect(summarize(items, { a: 3, b: 1, c: 10 })).toEqual({
      total: 3,
      done: 3,
      fraction: 1,
      status: 'complete',
      firstUnfinished: -1,
    })
  })

  it('never calls an empty session complete', () => {
    expect(summarize([], undefined).status).toBe('idle')
  })
})

describe('nextUnfinished', () => {
  it('moves to the next dhikr that still needs counting', () => {
    expect(nextUnfinished(items, { a: 3 }, 0)).toBe(1)
    expect(nextUnfinished(items, { a: 3, b: 1 }, 0)).toBe(2)
  })

  it('wraps round to azkar skipped earlier', () => {
    expect(nextUnfinished(items, { b: 1, c: 10 }, 2)).toBe(0)
  })

  it('returns -1 when the session is finished', () => {
    expect(nextUnfinished(items, { a: 3, b: 1, c: 10 }, 1)).toBe(-1)
  })
})
