// A tiny dataset for tests, so they do not depend on the real one. Use it as:
//   vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
import type { AzkarData, CollectionId, Dhikr } from '../data'

export const tasbih: Dhikr = {
  id: 'tasbih',
  arabic: 'سُبْحَانَ اللَّهِ',
  transliteration: 'Subhan Allah',
  translation: 'Glory be to Allah',
  repeat: 3,
  reference: { en: 'Test reference one', ar: 'مرجع تجريبي أول' },
  virtue: { en: 'Test virtue in English', ar: 'فضل تجريبي بالعربية' },
}

export const hamd: Dhikr = {
  id: 'hamd',
  arabic: 'الْحَمْدُ لِلَّهِ',
  transliteration: 'Alhamdu lillah',
  translation: 'All praise is for Allah',
  repeat: 1,
  reference: { en: 'Test reference two', ar: 'مرجع تجريبي ثانٍ' },
}

export const takbir: Dhikr = {
  id: 'takbir',
  arabic: 'اللَّهُ أَكْبَرُ',
  translation: 'Allah is the Greatest',
  repeat: 10,
  reference: { en: 'Test reference three', ar: 'مرجع تجريبي ثالث' },
}

export function createFixtureData(): AzkarData {
  return {
    version: 1,
    sources: [
      {
        name: 'Test Source',
        url: 'https://example.org/source',
        license: 'CC0',
        usedFor: 'Arabic text and counts',
      },
    ],
    items: { tasbih, hamd, takbir },
    collections: {
      morning: ['tasbih', 'hamd', 'takbir'],
      evening: ['hamd', 'tasbih'],
    },
  }
}

/** Stands in for `./data`. `azkarData` is mutable so a test can add a session or empty the sources. */
export function createDataModule(data: AzkarData = createFixtureData()) {
  const COLLECTION_IDS = ['morning', 'evening', 'sleep'] as const
  return {
    COLLECTION_IDS,
    azkarData: data,
    availableCollections: (): CollectionId[] =>
      COLLECTION_IDS.filter((id) => (data.collections[id]?.length ?? 0) > 0),
    getCollection: (id: CollectionId): Dhikr[] =>
      (data.collections[id] ?? []).map((dhikrId) => {
        const dhikr = data.items[dhikrId]
        if (!dhikr) throw new Error(`Unknown dhikr "${dhikrId}"`)
        return dhikr
      }),
  }
}
