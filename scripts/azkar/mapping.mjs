// The hand-written half of the adhkar dataset.
//
// This file decides WHICH source record feeds each item and holds every English field. It contains
// no Arabic at all: build.mjs copies the Arabic from the pinned files in raw/ by following the
// selectors below, so no Arabic character is ever typed or recalled by hand.
//
// The reference set is the chapter "Adhkar of the morning and the evening" of Hisn al-Muslim by
// Sa'id ibn Ali ibn Wahf al-Qahtani: 24 numbered entries (nos. 75 to 98 of the book), kept in the
// book's order. `entry` is the entry's number inside the chapter, 1 to 24. Entries whose wording
// differs between morning and evening become two items, each taken from text that spells that
// wording out in full.
//
// Selectors (constructed by lib/selectors.mjs, which lists them all)
//   A(chapter, index)   asellam/HisnElMuslim, entry `index` of its morning or evening chapter
//   S(order)            Seen-Arabic adhkar DB, the row with that `order`
//   B(entry)            the book's own text of that entry (used as a witness only)
//   MUSLIM_2723         Sahih Muslim 2723, the quoted passages of the hadith joined in order
//   note(page, n, ...)  footnote n under page `page` of the book chapter, optionally narrowed to
//                       one sentence (split on ".") and to chosen comma-separated segments
//   list(...)           pieces joined with a comma instead of a full stop
//   surahName(n)        the name of surah n as the Qur'an API gives it, vowel marks removed
//
// Recited text. All 28 supplications are asellam's typing, so one spelling convention runs through
// the whole reader. Six words are replaced by the same word of another pinned record; build.mjs
// checks each replacement before applying it (see the header of build.mjs):
//   fill(word, from)                  the word lacked a mark that `from` has        (3 words)
//   revowel(word, from, confirmedBy)  a wrong vowel, corrected and doubly confirmed (2 words)
//   respell(word, from, fromWord)     a long vowel written out with its alef        (1 word)
// `word` counts the whitespace-separated words of the record from 0.
//
// References. reference.ar is the takhrij of the book's footnote, kept whole apart from the book's
// cross-references to its own pages. Where a number printed in the book points at another hadith
// it is amended (`amend`, digits only) and the reason is given beside the item; every amendment
// was checked against the hadith itself. Where a hadith the book does not cite has to be cited,
// a phrase of the book that names the same collection is re-used with that hadith's number
// (`citeAs`, digits only). English remarks that explain a citation have no Arabic
// counterpart, because no Arabic is typed by hand: the two languages always quote the same numbers.
//
// Transliteration scheme: long vowels a-macron, i-macron, u-macron; emphatics with a dot below;
// U+02BF for ayn and U+02BE for hamza; th, dh, kh, sh, gh; the article assimilated and joined as
// it is recited ("ash-shaytan", "wal-hamdu"); pausal endings at commas and full stops.

import {
  A,
  B,
  MUSLIM_2723,
  S,
  annotation,
  fill,
  list,
  note,
  remark,
  respell,
  revowel,
  seenSource,
  surahName,
} from './lib/selectors.mjs'

/** "and al-Bukhari in al-Adab al-Mufrad, no. 1199": the book's own phrase with another number. */
const ADAB_1199 = note(3, 2, { sentence: 1, segments: [3, 4], citeAs: [['1201', '1199']] })

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** 3: the after-prayer list, the sleep session and the tasbih presets were added. */
export const VERSION = 3

/**
 * Sessions whose order is given by the `in` field of the items below, in display order. The
 * sleep session lists its own order in mapping-sleep.mjs, as it re-uses one item of this file.
 */
export const COLLECTIONS = ['morning', 'evening']

const BOTH = ['morning', 'evening']
const MORNING = ['morning']
const EVENING = ['evening']

/** Ayat al-Kursi with the isti'adha before it, as the morning, evening and sleep azkar recite it. */
export const AYAT_AL_KURSI = {
  transliteration:
    'Aʿūdhu billāhi minash-shayṭānir-rajīm. Allāhu lā ilāha illā huwal-ḥayyul-qayyūm, lā taʾkhudhuhu sinatun wa lā nawm, lahu mā fis-samāwāti wa mā fil-arḍ, man dhal-ladhī yashfaʿu ʿindahu illā bi-idhnih, yaʿlamu mā bayna aydīhim wa mā khalfahum, wa lā yuḥīṭūna bi-shayʾin min ʿilmihi illā bi-mā shāʾ, wasiʿa kursiyyuhus-samāwāti wal-arḍ, wa lā yaʾūduhu ḥifẓuhumā, wa huwal-ʿaliyyul-ʿaẓīm.',
  translation:
    'I seek refuge in Allah from the accursed Satan. Allah: there is no god except Him, the Ever-Living, the Sustainer of all. Drowsiness does not come over Him, nor does sleep. All that is in the heavens and all that is on the earth is His. Who is there that can intercede before Him except by His leave? He knows what lies ahead of them and what lies behind them, while they grasp nothing of His knowledge beyond what He wills. His Kursi encompasses the heavens and the earth, and safeguarding them both is no burden to Him. He is the Most High, the Magnificent.',
}

/** Surahs 112 to 114, each after the basmala, as the morning, evening and sleep azkar recite them. */
export const QULS = {
  transliteration:
    'Bismillāhir-raḥmānir-raḥīm. Qul huwallāhu aḥad, Allāhuṣ-ṣamad, lam yalid wa lam yūlad, wa lam yakun lahu kufuwan aḥad. Bismillāhir-raḥmānir-raḥīm. Qul aʿūdhu bi-rabbil-falaq, min sharri mā khalaq, wa min sharri ghāsiqin idhā waqab, wa min sharrin-naffāthāti fil-ʿuqad, wa min sharri ḥāsidin idhā ḥasad. Bismillāhir-raḥmānir-raḥīm. Qul aʿūdhu bi-rabbin-nās, malikin-nās, ilāhin-nās, min sharril-waswāsil-khannās, alladhī yuwaswisu fī ṣudūrin-nās, minal-jinnati wan-nās.',
  translation:
    "In the name of Allah, the Most Gracious, the Most Merciful. Say: He is Allah, the One; Allah, the Self-Sufficient on whom all depend. He begot no one, nor was He begotten, and there is no one comparable to Him. In the name of Allah, the Most Gracious, the Most Merciful. Say: I seek refuge with the Lord of the dawn from the evil of whatever He has created, from the evil of the night's darkness when it sets in, from the evil of those who blow upon knots, and from the evil of an envious one when he envies. In the name of Allah, the Most Gracious, the Most Merciful. Say: I seek refuge with the Lord of humankind, the King of humankind, the God of humankind, from the evil of the retreating whisperer who whispers into the breasts of humankind, whether of the jinn or of humankind.",
}

