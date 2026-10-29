// The azkar said after the salam of the obligatory prayers: the chapter "Remembrance after the
// salam of the prayer" of Hisn al-Muslim (nos. 66 to 73 of the book), in the book's order. As in
// mapping.mjs, this file holds no Arabic: it names the pinned records build.mjs copies from and
// holds every English field. The selectors are those of lib/selectors.mjs.
//
// The list. AFTER_PRAYER gives the order and, per entry, the rule the reader applies:
//   prayers     the prayers the dhikr follows, when not all five
//   repeat      the count after particular prayers, when it is not the item's own `repeat`
//               (the chapter gives none: see "Counts per prayer" below)
//   sameWordsAs records of this chapter that the item must match word for word, but for the
//               differences declared in knownWordDifferences (checked by build.mjs)
//
// An item is shared with the morning and evening sessions only when everything it shows is true
// after a prayer as well: the supplication after Fajr is, its reference being Ibn Majah 925 (said
// "when he prayed the Subh prayer, on giving the salam"). Ayat al-Kursi and the three surahs have
// an after-prayer narration and virtue of their own, so they are items of their own here, with the
// same Arabic built from the same Tanzil ayat and asellam line as the morning and evening items.
//
// Entries that mix counts are split so that the counter is truthful:
//   entry 1   "Astaghfirullah" three times, then "Allahumma antas-salam" once: two items
//   entry 2   the tahlil three times (al-Bukhari 6473, which the book adds in square brackets),
//             then "Allahumma la mani'a" once: two items
//   entry 4   subhanallah, alhamdulillah and Allahu akbar thirty-three times each, then the tahlil
//             that completes the hundred, once: four items (Muslim 597)
// The three formulas of entry 4 are said one after the other, each with its own count, so each is
// recited alone, without the "and" that joins them in the book's list. The words are asellam's
// typing of each formula on its own, in its sleep chapter, where the book lists the same three
// formulas with their counts; the after-prayer records are kept as witnesses.
//
// Counts per prayer, as the chapter gives them: entry 5 (the three surahs) and entry 6 (Ayat
// al-Kursi) "after every prayer", once; entry 7 ten times "after the Maghrib and the Subh prayer";
// entry 8 "after the salam of the Fajr prayer". The edition read here says nothing of saying the
// three surahs three times after Fajr and Maghrib; some editions add it, from the morning and
// evening hadith of Abdullah ibn Khubayb (Abu Dawud 5082), which the morning and evening sessions
// already recite. The hadiths the entry cites say "after every prayer" and give no number, so the
// count stays one and the item's note says so.
//
// The digital text of the book lost entry 6 (Ayat al-Kursi) and numbers the footnotes of entries
// 6 and 7 both "2"; lib/raw.mjs declares the gap and `occurrence` picks the second footnote.

import { AYAT_AL_KURSI, QULS, TAHLIL } from './mapping.mjs'
import { A, B, H, hadithText, list, note, surahName, words } from './lib/selectors.mjs'

/** The five obligatory prayers, in the order of the day, as src/shared/types names them. */
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

const CHAPTER = 'after-prayer'
const AP = (index) => A(CHAPTER, index)
const BP = (entry) => B(entry, CHAPTER)
const apNote = (page, number, options = {}) => note(page, number, { chapter: CHAPTER, ...options })

/** Muslim 1/418, no. 597: the narration of the thirty-three of each and the tahlil after them. */
const MUSLIM_597 = { en: 'Muslim 1/418 (no. 597)', ar: [apNote(0, 4, { segments: [0, 1, 2] })] }

/** Bukhari 844 and Muslim 593, the narration of entry 2. */
const BUKHARI_844 = 'Al-Bukhari 1/255 (no. 844); Muslim 1/414 (no. 593)'

