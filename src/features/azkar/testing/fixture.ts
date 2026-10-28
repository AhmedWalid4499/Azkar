// A tiny dataset for tests, so they do not depend on the real one. Use it as:
//   vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
import type { AfterPrayerName, AzkarData, CollectionId, Dhikr } from '../data'

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

// The after-prayer and tasbih items carry placeholder text, not real recitations.

/** Said once after every prayer. */
export const afterOnce: Dhikr = {
  id: 'after-once',
  arabic: 'نص تجريبي بعد الصلاة مرة',
  transliteration: 'After once',
  translation: 'Test text said once after each prayer',
  repeat: 1,
  reference: { en: 'Test after reference one', ar: 'مرجع تجريبي بعد الصلاة أول' },
}

/** Said three times after every prayer. */
export const afterThrice: Dhikr = {
  id: 'after-thrice',
  arabic: 'نص تجريبي بعد الصلاة ثلاثا',
  transliteration: 'After thrice',
  translation: 'Test text said three times after each prayer',
  repeat: 3,
  reference: { en: 'Test after reference two', ar: 'مرجع تجريبي بعد الصلاة ثانٍ' },
}

/** Said after Fajr and Maghrib only: ten times after Fajr, seven after Maghrib. */
export const afterDawnAndDusk: Dhikr = {
  id: 'after-dawn-dusk',
  arabic: 'نص تجريبي بعد الفجر والمغرب',
  transliteration: 'After dawn and dusk',
  translation: 'Test text said after Fajr and Maghrib',
  repeat: 1,
  reference: { en: 'Test after reference three', ar: 'مرجع تجريبي بعد الصلاة ثالث' },
  afterPrayer: { prayers: ['fajr', 'maghrib'], repeat: { fajr: 10, maghrib: 7 } },
}

export const presetOne: Dhikr = {
  id: 'preset-one',
  arabic: 'نص تجريبي للتسبيح أول',
  transliteration: 'Preset one',
  translation: 'Test meaning of the first preset',
  repeat: 33,
  reference: { en: 'Test preset reference one', ar: 'مرجع تجريبي للتسبيح أول' },
}

export const presetTwo: Dhikr = {
  id: 'preset-two',
  arabic: 'نص تجريبي للتسبيح ثانٍ',
  transliteration: 'Preset two',
  translation: 'Test meaning of the second preset',
  repeat: 100,
  reference: { en: 'Test preset reference two', ar: 'مرجع تجريبي للتسبيح ثانٍ' },
}

/** The after-prayer list in order. Fajr: once, thrice, dawn-and-dusk ×10. Dhuhr: once, thrice. Maghrib: …, ×7. */
export const AFTER_PRAYER_LIST = [afterOnce.id, afterThrice.id, afterDawnAndDusk.id]
export const TASBIH_LIST = [presetOne.id, presetTwo.id]

/**
 * Morning and evening sessions only, and no after-prayer or tasbih list, as the dataset was
 * before those were added: a test sets `azkarData.afterPrayer`, `azkarData.tasbih` or
 * `azkarData.collections.sleep` to try them (see `withAfterPrayer` and `withTasbih`).
 */
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
    items: Object.fromEntries(
      [tasbih, hamd, takbir, afterOnce, afterThrice, afterDawnAndDusk, presetOne, presetTwo].map((dhikr) => [dhikr.id, dhikr]),
    ),
    collections: {
      morning: ['tasbih', 'hamd', 'takbir'],
      evening: ['hamd', 'tasbih'],
    },
  }
}

/** Stands in for `./data`. `azkarData` is mutable so a test can add a session or a list, or empty the sources. */
export function createDataModule(data: AzkarData = createFixtureData()) {
  const COLLECTION_IDS = ['morning', 'evening', 'sleep'] as const
  const itemsOf = (ids: readonly string[]) =>
    ids.map((dhikrId) => {
      const dhikr = data.items[dhikrId]
      if (!dhikr) throw new Error(`Unknown dhikr "${dhikrId}"`)
      return dhikr
    })
  return {
    COLLECTION_IDS,
    azkarData: data,
    availableCollections: (): CollectionId[] =>
      COLLECTION_IDS.filter((id) => (data.collections[id]?.length ?? 0) > 0),
    getCollection: (id: CollectionId): Dhikr[] => itemsOf(data.collections[id] ?? []),
    // As the real accessor: the items said after `prayer`, each with that prayer's count.
    getAfterPrayerAzkar: (prayer: AfterPrayerName): Dhikr[] =>
      itemsOf(data.afterPrayer ?? [])
        .filter((dhikr) => !dhikr.afterPrayer?.prayers || dhikr.afterPrayer.prayers.includes(prayer))
        .map((dhikr) => {
          const repeat = dhikr.afterPrayer?.repeat?.[prayer]
          return repeat === undefined ? dhikr : { ...dhikr, repeat }
        }),
    getTasbihPresets: (): Dhikr[] => itemsOf(data.tasbih ?? []),
  }
}

type FixtureData = Pick<AzkarData, 'afterPrayer' | 'tasbih'>

/** Gives the mocked dataset its after-prayer list. Undo with `delete azkarData.afterPrayer`. */
export function withAfterPrayer(data: FixtureData) {
  data.afterPrayer = [...AFTER_PRAYER_LIST]
}

/** Gives the mocked dataset its tasbih presets. Undo with `delete azkarData.tasbih`. */
export function withTasbih(data: FixtureData) {
  data.tasbih = [...TASBIH_LIST]
}
