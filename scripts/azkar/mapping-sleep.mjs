// The azkar before sleep: the chapter "Adhkar of sleep" of Hisn al-Muslim (nos. 99 to 111 of the
// book), in the book's order. As in mapping.mjs, this file holds no Arabic: it names the pinned
// records build.mjs copies from and holds every English field. The selectors are those of
// lib/selectors.mjs.
//
// What the chapter asks for is recited as it is asked for:
//   entry 1    the three surahs, recited into the joined palms, which are then passed over the
//              body; the whole done three times. The Qur'an comes from Tanzil, and the actions,
//              which are not recited, are the item's note (asellam's lines, the book's count).
//   entry 8    subhanallah 33, alhamdulillah 33, Allahu akbar 34: three items, each its own count,
//              which asellam already types as three records.
//   entry 12   Surah as-Sajdah and Surah al-Mulk, recited whole: two items, one per surah, the
//              Arabic from Tanzil and an English rendering and transliteration written for this
//              project, one per line of the Arabic (mapping-sleep-surahs.mjs).
//   entry 11   is the dhikr "Allahumma 'alimal-ghayb" of the morning and evening, word for word
//              (at-Tirmidhi 3392 and Abu Dawud 5067, which the item cites, add "and when you go
//              to your bed"), so that item is re-used.
// Actions that frame a dhikr (dusting the bed, the hand under the cheek, ablution before lying on
// the right side) are the item's note, quoted from the book's footnote.
//
// The digital text of the book scrambles entry 1 and lost the footnote of entry 2 (Ayat
// al-Kursi); asellam's copy of that footnote gives its virtue and its volume and page. Where the
// two typings of the book differ in a word, the pinned hadith decides (see each item).

import { AYAT_AL_KURSI, QULS } from './mapping.mjs'
import {
  A,
  B,
  H,
  annotation,
  asellamLine,
  asellamNote,
  fill,
  hadithText,
  list,
  note,
  reorder,
  respell,
  surahName,
  words,
} from './lib/selectors.mjs'

const CHAPTER = 'sleep'
const AS = (index) => A(CHAPTER, index)
const BS = (entry) => B(entry, CHAPTER)
const sleepNote = (page, number, options = {}) => note(page, number, { chapter: CHAPTER, ...options })

/** "Surah al-Baqarah, ayah 255": the book's own citation of the ayah, in the morning chapter. */
const AYAH_255 = note(0, 2, { sentence: 0 })

/** "And at-Tirmidhi, no. 3398": the book's phrase, given another number to cite another hadith. */
const tirmidhiAs = (number) => sleepNote(3, 3, { segments: [3, 4], citeAs: [['3398', number]] })

/** Al-Bukhari 3705 and Muslim 2727, the narration of the thirty-three and thirty-four. */
const TASBIH_REFERENCE = {
  en: 'Al-Bukhari, with Fath al-Bari 7/71 (no. 3705); Muslim 4/2091 (no. 2727)',
  // The book prints Muslim no. 2726, which is Juwayriyah's "subhanallahi wa bihamdihi 'adada
  // khalqihi" (4/2090), cited as such by the morning item. The hadith of Ali and Fatimah on page
  // 4/2091 is no. 2727 (read in the open hadith API, where it is 2727.01).
  ar: [sleepNote(4, 1, { sentence: 1, amend: [['2726', '2727']] })],
}