export const AFTER_PRAYER_ITEMS = [
  {
    id: 'astaghfirullah',
    entry: 1,
    // "Three times": the book's own bracketed count in the entry, and Muslim 591, "he asked for
    // forgiveness three times", where al-Awza'i explains it as saying "Astaghfirullah".
    repeat: 3,
    arabic: words(AP(0), 0, 1),
    witnesses: [words(BP(1), 0, 1), words(H('muslim', 1334), 58, 59)],
    transliteration: 'Astaghfirullāh.',
    translation: 'I ask Allah for forgiveness.',
    reference: { en: 'Muslim 1/414 (no. 591)', ar: [apNote(0, 1)] },
  },
  {
    id: 'allahumma-antas-salam',
    entry: 1,
    repeat: 1,
    arabic: words(AP(0), 3, 12),
    witnesses: [words(BP(1), 3, 12), words(H('muslim', 1334), 39, 47)],
    // Muslim's own wording has "tabarakta dhal-jalal", without the "ya" the book prints.
    knownWordDifferences: { 'hadith:muslim:1334[39-47]': 1 },
    transliteration: 'Allāhumma antas-salāmu wa minkas-salām, tabārakta yā dhal-jalāli wal-ikrām.',
    translation: 'O Allah, You are Peace, and from You comes peace. Blessed are You, O Possessor of majesty and honour.',
    // "Ya dhal-jalal", as the book prints it, is the wording of two narrations Muslim gives of
    // Aishah's hadith right after it (592; read in the open hadith API, sequence 1336 and 1337).
    reference: {
      en: 'Muslim 1/414 (no. 591); "ya dhal-jalal", with "ya", is the wording of the narrations of Aishah that Muslim gives after it',
      ar: [apNote(0, 1)],
    },
  },
  {
    id: 'la-ilaha-illallah-wahdahu-three-times',
    entry: 2,
    repeat: 3,
    arabic: words(AP(1), 0, 16),
    witnesses: [words(BP(2), 0, 16), words(H('muslim', 1338), 40, 56), words(H('bukhari', 6473), 52, 68)],
    // Al-Bukhari's text spells "wa huwa" as "wa hwa", with a sukun on the ha.
    knownWitnessConflicts: { 'hadith:bukhari:6473[52-68]': 1 },
    ...TAHLIL,
    reference: {
      en: `${BUKHARI_844}. The three times are an addition from al-Bukhari (no. 6473), which the book prints between square brackets`,
      ar: [apNote(0, 2)],
    },
  },
  {
    id: 'allahumma-la-mania-lima-atayt',
    entry: 2,
    repeat: 1,
    arabic: words(AP(1), 17, 31),
    witnesses: [words(BP(2), 18, 32), words(H('muslim', 1338), 57, 71), words(H('bukhari', 844), 59, 73)],
    transliteration:
      'Allāhumma lā māniʿa limā aʿṭayt, wa lā muʿṭiya limā manaʿt, wa lā yanfaʿu dhal-jaddi minkal-jadd.',
    translation:
      'O Allah, none can withhold what You give, and none can give what You withhold, and no fortune avails its owner anything against You.',
    reference: { en: BUKHARI_844, ar: [apNote(0, 2, { segments: [0, 1, 2, 3, 4, 5] })] },
  },
  {
    id: 'la-ilaha-illallah-wa-la-nabudu-illa-iyyah',
    entry: 3,
    repeat: 1,
    arabic: AP(2),
    witnesses: [BP(3), words(H('muslim', 1343), 26, 73)],
    transliteration:
      'Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamdu wa huwa ʿalā kulli shayʾin qadīr, lā ḥawla wa lā quwwata illā billāh, lā ilāha illallāh, wa lā naʿbudu illā iyyāh, lahun-niʿmatu wa lahul-faḍl, wa lahuth-thanāʾul-ḥasan, lā ilāha illallāhu mukhliṣīna lahud-dīna wa law karihal-kāfirūn.',
    translation:
      'There is no god but Allah, alone, without partner. To Him belongs the dominion and to Him belongs all praise, and He has power over all things. There is no might and no power except by Allah. There is no god but Allah, and we worship none but Him. His is all blessing and His is all bounty, and to Him belongs beautiful praise. There is no god but Allah; we devote our religion to Him alone, however much the disbelievers may hate it.',
    // The book leaves out the comma it prints everywhere else between the page and "no.".
    reference: { en: 'Muslim 1/415 (no. 594)', ar: [apNote(0, 3, { commaAfter: ['1/415'] })] },
  },
  {
    id: 'subhanallah',
    entry: 4,
    repeat: 33,
    arabic: words(A('sleep', 7), 0, 1),
    // Muslim 2137, "the words dearest to Allah are four", names the formulas one by one.
    witnesses: [words(BP(4), 0, 1), words(AP(3), 0, 1), words(H('muslim', 5601), 36, 37)],
    // asellam's after-prayer entry gives the name of Allah a damma here; it is the genitive of
    // "subhana", with a kasra, in the book, in asellam's own sleep chapter and everywhere else.
    knownWitnessConflicts: { 'asellam:after-prayer:3[0-1]': 1 },
    transliteration: 'Subḥānallāh.',
    translation: 'Glory be to Allah.',
    reference: MUSLIM_597,
  },
  {
    id: 'alhamdulillah',
    entry: 4,
    repeat: 33,
    arabic: words(A('sleep', 8), 0, 1),
    witnesses: [words(BP(4), 2, 3), words(AP(3), 2, 3), words(H('muslim', 5601), 38, 39)],
    // The book's list joins it to the formula before it with "and".
    knownWordDifferences: {
      'book:after-prayer:4[2-3]': 1,
      'asellam:after-prayer:3[2-3]': 1,
      'hadith:muslim:5601[38-39]': 1,
    },
    transliteration: 'Al-ḥamdu lillāh.',
    translation: 'All praise is due to Allah.',
    reference: MUSLIM_597,
  },
  {
    id: 'allahu-akbar',
    entry: 4,
    repeat: 33,
    arabic: words(A('sleep', 9), 0, 1),
    witnesses: [words(BP(4), 4, 5), words(AP(3), 4, 5), words(H('muslim', 5601), 44, 45)],
    knownWordDifferences: {
      'book:after-prayer:4[4-5]': 1,
      'asellam:after-prayer:3[4-5]': 1,
      'hadith:muslim:5601[44-45]': 1,
    },
    transliteration: 'Allāhu akbar.',
    translation: 'Allah is the Greatest.',
    reference: MUSLIM_597,
  },
  {
    id: 'la-ilaha-illallah-wahdahu-to-complete-a-hundred',
    entry: 4,
    repeat: 1,
    arabic: words(AP(3), 9, 25),
    witnesses: [words(BP(4), 8, 24), words(H('muslim', 1352), 67, 83)],
    ...TAHLIL,
    // The virtue is that of the whole entry: the thirty-three of each and this tahlil after them.
    virtue: {
      en: 'Whoever says all of this after every prayer has their sins forgiven, even if they are like the foam of the sea.',
      ar: [apNote(0, 4, { after: '((', unquote: true })],
    },
    reference: MUSLIM_597,
  },
  {
    id: 'after-prayer-al-ikhlas-al-falaq-an-nas',
    entry: 5,
    // "After every prayer", once. The three times of the morning and evening come from another
    // hadith (Abu Dawud 5082), which those sessions recite.
    repeat: 1,
    // The same text as the morning and evening item: each complete surah after the basmala.
    arabic: {
      from: 'quran',
      basmala: true,
      passages: [
        { surah: 112, from: 1, to: 4 },
        { surah: 113, from: 1, to: 5 },
        { surah: 114, from: 1, to: 6 },
      ],
    },
    witnesses: [],
    countWitnesses: [AP(4)],
    ...QULS,
    // English only: no source words this remark in Arabic, and it may quote no number.
    note: {
      en: "The hadiths cited here say \"after every prayer\" and give no number, as the edition of the book used here does. Some editions add three times after Fajr and Maghrib, taken from the morning and evening hadith of 'Abdullah ibn Khubayb.",
      enOnly: true,
    },
    // The book prints an-Nasa'i no. 1335; that number is Ibn Abbas's hadith on the takbir that
    // ends the prayer, and Uqbah's hadith on the mu'awwidhat after every prayer is no. 1336
    // (both read in the open hadith API).
    reference: {
      en: "Qur'an, Surahs al-Ikhlas, al-Falaq and an-Nas. Abu Dawud 2/86 (no. 1523); at-Tirmidhi (no. 2903); an-Nasa'i 3/68 (no. 1336); see also Sahih at-Tirmidhi 2/8. The three surahs are called al-Mu'awwidhat; see Fath al-Bari 9/62",
      ar: [
        list(surahName(112), surahName(113), surahName(114)),
        apNote(1, 1, { sentence: 0, amend: [['1335', '1336']] }),
        apNote(1, 1, { sentence: 1 }),
        apNote(1, 1, { sentence: 2 }),
      ],
    },
  },
  {
    id: 'after-prayer-ayat-al-kursi',
    entry: 6,
    repeat: 1,
    // The book's digital text lost this entry; asellam's typing of it opens with the isti'adha,
    // as the morning and evening item does, and the same line of asellam is used.
    arabic: { from: 'quran', prefix: { ...AP(5), line: 0 }, passages: [{ surah: 2, from: 255, to: 255 }] },
    witnesses: [],
    countWitnesses: [AP(5)],
    ...AYAT_AL_KURSI,
    virtue: {
      en: 'Whoever recites it after every prayer, nothing stands between them and entering Paradise but death.',
      ar: [apNote(1, 2, { sentence: 0 })],
    },
    reference: {
      en: "An-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 100); Ibn as-Sunni (no. 121); graded authentic by al-Albani in Sahih al-Jami' 5/339 and as-Silsilah as-Sahihah 2/697 (no. 972). The ayah is no. 255 of Surah al-Baqarah",
      // The book prints a stray comma between "no." and Ibn as-Sunni's number; the two are rejoined.
      ar: [apNote(1, 2, { sentence: 1, segments: [0, 1, 2, [3, 4], 5, 6, 7, 8, 9, 10] })],
    },
  },
  {
    id: 'la-ilaha-illallah-yuhyi-wa-yumit-ten-times',
    entry: 7,
    repeat: 10,
    arabic: words(AP(6), 0, 18),
    countWitnesses: [AP(6)],
    witnesses: [BP(7), words(H('tirmidhi', 3474), 53, 71)],
    // The condition at-Tirmidhi's narration sets, in its own words: "after the Fajr prayer, while
    // he still sits with his legs folded, before he speaks".
    note: {
      en: 'After the Fajr prayer, while still sitting with the legs folded as in the prayer, before speaking: the condition in at-Tirmidhi\'s narration.',
      ar: [hadithText('tirmidhi', 3474, { words: [43, 52] })],
    },
    transliteration:
      'Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamd, yuḥyī wa yumītu wa huwa ʿalā kulli shayʾin qadīr.',
    translation:
      'There is no god but Allah, alone, without partner. To Him belongs the dominion and to Him belongs all praise. He gives life and causes death, and He has power over all things.',
    // At-Tirmidhi's narration 3474 names the Fajr prayer; Ahmad's, which the book cites with it,
    // names the Maghrib and the Subh prayer, as the book does. At-Tirmidhi 3534 (Umarah ibn Shabib,
    // read in the open hadith API) names the Maghrib prayer; the book does not cite it, so it is
    // written with the book's phrase "and at-Tirmidhi, no." of the three surahs, with its number.
    reference: {
      // At-Tirmidhi's own verdict is in the pinned text of the hadith; the open hadith API records
      // Ahmad Shakir and al-Albani grading its chain weak and Bashar Awwad Ma'ruf hasan sahih.
      en: "At-Tirmidhi 5/515 (no. 3474), after the Fajr prayer, who called it hasan, gharib and sahih, though later scholars differ on its chain; Ahmad 4/227 (no. 17990), after the Maghrib and the Subh prayer; see its takhrij in Zad al-Ma'ad 1/300. After the Maghrib prayer: at-Tirmidhi (no. 3534), who called it hasan gharib",
      ar: [
        apNote(1, 2, { occurrence: 1 }),
        apNote(1, 1, { sentence: 0, segments: [3, 4], citeAs: [['2903', '3534']] }),
      ],
    },
  },
]