/** The tahlil, as the morning, evening and after-prayer azkar recite it. */
export const TAHLIL = {
  transliteration:
    'Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamdu wa huwa ʿalā kulli shayʾin qadīr.',
  translation:
    'There is no god but Allah, alone, without partner. To Him belongs the dominion and to Him belongs all praise, and He has power over all things.',
}

const SALAWAT_AFTER_NAME = "may Allah's blessings and peace be upon him"

export const ITEMS = [
  {
    id: 'ayat-al-kursi',
    entry: 1,
    in: BOTH,
    repeat: 1,
    // The book opens the entry with the isti'adha, then the ayah. The ayah itself comes from Tanzil.
    arabic: {
      from: 'quran',
      prefix: { ...A('morning', 1), line: 0 },
      passages: [{ surah: 2, from: 255, to: 255 }],
    },
    witnesses: [],
    countWitnesses: [A('morning', 1), A('evening', 1), S(2)],
    ...AYAT_AL_KURSI,
    reference: {
      en: "Qur'an, Surah al-Baqarah, ayah 255. Al-Hakim 1/562; graded authentic by al-Albani in Sahih at-Targhib wat-Tarhib 1/273, who attributed it to an-Nasa'i and at-Tabarani and said that at-Tabarani's chain is good",
      ar: [note(0, 2, { sentence: 0 }), note(0, 2, { sentence: 2 })],
    },
    virtue: {
      en: 'Whoever says it in the morning is protected from the jinn until evening, and whoever says it in the evening is protected from them until morning.',
      ar: [note(0, 2, { sentence: 1 })],
    },
  },
  {
    id: 'al-ikhlas-al-falaq-an-nas',
    entry: 2,
    in: BOTH,
    repeat: 3,
    // Three complete surahs, so each is preceded by the basmala, as the book prints them.
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
    countWitnesses: [A('morning', 2), A('evening', 2), S(4), S(5), S(6)],
    ...QULS,
    // The reference opens with the names of the three surahs, as the Ayat al-Kursi reference
    // opens with its own citation; the reader shows no other label for them.
    reference: {
      en: "Qur'an, Surahs al-Ikhlas, al-Falaq and an-Nas. Abu Dawud 4/322 (no. 5082); at-Tirmidhi 5/567 (no. 3575); see also Sahih at-Tirmidhi 3/182",
      ar: [list(surahName(112), surahName(113), surahName(114)), note(0, 3, { sentence: 1 })],
    },
    virtue: {
      en: 'For whoever says them three times in the morning and in the evening, they suffice against everything.',
      ar: [note(0, 3, { sentence: 0 })],
    },
  },
  {
    id: 'morning-asbahna-wa-asbaha-al-mulk',
    entry: 3,
    in: MORNING,
    repeat: 1,
    arabic: A('morning', 3),
    witnesses: [B(3), S(7)],
    transliteration:
      'Aṣbaḥnā wa aṣbaḥal-mulku lillāh, wal-ḥamdu lillāh, lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamdu wa huwa ʿalā kulli shayʾin qadīr. Rabbi asʾaluka khayra mā fī hādhal-yawmi wa khayra mā baʿdah, wa aʿūdhu bika min sharri mā fī hādhal-yawmi wa sharri mā baʿdah. Rabbi aʿūdhu bika minal-kasali wa sūʾil-kibar. Rabbi aʿūdhu bika min ʿadhābin fin-nāri wa ʿadhābin fil-qabr.',
    translation:
      "We have entered the morning, and the dominion this morning is Allah's, and all praise is due to Allah. There is no god but Allah, alone, without partner. To Him belongs the dominion and to Him belongs all praise, and He has power over all things. My Lord, I ask You for the good of what is in this day and the good of what comes after it, and I seek refuge in You from the evil of what is in this day and the evil of what comes after it. My Lord, I seek refuge in You from laziness and from the ills of old age. My Lord, I seek refuge in You from torment in the Fire and torment in the grave.",
    reference: { en: 'Muslim 4/2088 (no. 2723)', ar: [note(1, 3, { sentence: 0 })] },
  },
  {
    id: 'evening-amsayna-wa-amsa-al-mulk',
    entry: 3,
    in: EVENING,
    repeat: 1,
    // asellam's evening entry, so that it is spelled and punctuated like its morning twin. Two of
    // its words carry a fatha where the word takes a kasra ("wa sharri", and the third "rabbi");
    // each is replaced by the same word of asellam's morning entry, whose vowels are those of
    // Sahih Muslim 2723, of the book and of Seen. The result is then required to have the same
    // words and not one differing vowel as the evening wording Sahih Muslim narrates in full
    // (the two quoted passages of the hadith, joined in order).
    arabic: {
      ...A('evening', 3),
      patches: [
        revowel(41, A('morning', 3), [MUSLIM_2723, B(3), S(7)]),
        revowel(51, A('morning', 3), [MUSLIM_2723, B(3), S(7)]),
      ],
    },
    agreesWith: [MUSLIM_2723],
    witnesses: [MUSLIM_2723, S(8), A('morning', 3), B(3)],
    transliteration:
      'Amsaynā wa amsal-mulku lillāh, wal-ḥamdu lillāh, lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamdu wa huwa ʿalā kulli shayʾin qadīr. Rabbi asʾaluka khayra mā fī hādhihil-laylati wa khayra mā baʿdahā, wa aʿūdhu bika min sharri mā fī hādhihil-laylati wa sharri mā baʿdahā. Rabbi aʿūdhu bika minal-kasali wa sūʾil-kibar. Rabbi aʿūdhu bika min ʿadhābin fin-nāri wa ʿadhābin fil-qabr.',
    translation:
      "We have entered the evening, and the dominion this evening is Allah's, and all praise is due to Allah. There is no god but Allah, alone, without partner. To Him belongs the dominion and to Him belongs all praise, and He has power over all things. My Lord, I ask You for the good of what is in this night and the good of what comes after it, and I seek refuge in You from the evil of what is in this night and the evil of what comes after it. My Lord, I seek refuge in You from laziness and from the ills of old age. My Lord, I seek refuge in You from torment in the Fire and torment in the grave.",
    reference: { en: 'Muslim 4/2088 (no. 2723)', ar: [note(1, 3, { sentence: 0 })] },
  },
  {
    id: 'morning-allahumma-bika-asbahna',
    entry: 4,
    in: MORNING,
    repeat: 1,
    arabic: A('morning', 4),
    witnesses: [B(4), S(9)],
    transliteration:
      'Allāhumma bika aṣbaḥnā, wa bika amsaynā, wa bika naḥyā, wa bika namūtu, wa ilaykan-nushūr.',
    translation:
      'O Allah, it is through You that we have reached the morning and through You that we reach the evening; through You we live and through You we die, and to You is the resurrection.',
    // The book cites at-Tirmidhi alone, yet in at-Tirmidhi 3391 the morning wording ends "wa ilaykal-
    // masir" and the evening one "wa ilaykan-nushur". The endings the book prints, and this app
    // recites, are those of al-Adab al-Mufrad 1199 (both), Abu Dawud 5068 (morning) and Ibn Majah
    // 3868 (evening), so those are cited too. All four were read in full.
    reference: {
      en: 'At-Tirmidhi 5/466 (no. 3391), whose narration has the two endings the other way round; see also Sahih at-Tirmidhi 3/142. With the ending recited here: al-Bukhari in al-Adab al-Mufrad (no. 1199); Abu Dawud (no. 5068)',
      ar: [
        note(2, 2, { sentence: 0 }),
        list(ADAB_1199, note(6, 1, { sentence: 0, segments: [2, 3], citeAs: [['5067', '5068']] })),
      ],
    },
  },
  {
    id: 'evening-allahumma-bika-amsayna',
    entry: 4,
    in: EVENING,
    repeat: 1,
    arabic: A('evening', 4),
    witnesses: [S(10), A('morning', 4)],
    transliteration:
      'Allāhumma bika amsaynā, wa bika aṣbaḥnā, wa bika naḥyā, wa bika namūtu, wa ilaykal-maṣīr.',
    translation:
      'O Allah, it is through You that we have reached the evening and through You that we reach the morning; through You we live and through You we die, and to You is the final return.',
    reference: {
      en: 'At-Tirmidhi 5/466 (no. 3391), whose narration has the two endings the other way round; see also Sahih at-Tirmidhi 3/142. With the ending recited here: al-Bukhari in al-Adab al-Mufrad (no. 1199); Ibn Majah (no. 3868)',
      ar: [
        note(2, 2, { sentence: 0 }),
        list(ADAB_1199, note(5, 2, { sentence: 0, segments: [2, 3], citeAs: [['3871', '3868']] })),
      ],
    },
  },
  {
    id: 'sayyid-al-istighfar',
    entry: 5,
    in: BOTH,
    repeat: 1,
    // asellam leaves the last letter of "abduka" unmarked; the word is taken from Seen's row.
    arabic: { ...A('morning', 5), patches: [fill(9, S(11))] },
    witnesses: [S(11), B(5), A('evening', 5)],
    transliteration:
      'Allāhumma anta rabbī lā ilāha illā ant, khalaqtanī wa anā ʿabduk, wa anā ʿalā ʿahdika wa waʿdika mastaṭaʿt, aʿūdhu bika min sharri mā ṣanaʿt, abūʾu laka bi-niʿmatika ʿalayy, wa abūʾu bi-dhanbī, faghfir lī fa-innahu lā yaghfirudh-dhunūba illā ant.',
    translation:
      'O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I hold to Your covenant and Your promise as best I can. I seek refuge in You from the evil of whatever I have done. I confess to You Your favour upon me, and I confess my sin; so forgive me, for no one forgives sins except You.',
    reference: { en: 'Al-Bukhari 7/150 (no. 6306)', ar: [note(2, 4, { sentence: 1 })] },
    virtue: {
      en: 'Whoever says it in the evening with firm conviction and dies that night enters Paradise, and likewise if it is said in the morning.',
      ar: [note(2, 4, { sentence: 0 })],
    },
  },
  {
    id: 'morning-asbahtu-ushhiduka',
    entry: 6,
    in: MORNING,
    repeat: 4,
    arabic: A('morning', 6),
    witnesses: [B(6), S(12)],
    // The book's digital text has a kasra on the ta of "mala'ikataka"; the word is a direct
    // object, and asellam, Seen and Abu Dawud 5069 all have the fatha.
    knownWitnessConflicts: { 'book:6': 1 },
    transliteration:
      'Allāhumma innī aṣbaḥtu ushhiduka wa ushhidu ḥamalata ʿarshik, wa malāʾikataka wa jamīʿa khalqik, annaka antallāhu lā ilāha illā anta waḥdaka lā sharīka lak, wa anna Muḥammadan ʿabduka wa rasūluk.',
    translation:
      'O Allah, I have entered the morning calling You to witness, and calling to witness the bearers of Your Throne, Your angels and all Your creation, that You are Allah; there is no god but You, alone, without partner, and that Muhammad is Your servant and Your Messenger.',
    // The book prints Abu Dawud no. 5071; in the common numbering this hadith is 5069 (read in the
    // open hadith API, and Seen's copy of the footnote has 5069 too), while 5071 is another dhikr.
    reference: {
      en: "Abu Dawud 4/317 (no. 5069); al-Bukhari in al-Adab al-Mufrad (no. 1201); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 9); Ibn as-Sunni (no. 70). Ibn Baz graded the chains of an-Nasa'i and Abu Dawud good in Tuhfat al-Akhyar, p. 23",
      ar: [note(3, 2, { sentence: 1, amend: [['5071', '5069']] })],
    },
    virtue: {
      en: 'Allah frees from the Fire whoever says it four times in the morning or in the evening.',
      ar: [note(3, 2, { sentence: 0 })],
    },
  },
  {
    id: 'evening-amsaytu-ushhiduka',
    entry: 6,
    in: EVENING,
    repeat: 4,
    arabic: A('evening', 6),
    witnesses: [S(13), A('morning', 6), B(6)],
    knownWitnessConflicts: { 'book:6': 1 },
    transliteration:
      'Allāhumma innī amsaytu ushhiduka wa ushhidu ḥamalata ʿarshik, wa malāʾikataka wa jamīʿa khalqik, annaka antallāhu lā ilāha illā anta waḥdaka lā sharīka lak, wa anna Muḥammadan ʿabduka wa rasūluk.',
    translation:
      'O Allah, I have entered the evening calling You to witness, and calling to witness the bearers of Your Throne, Your angels and all Your creation, that You are Allah; there is no god but You, alone, without partner, and that Muhammad is Your servant and Your Messenger.',
    reference: {
      en: "Abu Dawud 4/317 (no. 5069); al-Bukhari in al-Adab al-Mufrad (no. 1201); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 9); Ibn as-Sunni (no. 70). Ibn Baz graded the chains of an-Nasa'i and Abu Dawud good in Tuhfat al-Akhyar, p. 23",
      ar: [note(3, 2, { sentence: 1, amend: [['5071', '5069']] })],
    },
    virtue: {
      en: 'Allah frees from the Fire whoever says it four times in the morning or in the evening.',
      ar: [note(3, 2, { sentence: 0 })],
    },
  },
  {
    id: 'morning-ma-asbaha-bi-min-nimah',
    entry: 7,
    in: MORNING,
    repeat: 1,
    arabic: A('morning', 7),
    witnesses: [B(7), S(14)],
    transliteration:
      'Allāhumma mā aṣbaḥa bī min niʿmatin aw bi-aḥadin min khalqika fa-minka waḥdaka lā sharīka lak, fa-lakal-ḥamdu wa lakash-shukr.',
    translation:
      'O Allah, whatever blessing has come this morning to me or to any of Your creation is from You alone, without partner; so to You belongs all praise and to You belongs all thanks.',
    // The book prints Abu Dawud no. 5075; the hadith is 5073 in the open hadith API and in Seen.
    reference: {
      en: "Abu Dawud 4/318 (no. 5073); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 7); Ibn as-Sunni (no. 41); Ibn Hibban (Mawarid, no. 2361). Ibn Baz graded its chain good in Tuhfat al-Akhyar, p. 24",
      ar: [note(4, 2, { sentence: 1, amend: [['5075', '5073']] })],
    },
    virtue: {
      en: 'Whoever says it in the morning has given the thanks due for that day, and whoever says it in the evening has given the thanks due for that night.',
      ar: [note(4, 2, { sentence: 0 })],
    },
  },
  {
    id: 'evening-ma-amsa-bi-min-nimah',
    entry: 7,
    in: EVENING,
    repeat: 1,
    arabic: A('evening', 7),
    witnesses: [S(15), A('morning', 7), B(7)],
    transliteration:
      'Allāhumma mā amsā bī min niʿmatin aw bi-aḥadin min khalqika fa-minka waḥdaka lā sharīka lak, fa-lakal-ḥamdu wa lakash-shukr.',
    translation:
      'O Allah, whatever blessing has come this evening to me or to any of Your creation is from You alone, without partner; so to You belongs all praise and to You belongs all thanks.',
    reference: {
      en: "Abu Dawud 4/318 (no. 5073); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 7); Ibn as-Sunni (no. 41); Ibn Hibban (Mawarid, no. 2361). Ibn Baz graded its chain good in Tuhfat al-Akhyar, p. 24",
      ar: [note(4, 2, { sentence: 1, amend: [['5075', '5073']] })],
    },
    virtue: {
      en: 'Whoever says it in the morning has given the thanks due for that day, and whoever says it in the evening has given the thanks due for that night.',
      ar: [note(4, 2, { sentence: 0 })],
    },
  },
  {
    id: 'allahumma-afini-fi-badani',
    entry: 8,
    in: BOTH,
    repeat: 3,
    // asellam leaves the last letter of the first "ilaha" unmarked; the word is taken from Seen's row.
    arabic: { ...A('morning', 8), patches: [fill(13, S(16))] },
    witnesses: [S(16), B(8), A('evening', 8)],
    transliteration:
      'Allāhumma ʿāfinī fī badanī, Allāhumma ʿāfinī fī samʿī, Allāhumma ʿāfinī fī baṣarī, lā ilāha illā ant. Allāhumma innī aʿūdhu bika minal-kufri wal-faqr, wa aʿūdhu bika min ʿadhābil-qabr, lā ilāha illā ant.',
    translation:
      'O Allah, grant me soundness in my body. O Allah, grant me soundness in my hearing. O Allah, grant me soundness in my sight. There is no god but You. O Allah, I seek refuge in You from disbelief and from poverty, and I seek refuge in You from the torment of the grave. There is no god but You.',
    // The book prints Abu Dawud no. 5092; the hadith is 5090 in the open hadith API and in Seen.
    reference: {
      en: "Abu Dawud 4/324 (no. 5090); Ahmad 5/42 (no. 20430); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 22); Ibn as-Sunni (no. 69); al-Bukhari in al-Adab al-Mufrad (no. 701). Ibn Baz graded its chain good in Tuhfat al-Akhyar, p. 26",
      ar: [note(4, 3, { sentence: 0, amend: [['5092', '5090']] })],
    },
  },
  {
    id: 'hasbiyallahu-la-ilaha-illa-huwa',
    entry: 9,
    in: BOTH,
    repeat: 7,
    arabic: A('morning', 9),
    // These are the last twelve words of at-Tawbah 9:129. The item is hadith text, typed as the
    // other supplications are, but the build requires its words and vowels to be those of the ayah.
    quranTail: { surah: 9, ayah: 129, words: 12 },
    witnesses: [B(9), S(17), A('evening', 9)],
    transliteration: 'Ḥasbiyallāhu lā ilāha illā huwa, ʿalayhi tawakkaltu wa huwa rabbul-ʿarshil-ʿaẓīm.',
    translation:
      'Allah is sufficient for me; there is no god but He. In Him I have put my trust, and He is the Lord of the mighty Throne.',
    reference: {
      en: "Its words are the close of ayah 129 of Surah at-Tawbah in the Qur'an. Ibn as-Sunni (no. 71), as a saying of the Prophet; Abu Dawud 4/321 (no. 5081), as a saying of a Companion; its chain was graded authentic by Shu'ayb and Abd al-Qadir al-Arna'ut. See Zad al-Ma'ad 2/376",
      ar: [
        list(surahName(9), note(0, 2, { sentence: 0, segments: [1], citeAs: [['255', '129']] })),
        note(5, 1, { sentence: 1 }),
        note(5, 1, { sentence: 2 }),
      ],
    },
    virtue: {
      en: 'Whoever says it seven times in the morning and in the evening, Allah takes care of whatever worries them in the matters of this world and the Hereafter.',
      ar: [note(5, 1, { sentence: 0 })],
    },
  },
  {
    id: 'allahumma-inni-asaluka-al-afwa-wal-afiyah',
    entry: 10,
    in: BOTH,
    repeat: 1,
    arabic: A('morning', 10),
    witnesses: [B(10), S(18), A('evening', 10)],
    transliteration:
      'Allāhumma innī asʾalukal-ʿafwa wal-ʿāfiyata fid-dunyā wal-ākhirah. Allāhumma innī asʾalukal-ʿafwa wal-ʿāfiyata fī dīnī wa dunyāya wa ahlī wa mālī. Allāhummastur ʿawrātī wa āmin rawʿātī. Allāhummaḥfaẓnī min bayni yadayya wa min khalfī, wa ʿan yamīnī wa ʿan shimālī, wa min fawqī, wa aʿūdhu bi-ʿaẓamatika an ughtāla min taḥtī.',
    translation:
      'O Allah, I ask You for pardon and well-being in this world and the Hereafter. O Allah, I ask You for pardon and well-being in my religion and my worldly life, and in my family and my property. O Allah, cover my faults and calm my fears. O Allah, protect me from the front and from behind, on my right and on my left, and from above, and I seek refuge in Your greatness from being seized unawares from beneath me.',
    reference: {
      en: 'Abu Dawud (no. 5074); Ibn Majah (no. 3871); see also Sahih Ibn Majah 2/332',
      ar: [note(5, 2, { sentence: 0 })],
    },
  },
  {
    id: 'allahumma-alim-al-ghayb-wash-shahadah',
    entry: 11,
    in: BOTH,
    repeat: 1,
    // Every pinned copy of this dhikr spells "as-samawati" without the alef of its long a, which,
    // read by its marks alone, gives a short vowel. The word is taken, with that alef, from
    // asellam's own typing of the same word elsewhere in the chapter; the Darussalam print of the
    // book and two other adhkar collections (wird, fitrahive) spell it so in this very dhikr.
    arabic: { ...A('morning', 11), patches: [respell(5, A('morning', 1), 20)] },
    witnesses: [B(11), S(19), A('evening', 11)],
    // Two readings are transmitted for one word: "wa shirkihi" (asellam, and the wording of
    // at-Tirmidhi 3392 and Abu Dawud 5067) and "wa sharakihi" (the book's digital text here, and
    // at-Tirmidhi 3529). Each is counted as two conflicts because two letters carry a different
    // vowel. The respelled word is the one word each witness writes differently.
    knownWitnessConflicts: { 'book:11': 2, 'seen:19': 2 },
    knownWordDifferences: { 'book:11': 1, 'seen:19': 1, 'asellam:evening:11': 1 },
    transliteration:
      'Allāhumma ʿālimal-ghaybi wash-shahādah, fāṭiras-samāwāti wal-arḍ, rabba kulli shayʾin wa malīkah, ashhadu an lā ilāha illā ant, aʿūdhu bika min sharri nafsī, wa min sharrish-shayṭāni wa shirkih, wa an aqtarifa ʿalā nafsī sūʾan aw ajurrahu ilā muslim.',
    translation:
      'O Allah, Knower of the unseen and the witnessed, Originator of the heavens and the earth, Lord and Possessor of everything: I bear witness that there is no god but You. I seek refuge in You from the evil of my own self, from the evil of Satan and his call to associate partners with You, and from committing any wrong against myself or bringing it upon a Muslim.',
    // The closing clause ("wa an aqtarifa ...") is in neither hadith the book cites; it is the
    // wording of at-Tirmidhi 3529, which is added with the book's own "and no." phrase.
    reference: {
      en: 'At-Tirmidhi (nos. 3392 and 3529); Abu Dawud (no. 5067); see also Sahih at-Tirmidhi 3/142',
      ar: [
        list(
          note(6, 1, { sentence: 0, segments: [0, 1] }),
          note(8, 2, { sentence: 0, segments: [4], citeAs: [['15563', '3529']] }),
          note(6, 1, { sentence: 0, segments: [2, 3] }),
          note(6, 1, { sentence: 1 }),
        ),
      ],
    },
  },
  {
    id: 'bismillah-alladhi-la-yadurru',
    entry: 12,
    in: BOTH,
    repeat: 3,
    // asellam types "alladhi" without the shadda of its lam; the word is taken from Seen's row.
    arabic: { ...A('morning', 12), patches: [fill(2, S(20))] },
    witnesses: [S(20), B(12), A('evening', 12)],
    transliteration:
      'Bismillāhil-ladhī lā yaḍurru maʿasmihi shayʾun fil-arḍi wa lā fis-samāʾi wa huwas-samīʿul-ʿalīm.',
    translation:
      'In the name of Allah, alongside whose name nothing in the earth or in the sky can do any harm; and He is the All-Hearing, the All-Knowing.',
    // The book prints a stray comma between "no." and two of the numbers; those pairs are rejoined.
    reference: {
      en: 'Abu Dawud 4/323 (no. 5088); at-Tirmidhi 5/465 (no. 3388); Ibn Majah (no. 3869); Ahmad (no. 446). See also Sahih Ibn Majah 2/332; Ibn Baz graded its chain good in Tuhfat al-Akhyar, p. 39',
      ar: [
        note(6, 2, { sentence: 1, segments: [0, 1, [2, 3], 4, 5, 6, 7, 8, 9, 10] }),
        note(6, 2, { sentence: 2 }),
      ],
    },
    virtue: {
      en: 'Nothing harms whoever says it three times in the morning and three times in the evening.',
      ar: [note(6, 2, { sentence: 0 })],
    },
  },
  {
    id: 'raditu-billahi-rabban',
    entry: 13,
    in: BOTH,
    repeat: 3,
    arabic: A('morning', 13),
    witnesses: [B(13), S(21), A('evening', 13)],
    // Seen prints the four words of the blessing on the Prophet as one ligature sign.
    knownWordDifferences: { 'seen:21': 4 },
    transliteration:
      'Raḍītu billāhi rabbā, wa bil-islāmi dīnā, wa bi-Muḥammadin ṣallallāhu ʿalayhi wa sallama nabiyyā.',
    translation: `I am content with Allah as Lord, with Islam as religion, and with Muhammad, ${SALAWAT_AFTER_NAME}, as Prophet.`,
    // The book prints "Abu Dawud 4/318, no. 1531". No. 1531 is a hadith on sending blessings on
    // Fridays; the hadith on that page with this virtue, said morning and evening, is no. 5072.
    reference: {
      en: "Ahmad 4/337 (no. 18967); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 4); Ibn as-Sunni (no. 68); Abu Dawud 4/318 (no. 5072); at-Tirmidhi 5/465 (no. 3389). Ibn Baz graded it good in Tuhfat al-Akhyar, p. 39",
      ar: [
        note(6, 3, {
          sentence: 1,
          segments: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, [12, 13], 14],
          amend: [['1531', '5072']],
        }),
      ],
    },
    virtue: {
      en: 'Whoever says it three times in the morning and three times in the evening, Allah has taken it upon Himself to please them on the Day of Resurrection.',
      ar: [note(6, 3, { sentence: 0 })],
    },
  },
  {
    id: 'ya-hayyu-ya-qayyum',
    entry: 14,
    in: BOTH,
    repeat: 1,
    arabic: A('morning', 14),
    witnesses: [B(14), S(22), A('evening', 14)],
    transliteration:
      'Yā ḥayyu yā qayyūm, bi-raḥmatika astaghīth, aṣliḥ lī shaʾnī kullah, wa lā takilnī ilā nafsī ṭarfata ʿayn.',
    translation:
      'O Ever-Living, O Sustainer of all, in Your mercy I seek relief. Set right all my affairs for me, and do not leave me to my own self, even for the blink of an eye.',
    reference: {
      en: 'Al-Hakim 1/545, who graded it authentic, and adh-Dhahabi agreed; see also Sahih at-Targhib wat-Tarhib 1/273',
      ar: [note(7, 1, { sentence: 0 })],
    },
  },
  {
    id: 'morning-asbahna-rabbil-alamin',
    entry: 15,
    in: MORNING,
    repeat: 1,
    arabic: A('morning', 15),
    witnesses: [B(15), S(23)],
    transliteration:
      'Aṣbaḥnā wa aṣbaḥal-mulku lillāhi rabbil-ʿālamīn. Allāhumma innī asʾaluka khayra hādhal-yawm: fatḥahu, wa naṣrahu, wa nūrahu, wa barakatahu, wa hudāh, wa aʿūdhu bika min sharri mā fīhi wa sharri mā baʿdah.',
    translation:
      "We have entered the morning, and the dominion this morning is Allah's, the Lord of the worlds. O Allah, I ask You for this day's good: its triumph, its help and its light, its blessing and its guidance; and I seek refuge in You from the evil that is in it and the evil that follows it.",
    reference: {
      en: "Abu Dawud 4/322 (no. 5084); its chain was graded good by Shu'ayb and Abd al-Qadir al-Arna'ut in their edition of Zad al-Ma'ad 2/373",
      ar: [note(7, 4, { sentence: 0 })],
    },
  },
  {
    id: 'evening-amsayna-rabbil-alamin',
    entry: 15,
    in: EVENING,
    repeat: 1,
    arabic: A('evening', 15),
    witnesses: [A('morning', 15), B(15), S(24)],
    // Seen's evening row for this entry is badly vocalised (six wrong marks); it is listed only
    // so that the disagreement stays visible.
    knownWitnessConflicts: { 'seen:24': 6 },
    transliteration:
      'Amsaynā wa amsal-mulku lillāhi rabbil-ʿālamīn. Allāhumma innī asʾaluka khayra hādhihil-laylah: fatḥahā, wa naṣrahā, wa nūrahā, wa barakatahā, wa hudāhā, wa aʿūdhu bika min sharri mā fīhā wa sharri mā baʿdahā.',
    translation:
      "We have entered the evening, and the dominion this evening is Allah's, the Lord of the worlds. O Allah, I ask You for this night's good: its triumph, its help and its light, its blessing and its guidance; and I seek refuge in You from the evil that is in it and the evil that follows it.",
    reference: {
      en: "Abu Dawud 4/322 (no. 5084); its chain was graded good by Shu'ayb and Abd al-Qadir al-Arna'ut in their edition of Zad al-Ma'ad 2/373",
      ar: [note(7, 4, { sentence: 0 })],
    },
  },
  {
    id: 'morning-asbahna-ala-fitrat-al-islam',
    entry: 16,
    in: MORNING,
    repeat: 1,
    arabic: A('morning', 16),
    witnesses: [B(16), S(25)],
    // Seen prints the four words of the blessing on the Prophet as one ligature sign.
    knownWordDifferences: { 'seen:25': 4 },
    transliteration:
      'Aṣbaḥnā ʿalā fiṭratil-islām, wa ʿalā kalimatil-ikhlāṣ, wa ʿalā dīni nabiyyinā Muḥammadin ṣallallāhu ʿalayhi wa sallam, wa ʿalā millati abīnā Ibrāhīma ḥanīfan musliman wa mā kāna minal-mushrikīn.',
    translation: `We have entered the morning upon the natural way of Islam, upon the word of sincere devotion, upon the religion of our Prophet Muhammad, ${SALAWAT_AFTER_NAME}, and upon the way of our father Ibrahim, who was upright in faith, a Muslim, and was not one of those who associate partners with Allah.`,
    // The book prints Ahmad "nos. 15360 and 15563". dorar.net lists this hadith in the Musnad at
    // nos. 15360, 15363, 15364 and 15367 only, and 15363 is the narration with this wording, "said
    // in the morning and in the evening". The two pages cited are adjacent (3/406 and 407), which
    // fits 15360 and 15363, not a hadith two hundred numbers later: two digits were transposed.
    reference: {
      en: "Ahmad 3/406 and 407 (nos. 15360 and 15363); Ibn as-Sunni in 'Amal al-Yawm wal-Laylah (no. 34); see also Sahih al-Jami' 4/209",
      ar: [note(8, 2, { sentence: 0, amend: [['15563', '15363']] })],
    },
  },
  {
    id: 'evening-amsayna-ala-fitrat-al-islam',
    entry: 16,
    in: EVENING,
    repeat: 1,
    arabic: A('evening', 16),
    witnesses: [S(26), A('morning', 16), B(16)],
    knownWordDifferences: { 'seen:26': 4 },
    transliteration:
      'Amsaynā ʿalā fiṭratil-islām, wa ʿalā kalimatil-ikhlāṣ, wa ʿalā dīni nabiyyinā Muḥammadin ṣallallāhu ʿalayhi wa sallam, wa ʿalā millati abīnā Ibrāhīma ḥanīfan musliman wa mā kāna minal-mushrikīn.',
    translation: `We have entered the evening upon the natural way of Islam, upon the word of sincere devotion, upon the religion of our Prophet Muhammad, ${SALAWAT_AFTER_NAME}, and upon the way of our father Ibrahim, who was upright in faith, a Muslim, and was not one of those who associate partners with Allah.`,
    // The book prints Ahmad "nos. 15360 and 15563". dorar.net lists this hadith in the Musnad at
    // nos. 15360, 15363, 15364 and 15367 only, and 15363 is the narration with this wording, "said
    // in the morning and in the evening". The two pages cited are adjacent (3/406 and 407), which
    // fits 15360 and 15363, not a hadith two hundred numbers later: two digits were transposed.
    reference: {
      en: "Ahmad 3/406 and 407 (nos. 15360 and 15363); Ibn as-Sunni in 'Amal al-Yawm wal-Laylah (no. 34); see also Sahih al-Jami' 4/209",
      ar: [note(8, 2, { sentence: 0, amend: [['15563', '15363']] })],
    },
  },
  {
    id: 'subhanallahi-wa-bihamdih',
    entry: 17,
    in: BOTH,
    repeat: 100,
    arabic: A('morning', 17),
    witnesses: [B(17), S(34), A('evening', 17)],
    transliteration: 'Subḥānallāhi wa bi-ḥamdih.',
    translation: 'Glory be to Allah, and praise be to Him.',
    // The book leaves out the comma it prints everywhere else between the page and "no.".
    reference: { en: 'Muslim 4/2071 (no. 2692)', ar: [note(8, 3, { sentence: 1, commaAfter: ['4/2071'] })] },
    virtue: {
      en: 'Whoever says it one hundred times in the morning and in the evening, no one will come on the Day of Resurrection with anything better than what they bring, except someone who said the same or more.',
      ar: [note(8, 3, { sentence: 0 })],
    },
  },
  {
    id: 'la-ilaha-illallah-wahdahu-ten-times',
    entry: 18,
    in: BOTH,
    repeat: 10,
    arabic: A('morning', 18),
    witnesses: [B(18), S(28), A('evening', 18)],
    ...TAHLIL,
    note: { en: 'Ten times, or once when overcome by laziness.', ar: remark(18) },
    // The book gives one footnote for "ten times" and another for "once when lazy"; each citation
    // is labelled with the book's own bracketed words. Two numbers of the second footnote belong
    // elsewhere and were checked against the hadiths themselves:
    // - Ibn Majah 3798 is the hundred-times-a-day hadith of Abu Hurayrah. The say-it-once
    //   narration of Abu Ayyash, the one Abu Dawud 5077 carries, is Ibn Majah 3867.
    // - Ahmad 8719 is Abu Hurayrah's ten-times narration, so it is cited under "ten times";
    //   Abu Ayyash's narration is Ahmad 16583.
    reference: {
      en: "Ten times: an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 24); Ahmad (no. 8719); see also Sahih at-Targhib wat-Tarhib 1/272 and Tuhfat al-Akhyar by Ibn Baz, p. 44. Once, when lazy: Abu Dawud (no. 5077); Ibn Majah (no. 3867); Ahmad (no. 16583); see also Sahih at-Targhib wat-Tarhib 1/270, Sahih Abi Dawud 3/957, Sahih Ibn Majah 2/331 and Zad al-Ma'ad 2/377",
      ar: [
        list(
          note(9, 1, { sentence: 0, segments: [0, 1], label: annotation(18, 0) }),
          note(9, 2, { sentence: 0, segments: [4, 5] }),
          note(9, 1, { sentence: 0, segments: [2, 3, 4, 5] }),
        ),
        note(9, 2, {
          sentence: 0,
          amend: [
            ['3798', '3867'],
            ['8719', '16583'],
          ],
          label: annotation(18, 1),
        }),
      ],
    },
  },
  {
    id: 'la-ilaha-illallah-wahdahu-hundred-times',
    entry: 19,
    in: MORNING,
    repeat: 100,
    arabic: A('morning', 19),
    witnesses: [B(19), S(32)],
    ...TAHLIL,
    reference: {
      en: 'Al-Bukhari 4/95 (no. 3293); Muslim 4/2071 (no. 2691)',
      ar: [note(9, 3, { sentence: 1 })],
    },
    virtue: {
      en: 'Whoever says it one hundred times in a day, it equals for them the freeing of ten slaves; one hundred good deeds are written for them and one hundred bad deeds are erased from them; it is a protection for them from Satan throughout that day until evening; and no one brings anything better than what they bring, except someone who has done more than that.',
      ar: [note(9, 3, { sentence: 0 })],
    },
  },
  {
    id: 'subhanallahi-wa-bihamdih-adada-khalqih',
    entry: 20,
    in: MORNING,
    repeat: 3,
    arabic: A('morning', 20),
    witnesses: [B(20), S(31)],
    transliteration:
      'Subḥānallāhi wa bi-ḥamdih, ʿadada khalqih, wa riḍā nafsih, wa zinata ʿarshih, wa midāda kalimātih.',
    translation:
      'Glory be to Allah, and praise be to Him, as many times as the number of His creatures, as much as pleases Him, as much as the weight of His Throne, and as much as the ink of His words.',
    reference: { en: 'Muslim 4/2090 (no. 2726)', ar: [note(10, 1, { sentence: 0 })] },
  },
  {
    id: 'allahumma-inni-asaluka-ilman-nafian',
    entry: 21,
    in: MORNING,
    repeat: 1,
    arabic: A('morning', 21),
    witnesses: [B(21), S(27)],
    transliteration: 'Allāhumma innī asʾaluka ʿilman nāfiʿā, wa rizqan ṭayyibā, wa ʿamalan mutaqabbalā.',
    translation:
      'O Allah, I ask You for knowledge that benefits, provision that is good, and deeds that are accepted.',
    reference: {
      en: "Ibn as-Sunni in 'Amal al-Yawm wal-Laylah (no. 54); Ibn Majah (no. 925); its chain was graded good by Abd al-Qadir and Shu'ayb al-Arna'ut in their edition of Zad al-Ma'ad 2/375",
      ar: [note(10, 2, { sentence: 0, segments: range(0, 5) })],
    },
  },
  {
    id: 'astaghfirullah-wa-atubu-ilayh',
    entry: 22,
    // "One hundred times during the day" is a daily total (Muslim 2702: "a hundred times in the
    // day"). Listed in both sessions it asked for two hundred, so it is recited in the morning
    // session only, as Seen and nawafalqari/azkar-api place it. asellam's evening copy of the text
    // stays a witness for the wording.
    in: MORNING,
    repeat: 100,
    arabic: A('morning', 22),
    witnesses: [B(22), S(33), A('evening', 19)],
    transliteration: 'Astaghfirullāha wa atūbu ilayh.',
    translation: 'I ask Allah for forgiveness and I turn to Him in repentance.',
    note: { en: 'One hundred times during the day.', ar: remark(22) },
    // The book's citation of Muslim has lost its volume number ("/ 2075"). It is volume 4: Seen
    // prints "4/2075", and the book itself cites Muslim 2692 at 4/2071 and Muslim 2723 at 4/2088.
    reference: {
      en: 'Al-Bukhari, with Fath al-Bari 11/101 (no. 6307); Muslim 4/2075 (no. 2702)',
      ar: [note(10, 3, { sentence: 0, amend: [['/2075', '4/2075']] })],
    },
  },
  {
    id: 'audhu-bi-kalimatillah-at-tammat',
    entry: 23,
    in: EVENING,
    repeat: 3,
    arabic: A('evening', 20),
    witnesses: [B(23), S(30)],
    transliteration: 'Aʿūdhu bi-kalimātillāhit-tāmmāti min sharri mā khalaq.',
    translation: "I seek refuge in Allah's perfect words from the evil of whatever He has created.",
    // The book also cites "Ibn as-Sunni, no. 68" here, the very number it gives for the dhikr
    // "Raditu billahi rabba", which is the hadith that number belongs to. One number cannot be two
    // hadiths, and the right one for this dhikr was not found, so the citation is left out.
    reference: {
      en: "Ahmad 2/290 (no. 7898); an-Nasa'i in 'Amal al-Yawm wal-Laylah (no. 590); see also Sahih at-Tirmidhi 3/187, Sahih Ibn Majah 2/266 and Tuhfat al-Akhyar by Ibn Baz, p. 45",
      ar: [note(11, 1, { sentence: 0, segments: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13] })],
    },
    virtue: {
      en: 'Whoever says it three times in the evening will not be harmed by any venomous sting that night.',
      ar: [note(11, 1, { sentence: 0, segments: [0] })],
    },
  },
  {
    id: 'allahumma-salli-wa-sallim-ala-nabiyyina-muhammad',
    entry: 24,
    in: BOTH,
    repeat: 10,
    arabic: A('morning', 23),
    witnesses: [B(24), S(29), A('evening', 21)],
    // The book's digital text, copied by Seen, has a fatha on the ba of "nabiyyina"; the word is
    // "nabiyyina" with a kasra, as asellam has it and as the same book prints it in entry 16.
    knownWitnessConflicts: { 'book:24': 1, 'seen:29': 1 },
    transliteration: 'Allāhumma ṣalli wa sallim ʿalā nabiyyinā Muḥammad.',
    translation: 'O Allah, send blessings and peace upon our Prophet Muhammad.',
    // No virtue is given. The book quotes a narration promising intercession and points to Sahih
    // at-Targhib; al-Albani later graded that narration weak. Seen's copy of the footnote records
    // it (Da'if at-Targhib no. 396, as-Silsilah ad-Da'ifah no. 5788), and that addition is kept
    // in the reference so that the citation of Sahih at-Targhib does not stand alone.
    reference: {
      en: "At-Tabarani through two chains, one of them good; see Majma' az-Zawa'id 10/120 and Sahih at-Targhib wat-Tarhib 1/273; it is also in Da'if at-Targhib wat-Tarhib (no. 396) and in as-Silsilah ad-Da'ifah (no. 5788), al-Albani's collections of weak narrations",
      ar: [
        list(note(11, 2, { sentence: 0, after: '))' }), seenSource(29, { sentence: 0, segments: [3] })),
        seenSource(29, { sentence: 1 }),
      ],
    },
  },
]
