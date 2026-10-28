/** A recitation session. `sleep` is optional and only shown when the dataset provides it. */
export const COLLECTION_IDS = ['morning', 'evening', 'sleep'] as const
export type CollectionId = (typeof COLLECTION_IDS)[number]

/** An inclusive ayah range, used to verify Qur'anic text against a canonical source. */
export interface QuranRef {
  surah: number
  from: number
  to: number
}

export interface Bilingual {
  en: string
  ar: string
}

/** The five obligatory prayers, as in src/shared/types (repeated here so the data layer stays self-contained). */
export type AfterPrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

/**
 * How a dhikr of the after-prayer list applies to each prayer. Some are said
 * only after certain prayers (for example after Fajr and Maghrib), and some
 * are repeated a different number of times after certain prayers.
 */
export interface AfterPrayerRule {
  /** The prayers it is said after. Absent means all five. */
  prayers?: AfterPrayerName[]
  /** Repetitions after particular prayers, overriding `repeat` for those. */
  repeat?: Partial<Record<AfterPrayerName, number>>
}

export interface Dhikr {
  /** Stable slug. Progress is stored against it, so never rename one. */
  id: string
  /** Fully vocalised Arabic text to recite. */
  arabic: string
  transliteration?: string
  /** English translation of the meaning. */
  translation: string
  /** How many times to recite it in one session. */
  repeat: number
  /**
   * The source's own remark on the count when `repeat` cannot carry it,
   * e.g. "Ten times, or once if one feels too weary" or "One hundred times during the day".
   */
  note?: Bilingual
  /** Reward or benefit mentioned in the narration, when there is one. */
  virtue?: Bilingual
  /** Where it is narrated, e.g. "Abu Dawud 5068; at-Tirmidhi 3391". */
  reference: Bilingual
  /** Set when `arabic` contains Qur'an, so tests can check it verbatim. */
  quran?: QuranRef[]
  /** Only on items of the after-prayer list: which prayers it follows and how often. */
  afterPrayer?: AfterPrayerRule
}

export interface AzkarSource {
  name: string
  url: string
  license: string
  /** What this source was used for, e.g. "Arabic text and counts". */
  usedFor: string
}

export interface AzkarData {
  version: number
  sources: AzkarSource[]
  items: Record<string, Dhikr>
  /** Ordered dhikr ids per session. Morning and evening wordings that differ are separate items. */
  collections: Partial<Record<CollectionId, string[]>>
  /** Ordered dhikr ids recited after the obligatory prayers. Each item may carry an `afterPrayer` rule. */
  afterPrayer?: string[]
  /** Ordered dhikr ids offered as presets in the tasbih counter: short formulas to repeat. */
  tasbih?: string[]
}