export const SLEEP_ITEMS = [
  {
    id: 'sleep-al-ikhlas-al-falaq-an-nas',
    entry: 1,
    repeat: 3,
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
    countWitnesses: [AS(0)],
    ...QULS,
    note: {
      en: 'Put the palms together, blow lightly into them and recite into them. Then wipe with them as much of the body as you can, beginning with the head, the face and the front of the body. Do this three times.',
      ar: [asellamLine(CHAPTER, 0, 0, { unquote: true }), asellamLine(CHAPTER, 0, 7), annotation(1, 0, CHAPTER)],
    },
    reference: {
      // Al-Bukhari 5017 is the bedtime practice; Muslim 2192 (Aishah, read in the open hadith API)
      // is the Prophet reciting the mu'awwidhat over himself, and blowing, when he was ill.
      en: "Qur'an, Surahs al-Ikhlas, al-Falaq and an-Nas. Al-Bukhari, with Fath al-Bari 9/62 (no. 5017), on doing this at bedtime; Muslim (no. 2192), on reciting them over oneself when ill",
      ar: [list(surahName(112), surahName(113), surahName(114)), sleepNote(0, 1)],
    },
  },
  {
    id: 'sleep-ayat-al-kursi',
    entry: 2,
    repeat: 1,
    // asellam's typing of the entry opens with the isti'adha, as the morning and evening one does.
    arabic: { from: 'quran', prefix: { ...AS(1), line: 0 }, passages: [{ surah: 2, from: 255, to: 255 }] },
    witnesses: [],
    countWitnesses: [AS(1)],
    ...AYAT_AL_KURSI,
    // The book's digital text has an empty footnote here. asellam's copy of it gives the virtue and
    // "al-Bukhari with al-Fath 4/487", without the hadith's number; the citation re-uses the book's
    // phrase for al-Bukhari with that volume and page and the number, 2311 (read in the open
    // hadith API: Abu Hurayrah and the one who came to take from the zakat of Ramadan). Al-Bukhari
    // gives that report mu'allaq: it opens "and Uthman ibn al-Haytham said", not with a chain of
    // al-Bukhari's own, and the reference says so.
    virtue: {
      en: 'Whoever recites it on going to bed remains under the protection of a guardian from Allah, and no devil comes near them until morning.',
      ar: [asellamNote(CHAPTER, 1, { words: [0, 17] })],
    },
    reference: {
      en: "Qur'an, Surah al-Baqarah, ayah 255. Al-Bukhari, with Fath al-Bari 4/487 (no. 2311), a mu'allaq report, which al-Bukhari opens with \"'Uthman ibn al-Haytham said\" rather than with a chain of his own",
      ar: [
        AYAH_255,
        sleepNote(2, 3, {
          sentence: 0,
          citeAs: [
            ['11/126', '4/487'],
            ['6320', '2311'],
          ],
        }),
      ],
    },
  },
  {
    id: 'last-two-ayat-of-al-baqarah',
    entry: 3,
    repeat: 1,
    arabic: { from: 'quran', prefix: { ...AS(2), line: 0 }, passages: [{ surah: 2, from: 285, to: 286 }] },
    witnesses: [],
    countWitnesses: [AS(2)],
    // One part per line of the Arabic: the isti'adha, then each ayah.
    transliteration: [
      'Aʿūdhu billāhi minash-shayṭānir-rajīm.',
      'Āmanar-rasūlu bi-mā unzila ilayhi min rabbihi wal-muʾminūn, kullun āmana billāhi wa malāʾikatihi wa kutubihi wa rusulih, lā nufarriqu bayna aḥadin min rusulih, wa qālū samiʿnā wa aṭaʿnā, ghufrānaka rabbanā wa ilaykal-maṣīr.',
      'Lā yukallifullāhu nafsan illā wusʿahā, lahā mā kasabat wa ʿalayhā maktasabat, rabbanā lā tuʾākhidhnā in nasīnā aw akhṭaʾnā, rabbanā wa lā taḥmil ʿalaynā iṣran kamā ḥamaltahu ʿalal-ladhīna min qablinā, rabbanā wa lā tuḥammilnā mā lā ṭāqata lanā bih, waʿfu ʿannā waghfir lanā warḥamnā, anta mawlānā fanṣurnā ʿalal-qawmil-kāfirīn.',
    ],
    translation: [
      'I seek refuge in Allah from the accursed Satan.',
      'The Messenger believes in what has been sent down to him from his Lord, and so do the believers. Each of them believes in Allah, His angels, His Books and His messengers: we make no distinction between any of His messengers. And they say: We hear and we obey; we ask Your forgiveness, our Lord, and to You is the return.',
      'Allah lays on no soul a burden beyond what it can bear. In its favour is the good it has earned, and against it the evil it has brought upon itself. Our Lord, do not take us to task if we forget or fall into error. Our Lord, do not lay on us a burden like the one You laid on those before us. Our Lord, do not make us carry what we have no strength to bear. Pardon us, forgive us and have mercy on us. You are our Protector, so help us against the people who disbelieve.',
    ],
    virtue: { en: 'Whoever recites these two ayat at night, they suffice them.', ar: [sleepNote(2, 1, { segments: [0] })] },
    // The book gives the volume and page of the narration in the book of the virtues of the
    // Qur'an (9/94) with the number of the same hadith in the book of the campaigns (4008); the
    // hadith under that number was read in the open hadith API, so the print is kept.
    reference: {
      en: 'Al-Bukhari, with Fath al-Bari 9/94 (no. 4008); Muslim 1/554 (no. 807). The two ayat are 285 and 286 of Surah al-Baqarah',
      ar: [sleepNote(2, 1, { segments: [1, 2, 3, 4, 5, 6, 7, 8] })],
    },
  },
  {
    id: 'bismika-rabbi-wadatu-janbi',
    entry: 4,
    repeat: 1,
    // The book's text, whose "fa-in amsakta" is the wording of at-Tirmidhi 3401; asellam types
    // "in amsakta", as al-Bukhari 6320 has it (al-Bukhari also has "rabbi" without the final ya).
    // Two words lack a mark the same word has in at-Tirmidhi and in asellam.
    arabic: { ...BS(4), patches: [fill(6, H('tirmidhi', 3401), 57), fill(9, AS(3))] },
    witnesses: [AS(3), words(H('tirmidhi', 3401), 51, 68), words(H('bukhari', 6320), 47, 64)],
    knownWordDifferences: { 'asellam:sleep:3': 1, 'hadith:bukhari:6320[47-64]': 2 },
    transliteration:
      'Bismika rabbī waḍaʿtu janbī, wa bika arfaʿuh, fa-in amsakta nafsī farḥamhā, wa in arsaltahā faḥfaẓhā, bi-mā taḥfaẓu bihi ʿibādakaṣ-ṣāliḥīn.',
    translation:
      'In Your name, my Lord, I lay down my side, and by You I raise it up. If You take my soul, have mercy on it, and if You send it back, protect it with that by which You protect Your righteous servants.',
    // The book's footnote quotes the hadith as at-Tirmidhi words it (getting up from the bed and
    // coming back to it), with "and let him say the name of Allah" from Muslim's. Al-Bukhari 6320
    // and Muslim 2714 say it of going to bed at all. The note quotes each in its own words, from the
    // pinned hadiths: al-Bukhari's, then at-Tirmidhi's; Muslim's wording is like al-Bukhari's.
    note: {
      en: "Al-Bukhari's narration, and Muslim's in like words: when one of you goes to bed, let him dust it off with the inside of his waist-wrap, for he does not know what came onto it after him, then say this. At-Tirmidhi's: when one of you gets up from his bed and then comes back to it, let him dust it off three times with the edge of his waist-wrap, for he does not know what came onto it after him, and when he lies down, let him say this.",
      ar: [
        hadithText('bukhari', 6320, { words: [30, 46], label: sleepNote(2, 3, { words: [0, 0] }) }),
        hadithText('tirmidhi', 3401, { words: [28, 50], label: note(1, 2, { chapter: 'after-prayer', occurrence: 1, words: [1, 1] }) }),
      ],
    },
    reference: {
      en: 'Al-Bukhari, with Fath al-Bari 11/126 (no. 6320); Muslim 4/2084 (no. 2714). With the wording recited here: at-Tirmidhi (no. 3401)',
      ar: [
        sleepNote(2, 3, { sentence: 0 }),
        list(sleepNote(2, 3, { sentence: 1 }), sleepNote(3, 3, { segments: [3, 4], citeAs: [['3398', '3401']] })),
      ],
    },
  },
  {
    id: 'allahumma-innaka-khalaqta-nafsi',
    entry: 5,
    repeat: 1,
    arabic: AS(4),
    witnesses: [BS(5), words(H('muslim', 6888), 36, 54)],
    // Muslim's wording opens "Allahumma khalaqta"; "innaka" is Ahmad's, whose wording the book follows.
    knownWordDifferences: { 'hadith:muslim:6888[36-54]': 1 },
    transliteration:
      'Allāhumma innaka khalaqta nafsī wa anta tawaffāhā, laka mamātuhā wa maḥyāhā, in aḥyaytahā faḥfaẓhā, wa in amattahā faghfir lahā, Allāhumma innī asʾalukal-ʿāfiyah.',
    translation:
      'O Allah, You created my soul and You take it in death. Its death and its life belong to You. If You keep it alive, protect it, and if You cause it to die, forgive it. O Allah, I ask You for well-being.',
    reference: { en: 'Muslim 4/2083 (no. 2712); Ahmad, with this wording, 2/79 (no. 5502)', ar: [sleepNote(3, 1)] },
  },
  {
    id: 'allahumma-qini-adhabaka',
    entry: 6,
    // Three times: asellam's count, and the wording of Abu Dawud 5045, which the book cites as its
    // own wording ("bi-lafzih") and which ends "three times".
    repeat: 3,
    arabic: AS(5),
    witnesses: [BS(6), words(H('abudawud', 5045), 42, 47)],
    transliteration: 'Allāhumma qinī ʿadhābaka yawma tabʿathu ʿibādak.',
    translation: 'O Allah, shield me from Your punishment on the Day You raise up Your servants.',
    note: {
      en: "When he, may Allah's blessings and peace be upon him, wanted to sleep, he would put his right hand under his cheek and then say this.",
      ar: [sleepNote(3, 2, { sentence: 0, unquote: true })],
    },
    reference: {
      en: 'Abu Dawud, with this wording, which has it three times, 4/311 (no. 5045); at-Tirmidhi (no. 3398); see also Sahih at-Tirmidhi 3/143 and Sahih Abi Dawud 3/240',
      ar: [sleepNote(3, 3)],
    },
  },
  {
    id: 'bismika-allahumma-amutu-wa-ahya',
    entry: 7,
    repeat: 1,
    arabic: AS(6),
    witnesses: [BS(7), words(H('bukhari', 6324), 29, 32)],
    transliteration: 'Bismikallāhumma amūtu wa aḥyā.',
    translation: 'In Your name, O Allah, I die and I live.',
    reference: { en: 'Al-Bukhari, with Fath al-Bari 11/113 (no. 6324); Muslim 4/2083 (no. 2711)', ar: [sleepNote(3, 4)] },
  },
  {
    id: 'sleep-subhanallah',
    entry: 8,
    repeat: 33,
    arabic: AS(7),
    // Muslim 2137, "the words dearest to Allah are four", names the formulas one by one.
    witnesses: [words(BS(8), 0, 1), words(H('muslim', 5601), 36, 37)],
    transliteration: 'Subḥānallāh.',
    translation: 'Glory be to Allah.',
    reference: TASBIH_REFERENCE,
  },
  {
    id: 'sleep-alhamdulillah',
    entry: 8,
    repeat: 33,
    arabic: AS(8),
    witnesses: [words(BS(8), 4, 5), words(H('muslim', 5601), 38, 39)],
    // The book's list joins it to the formula before it with "and".
    knownWordDifferences: { 'book:sleep:8[4-5]': 1, 'hadith:muslim:5601[38-39]': 1 },
    transliteration: 'Al-ḥamdu lillāh.',
    translation: 'All praise is due to Allah.',
    reference: TASBIH_REFERENCE,
  },
  {
    id: 'sleep-allahu-akbar',
    entry: 8,
    repeat: 34,
    arabic: AS(9),
    witnesses: [words(BS(8), 8, 9), words(H('muslim', 5601), 44, 45)],
    knownWordDifferences: { 'book:sleep:8[8-9]': 1, 'hadith:muslim:5601[44-45]': 1 },
    transliteration: 'Allāhu akbar.',
    translation: 'Allah is the Greatest.',
    // The virtue is that of the whole entry: the thirty-three, thirty-three and thirty-four.
    virtue: {
      en: 'Whoever says all of this on going to bed, it is better for them than a servant.',
      ar: [sleepNote(4, 1, { sentence: 0 })],
    },
    reference: TASBIH_REFERENCE,
  },
  {
    id: 'allahumma-rabbas-samawatis-sab',
    entry: 9,
    repeat: 1,
    // The book's text: asellam's typing of this entry has three wrong marks ("kulla" for "kulli",
    // a kasra on the lam of "al-injil", and "waghnina" for "wa aghnina"), where the book and
    // Muslim 2713 agree. "As-samawati" is written out with its alef, as in the morning item.
    arabic: { ...BS(9), patches: [respell(2, A('morning', 1), 20)] },
    witnesses: [AS(10), words(H('muslim', 6889), 26, 80)],
    knownWitnessConflicts: { 'asellam:sleep:10': 2 },
    // The narration of Muslim 2713 whose words are compared (Suhayl's, API sequence 6889) has
    // "rabbas-samawati" without "as-sab'"; it and asellam spell "as-samawati" without the alef.
    knownWordDifferences: { 'asellam:sleep:10': 1, 'hadith:muslim:6889[26-80]': 2 },
    transliteration:
      'Allāhumma rabbas-samāwātis-sabʿi wa rabbal-arḍ, wa rabbal-ʿarshil-ʿaẓīm, rabbanā wa rabba kulli shayʾ, fāliqal-ḥabbi wan-nawā, wa munzilat-tawrāti wal-injīl, wal-furqān, aʿūdhu bika min sharri kulli shayʾin anta ākhidhun bi-nāṣiyatih. Allāhumma antal-awwalu fa-laysa qablaka shayʾ, wa antal-ākhiru fa-laysa baʿdaka shayʾ, wa antaẓ-ẓāhiru fa-laysa fawqaka shayʾ, wa antal-bāṭinu fa-laysa dūnaka shayʾ, iqḍi ʿannad-dayna wa aghninā minal-faqr.',
    translation:
      'O Allah, Lord of the seven heavens and Lord of the earth, Lord of the mighty Throne, our Lord and the Lord of all things, who splits open the grain and the date-stone, who sent down the Torah, the Gospel and the Criterion: I seek refuge in You from the evil of everything whose forelock You hold. O Allah, You are the First, and there is nothing before You; You are the Last, and there is nothing after You; You are the Manifest, and there is nothing above You; You are the Hidden, and there is nothing beyond You. Settle our debts for us and free us from poverty.',
    // "As-sab'" (seven) is in the wording of every copy of the book; in Muslim 2713 it is in the
    // narration of Fatimah through al-A'mash that Muslim gives after Suhayl's (API sequence 6891),
    // and it is in at-Tirmidhi 3481 and Ibn Majah 3831 (all read in the open hadith API).
    // At-Tirmidhi is cited with the book's phrase "and at-Tirmidhi, no." and that number.
    reference: {
      en: 'Muslim 4/2084 (no. 2713); "seven" is in the narration of Fatimah via al-A\'mash there, and in at-Tirmidhi (no. 3481)',
      ar: [list(sleepNote(4, 2), tirmidhiAs('3481'))],
    },
  },
  {
    id: 'alhamdu-lillahil-ladhi-atamana',
    entry: 10,
    repeat: 1,
    // asellam types "alladhi" without the shadda of its lam, and leaves the last ya of "mu'wiya"
    // bare; both words are taken from the book.
    arabic: { ...AS(11), patches: [fill(2, BS(10)), fill(13, BS(10))] },
    witnesses: [BS(10), words(H('muslim', 6894), 32, 45)],
    // Muslim's text spells "mu'wiya" with the hamza on a ya seat.
    knownWordDifferences: { 'hadith:muslim:6894[32-45]': 1 },
    transliteration:
      'Al-ḥamdu lillāhil-ladhī aṭʿamanā wa saqānā wa kafānā wa āwānā fa-kam mimman lā kāfiya lahu wa lā muʾwī.',
    translation:
      'All praise is due to Allah, who has fed us and given us drink, who has sufficed us and sheltered us; for how many there are who have no one to suffice them and no one to shelter them.',
    reference: { en: 'Muslim 4/2085 (no. 2715)', ar: [sleepNote(5, 1)] },
  },
  {
    id: 'allahumma-aslamtu-nafsi-ilayk',
    entry: 13,
    repeat: 1,
    // asellam has "rahbatan wa raghbatan"; the book, al-Bukhari 6313 and Muslim 2710 have
    // "raghbatan wa rahbatan", so the two words are put in that order. asellam also types
    // "alladhi" twice without the shadda of its lam; both are taken from the book.
    arabic: {
      ...AS(14),
      patches: [
        reorder(13, BS(13), 13, [BS(13), words(H('bukhari', 6313), 51, 80)]),
        fill(25, BS(13)),
        fill(28, BS(13)),
      ],
    },
    witnesses: [BS(13), words(H('bukhari', 6313), 51, 80)],
    transliteration:
      'Allāhumma aslamtu nafsī ilayk, wa fawwaḍtu amrī ilayk, wa wajjahtu wajhī ilayk, wa aljaʾtu ẓahrī ilayk, raghbatan wa rahbatan ilayk, lā maljaʾa wa lā manjā minka illā ilayk, āmantu bi-kitābikal-ladhī anzalta wa bi-nabiyyikal-ladhī arsalt.',
    translation:
      'O Allah, I have surrendered myself to You, entrusted my affairs to You, turned my face to You and made You the support of my back, out of longing for You and fear of You. There is no refuge and no escape from You except to You. I believe in Your Book which You sent down and in Your Prophet whom You sent.',
    note: {
      en: 'When you go to your bed, perform ablution as you do for prayer, then lie down on your right side and say this.',
      ar: [sleepNote(5, 4, { sentence: 0, unquote: true })],
    },
    virtue: {
      en: 'If you die, you die upon the fitrah, the natural way of Islam.',
      ar: [sleepNote(5, 5, { sentence: 0, after: '((', unquote: true })],
    },
    // The book prints Muslim's volume and page as "4, 2081"; they are joined as everywhere else.
    reference: {
      en: 'Al-Bukhari, with Fath al-Bari 11/113 (no. 6313); Muslim 4/2081 (no. 2710)',
      ar: [sleepNote(5, 5, { sentence: 1, volumeSlash: [['4', '2081']] })],
    },
  },
]

