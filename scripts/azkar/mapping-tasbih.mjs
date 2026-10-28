// Presets of the free tasbih counter: short formulas to repeat, each an item of the dataset whose
// Arabic is copied by build.mjs like any other. Most are items of the other lists, re-used as
// they are; the one formula no list recites alone has an item of its own here, from the chapter
// "The virtue of tasbih, tahmid, tahlil and takbir" of Hisn al-Muslim. As in mapping.mjs, this file
// holds no Arabic. A preset's `repeat` is the count its narration gives (1 when it gives none):
// the counter itself has no limit.

import { A, B, H, bookText, note, words } from './lib/selectors.mjs'

const CHAPTER = 'tasbih-virtues'

export const TASBIH_ITEMS = [
  {
    id: 'la-ilaha-illallah',
    entry: 11,
    repeat: 1,
    arabic: words(A(CHAPTER, 10), 7, 10),
    witnesses: [words(B(11, CHAPTER), 7, 10), words(H('tirmidhi', 3383), 39, 42)],
    transliteration: 'Lā ilāha illallāh.',
    translation: 'There is no god but Allah.',
    virtue: {
      en: 'The best supplication is "Al-hamdu lillah", and the best remembrance is "La ilaha illallah".',
      ar: [bookText(11, CHAPTER)],
    },
    // The book prints no space after the comma that follows al-Hakim's page; the segments are rejoined.
    reference: {
      en: "At-Tirmidhi 5/462 (no. 3383); Ibn Majah 2/1249 (no. 3800); al-Hakim 1/503, who graded it authentic, and adh-Dhahabi agreed; see also Sahih al-Jami' 1/362",
      ar: [note(2, 11, { chapter: CHAPTER, segments: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })],
    },
  },
]

/** In the order the counter offers them. */
export const TASBIH = [
  { id: 'subhanallah' },
  { id: 'alhamdulillah' },
  { id: 'allahu-akbar' },
  { id: 'la-ilaha-illallah' },
  { id: 'astaghfirullah' },
  { id: 'allahumma-salli-wa-sallim-ala-nabiyyina-muhammad' },
  { id: 'subhanallahi-wa-bihamdih' },
]
