import raw from './azkar.json'
import { COLLECTION_IDS } from './schema'
import type { AzkarData, CollectionId, Dhikr } from './schema'

export type { AzkarData, AzkarSource, Bilingual, CollectionId, Dhikr, QuranRef } from './schema'
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