/** The book's order. Entry 11 is the morning and evening item "Allahumma 'alimal-ghayb". */
export const SLEEP = [
  { id: 'sleep-al-ikhlas-al-falaq-an-nas' },
  { id: 'sleep-ayat-al-kursi' },
  { id: 'last-two-ayat-of-al-baqarah' },
  { id: 'bismika-rabbi-wadatu-janbi' },
  { id: 'allahumma-innaka-khalaqta-nafsi' },
  { id: 'allahumma-qini-adhabaka' },
  { id: 'bismika-allahumma-amutu-wa-ahya' },
  { id: 'sleep-subhanallah' },
  { id: 'sleep-alhamdulillah' },
  { id: 'sleep-allahu-akbar' },
  { id: 'allahumma-rabbas-samawatis-sab' },
  { id: 'alhamdu-lillahil-ladhi-atamana' },
  {
    id: 'allahumma-alim-al-ghayb-wash-shahadah',
    entry: 11,
    // The footnote cites "at-Tirmidhi no. 3629", a misprint: 3629 is an unrelated hadith, and the
    // narration that adds "and when you go to your bed" is at-Tirmidhi 3392, which the item cites.
    // Both typings write "as-samawati" without the alef the item's word has.
    sameWordsAs: [BS(11), AS(12)],
    knownWordDifferences: { 'book:sleep:11': 1, 'asellam:sleep:12': 1 },
    // asellam's sleep chapter reads "wa sharakihi" here; the book's reads "wa shirkihi", as the item does.
    knownWitnessConflicts: { 'asellam:sleep:12': 2 },
  },
  { id: 'surah-as-sajdah' },
  { id: 'surah-al-mulk' },
  { id: 'allahumma-aslamtu-nafsi-ilayk' },
]
