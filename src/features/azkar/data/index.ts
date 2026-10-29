import raw from './azkar.json'
import { COLLECTION_IDS } from './schema'
import type { AfterPrayerName, AzkarData, CollectionId, Dhikr } from './schema'

export type { AfterPrayerName, AfterPrayerRule, AzkarData, AzkarSource, Bilingual, CollectionId, Dhikr, QuranRef } from './schema'
export { COLLECTION_IDS } from './schema'

export const azkarData = raw as AzkarData

/** Sessions that actually have content, in display order. */
export function availableCollections(): CollectionId[] {
  return COLLECTION_IDS.filter((id) => (azkarData.collections[id]?.length ?? 0) > 0)
}

/** The adhkar of one session, in recitation order. */
export function getCollection(id: CollectionId): Dhikr[] {
  const ids = azkarData.collections[id] ?? []
  return ids.map((dhikrId) => {
    const dhikr = azkarData.items[dhikrId]
    if (!dhikr) throw new Error(`Collection "${id}" references unknown dhikr "${dhikrId}"`)
    return dhikr
  })
}

function itemsOf(ids: readonly string[], list: string): Dhikr[] {
  return ids.map((dhikrId) => {
    const dhikr = azkarData.items[dhikrId]
    if (!dhikr) throw new Error(`${list} references unknown dhikr "${dhikrId}"`)
    return dhikr
  })
}

/**
 * The azkar said after one obligatory prayer, in order, each with `repeat` set
 * to its count after that prayer. Empty for a dataset without the list.
 */
export function getAfterPrayerAzkar(prayer: AfterPrayerName): Dhikr[] {
  return itemsOf(azkarData.afterPrayer ?? [], 'The after-prayer list')
    .filter((dhikr) => !dhikr.afterPrayer?.prayers || dhikr.afterPrayer.prayers.includes(prayer))
    .map((dhikr) => {
      const repeat = dhikr.afterPrayer?.repeat?.[prayer]
      return repeat === undefined ? dhikr : { ...dhikr, repeat }
    })
}

/** Short formulas offered as presets in the tasbih counter, in order. Empty for a dataset without them. */
export function getTasbihPresets(): Dhikr[] {
  return itemsOf(azkarData.tasbih ?? [], 'The tasbih list')
}