/** The book's order. The supplication after Fajr is the morning item, re-used. */
export const AFTER_PRAYER = [
  { id: 'astaghfirullah' },
  { id: 'allahumma-antas-salam' },
  { id: 'la-ilaha-illallah-wahdahu-three-times' },
  { id: 'allahumma-la-mania-lima-atayt' },
  { id: 'la-ilaha-illallah-wa-la-nabudu-illa-iyyah' },
  { id: 'subhanallah' },
  { id: 'alhamdulillah' },
  { id: 'allahu-akbar' },
  { id: 'la-ilaha-illallah-wahdahu-to-complete-a-hundred' },
  {
    id: 'after-prayer-al-ikhlas-al-falaq-an-nas',
    // The book's entry ends with "after every prayer", three words that are not recited.
    sameWordsAs: [AP(4), BP(5)],
    knownWordDifferences: { 'book:after-prayer:5': 3 },
  },
  {
    id: 'after-prayer-ayat-al-kursi',
    // asellam seats the hamza of "ya'uduhu" on a waw; Tanzil's Simple text seats it on a ya.
    sameWordsAs: [AP(5)],
    knownWordDifferences: { 'asellam:after-prayer:5': 1 },
  },
  { id: 'la-ilaha-illallah-yuhyi-wa-yumit-ten-times', prayers: ['fajr', 'maghrib'] },
  {
    // The morning item, whose reference (Ibn as-Sunni 54 for the morning, Ibn Majah 925 for the
    // salam of the Subh prayer) covers this use too. The after-prayer footnote adds an-Nasa'i's
    // 'Amal al-Yawm wal-Laylah no. 102 and two secondary works; they are not repeated here.
    id: 'allahumma-inni-asaluka-ilman-nafian',
    entry: 8,
    prayers: ['fajr'],
    sameWordsAs: [words(AP(7), 0, 8), BP(8)],
  },
]
