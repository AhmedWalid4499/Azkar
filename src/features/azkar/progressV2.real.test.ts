import { beforeEach, describe, expect, it } from 'vitest'
import { getCollection } from './data'
import { AZKAR_PROGRESS_STORAGE_KEY, emptyAzkarProgress, sanitizeProgress, useAzkarProgress } from './progressStore'
import { targetOf } from './session'
import V2_REAL from './testing/progressV2.real.json'
import { lifetimeTotals } from './tracking'

// Against the real dataset. The payload is what a version 2 build saved, captured from that
// build's own store: today's morning read in full at 05:50 UTC, the evening begun at 16:10.
const TODAY = '2026-10-12'
const store = () => useAzkarProgress.getState()

beforeEach(() => {
  useAzkarProgress.setState(emptyAzkarProgress())
  localStorage.clear()
})

describe('migrating a real version 2 payload', () => {
  it('keeps the real morning and evening, their times and every total', async () => {
    localStorage.setItem(AZKAR_PROGRESS_STORAGE_KEY, JSON.stringify(V2_REAL))
    await useAzkarProgress.persist.rehydrate()

    expect(sanitizeProgress(store())).toEqual(sanitizeProgress(V2_REAL.state))
    const morning = getCollection('morning')
    const recited = morning.reduce((sum, dhikr) => sum + targetOf(dhikr), 0)
    expect(store().sessions[TODAY]?.morning).toEqual({
      startedAt: Date.parse(`${TODAY}T05:50:00Z`),
      lastAt: Date.parse(`${TODAY}T05:50:00Z`),
      completedAt: Date.parse(`${TODAY}T05:50:00Z`),
      completed: true,
      done: morning.length,
      total: morning.length,
      recitations: recited,
    })
    expect(lifetimeTotals(store()).recitations).toBe(recited + 2)
    expect(store().afterPrayer).toEqual({ days: {}, sessions: {}, totals: {} })
    expect(store().tasbih).toEqual({ days: {}, totals: {}, free: 0 })

    const saved = JSON.parse(localStorage.getItem(AZKAR_PROGRESS_STORAGE_KEY)!) as { state: { history: unknown }; version: number }
    expect(saved.version).toBe(3)
    expect(saved.state.history).toEqual(V2_REAL.state.history)
  })
})
