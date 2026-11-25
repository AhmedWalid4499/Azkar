// Duas for occasions: the chapters of Hisn al-Muslim that are not read as a daily session.
// Native app only: build-occasions.mjs writes them to their own file, so the website's dataset
// is unchanged.
//
// Like the other mapping files this one holds no Arabic. The Arabic of every entry, of every
// chapter title and of every reference is copied from asellam/HisnElMuslim (raw/, pinned in
// sources.mjs) by build-occasions.mjs. The English titles, meanings, transliterations and
// references were written for this project, in occasions/part-*.mjs.
//
// Chapters are numbered by their position in asellam's file, from 1, as the book numbers them.

import * as PART_1 from './occasions/part-1.mjs'
import * as PART_2 from './occasions/part-2.mjs'
import * as PART_3 from './occasions/part-3.mjs'
import * as PART_4 from './occasions/part-4.mjs'
import * as PART_5 from './occasions/part-5.mjs'

export const OCCASIONS_VERSION = 1

/** Chapters the app already reads as sessions (morning, evening, after the salam, sleep, tasbih). */
export const READ_AS_SESSIONS = [25, 27, 28, 29, 131]

/**
 * Chapters left out because they hold no words to say on an occasion: the virtue of visiting the
 * sick (51), the virtue of the blessings on the Prophet (108), spreading the salam (109), how the
 * Prophet counted his tasbih (132), and general good manners (133).
 */
export const LEFT_OUT = [51, 108, 109, 132, 133]

/** Every chapter of the book is in exactly one theme, is read as a session, or is left out. */
export const THEMES = [
  { id: 'daily', title: 'Waking, dressing and the home', chapters: [1, 2, 3, 4, 5, 6, 7, 10, 11] },
  { id: 'wudu-masjid', title: 'Wudu, the masjid and the adhan', chapters: [8, 9, 12, 13, 14, 15] },
  { id: 'prayer', title: 'In the prayer', chapters: [16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 33, 34] },
  { id: 'night', title: 'The night', chapters: [30, 31, 32] },
  {
    id: 'hardship',
    title: 'Worry, fear and hardship',
    chapters: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 46, 47, 54, 83, 93, 127, 129],
  },
  { id: 'forgiveness', title: 'Forgiveness and remembrance', chapters: [45, 85, 86, 89, 130] },
  {
    id: 'illness-death',
    title: 'Illness, death and the graves',
    chapters: [50, 52, 53, 55, 56, 57, 58, 59, 60, 61, 84, 125, 126],
  },
  { id: 'family', title: 'Family and marriage', chapters: [48, 49, 80, 81, 82] },
  { id: 'nature', title: 'Weather and nature', chapters: [62, 63, 64, 65, 66, 67, 68, 77, 111, 112] },
  { id: 'food-fasting', title: 'Food and fasting', chapters: [69, 70, 71, 72, 73, 74, 75, 76] },
  {
    id: 'people',
    title: 'With other people',
    chapters: [78, 79, 87, 88, 90, 91, 92, 94, 95, 107, 110, 113, 114, 115, 123, 124],
  },
  { id: 'travel', title: 'Travel', chapters: [96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106] },
  { id: 'hajj', title: 'Hajj, Umrah and the sacrifice', chapters: [116, 117, 118, 119, 120, 121, 122, 128] },
]

const PARTS = [PART_1, PART_2, PART_3, PART_4, PART_5]

/** English chapter titles by chapter number. */
export const CHAPTER_TITLES = Object.assign({}, ...PARTS.map((part) => part.CHAPTERS))

/**
 * Every entry of every chapter in a theme: `{ chapter, index, kind, transliteration?, translation,
 * reference }`. `kind` is 'say' for words to recite, which the app counts, or 'read' for guidance
 * and narrations of what to do, which it shows without a counter.
 */
export const ENTRIES = PARTS.flatMap((part) => part.ENTRIES)
