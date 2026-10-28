import { beforeEach, describe, expect, it } from 'vitest'
import { getCollection } from './data'
import { AZKAR_PROGRESS_STORAGE_KEY, useAzkarProgress } from './progressStore'
import { snippet } from './reader/text'
import { targetOf } from './session'
import { lifetimeTotals } from './tracking'

// Against the real dataset: the ids a version 1 build stored are the ids version 2 counts against.
const TODAY = '2026-10-12'
const store = () => useAzkarProgress.getState()

beforeEach(() => {
  useAzkarProgress.setState({ days: {}, sessions: {}, totals: {}, totalRecitations: 0 })
  localStorage.clear()
})

describe('migrating a real version 1 payload', () => {
  it('turns a finished morning and a begun evening into records with the real totals', async () => {
    const morning = getCollection('morning')
    const morningCounts = Object.fromEntries(morning.map((dhikr) => [dhikr.id, targetOf(dhikr)]))
    // The evening as far as Ayat al-Kursi and the three Quls, both also read in the morning.
    const eveningCounts = { 'ayat-al-kursi': 1, 'al-ikhlas-al-falaq-an-nas': 2 }
    localStorage.setItem(
      AZKAR_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        state: {
          days: { [TODAY]: { morning: morningCounts, evening: eveningCounts } },
          history: { [TODAY]: ['morning'], '2026-03-01': ['morning', 'evening'] },
        },
        version: 1,
      }),
    )
    await useAzkarProgress.persist.rehydrate()

    const morningRecitations = morning.reduce((sum, dhikr) => sum + targetOf(dhikr), 0)
    expect(store().sessions[TODAY]).toEqual({
      morning: { completed: true, done: 23, total: 23, recitations: morningRecitations },
      evening: { completed: false, done: 1, total: 20, recitations: 3 },
    })
    expect(store().sessions['2026-03-01']).toEqual({
      morning: { completed: true, done: 23, total: 23, recitations: 0 },
      evening: { completed: true, done: 20, total: 20, recitations: 0 },
    })
    expect(store().totals['ayat-al-kursi']).toBe(2)
    expect(store().totals['al-ikhlas-al-falaq-an-nas']).toBe(5)
    expect(store().totals['subhanallahi-wa-bihamdih']).toBe(100)
    expect(store().totalRecitations).toBe(morningRecitations + 3)

    const lifetime = lifetimeTotals(store())
    expect(lifetime.sessionsCompleted).toEqual({ morning: 2, evening: 1, sleep: 0 })
    const ayatAlKursi = lifetime.byDhikr.find((row) => row.id === 'ayat-al-kursi')
    expect(ayatAlKursi?.snippet).toBe(snippet(morning.find((dhikr) => dhikr.id === 'ayat-al-kursi')!.arabic))
  })
})
