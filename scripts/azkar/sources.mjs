// Every file the adhkar dataset is assembled from, pinned to an exact revision.
//
// `raw/`    the inputs of build.mjs, each pinned by sha256, which is checked on every build so that
//           a silent upstream change cannot alter the dataset. The Qur'an and hadith files and all
//           licence files are committed. The three adhkar compilations are NOT committed
//           (raw/.gitignore): two of them are complete digital copies of Hisn al-Muslim, whose
//           text belongs to its author and publisher, and the MIT licences of the repositories
//           that host them cover those repositories' own work, not the book. Run
//           `node scripts/azkar/fetch.mjs` once to download them before building.
// `.cache/` git-ignored: only read by verify.mjs as extra witnesses, never copied into azkar.json.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASELLAM = '872764ca013116c905f7fc9c3dc972c27cd37d4a'
const SEEN = '29d7623fede52eca835a789025dfda866e8cfe44'
const ABDORIZAK = 'a74ebb419e8572433d97011038a4eeeb8b42ceb3'
const HADITH_API = 'df57907be35291c91ad6a6691180e22ca9920784'
const WIRD = '4a1dcd38bbf314dd463796aa9d5a6ef6161f86a6'
const FITRAHIVE = 'f42f895f914319a844c3e3c2279483cae060ea19'

const gh = (repo, sha, path) => `https://raw.githubusercontent.com/${repo}/${sha}/${path}`
const quran = (what) => `https://api.alquran.cloud/v1/${what}/quran-simple`

/** Inputs of build.mjs, each pinned by sha256. raw/.gitignore lists the three that are not committed. */
export const RAW = [
  {
    path: 'raw/asellam-hisn-el-muslim/hisn.json',
    url: gh('asellam/HisnElMuslim', ASELLAM, 'hisn.json'),
    sha256: 'b30a448ef40184b0422c40bd3c372bf2b25bfb5b0539fd3699e6b4fba9459d80',
  },
  {
    path: 'raw/asellam-hisn-el-muslim/LICENSE.md',
    url: gh('asellam/HisnElMuslim', ASELLAM, 'LICENSE.md'),
    sha256: '65b11add3112689b4a61aa53fb127705522c19eb1a809556a67410e2a335ef00',
  },
  {
    path: 'raw/seen-arabic-adhkar-db/ar.json',
    url: gh('Seen-Arabic/Morning-And-Evening-Adhkar-DB', SEEN, 'ar.json'),
    sha256: '9e0dd6a10d26ddc0e2b36b94098c287644996c7f81b707f8ad24f1ce40b8c821',
  },
  {
    path: 'raw/seen-arabic-adhkar-db/LICENSE',
    url: gh('Seen-Arabic/Morning-And-Evening-Adhkar-DB', SEEN, 'LICENSE'),
    sha256: 'a72f0268608c31d32da8e5a9c934fef80cc8f377eb018b83f0d660a2894b0825',
  },
  {
    path: 'raw/abdorizak-hisnul-muslim/hisnul_muslim.json',
    url: gh('abdorizak/Hisnul-Muslim', ABDORIZAK, 'Hisnul%20Muslim/Resources/hisnul_muslim.json'),
    sha256: '173a0865eecf564bc68be78502636b44555b41d7080801fc72c86062a326e417',
  },
  {
    path: 'raw/abdorizak-hisnul-muslim/LICENSE.md',
    url: gh('abdorizak/Hisnul-Muslim', ABDORIZAK, 'LICENSE.md'),
    sha256: 'e639823f175f19f9ea20f10115cd1b53623b1b318fcf7a8966c32c519d0b6a2f',
  },
  {
    path: 'raw/hadith-api/ara-muslim-6908.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/6908.json'),
    sha256: '2adc00cd5b40340e46db8989a925369e6479d8f61a86ff0730b0f4dee32b6dbf',
  },
  {
    path: 'raw/hadith-api/LICENSE',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'LICENSE'),
    sha256: '6b0382b16279f26ff69014300541967a356a666eb0b91b422f6862f6b7dad17e',
  },
  // One file per hadith whose wording a new item is checked against (see lib/raw.mjs, hadith()).
  // Sahih Muslim's files are numbered by the API's own sequence; the comment gives the hadith.
  // Muslim 591
  {
    path: 'raw/hadith-api/ara-muslim-1334.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/1334.json'),
    sha256: 'cf2b14752610813116efd23939ebb71e8a1aef67295b8848fd0607d05af2d1c2',
  },
  // Muslim 593
  {
    path: 'raw/hadith-api/ara-muslim-1338.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/1338.json'),
    sha256: 'b565cd16a1e4c5e2533ac50340b1fdcfe12f8535d261a700e8b4426ec6563c1d',
  },
  {
    path: 'raw/hadith-api/ara-bukhari-844.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-bukhari/844.json'),
    sha256: '5d23a7900b8561b10579ced955ab0949eae64cbffef50e75336724a8e7a821f0',
  },
  {
    path: 'raw/hadith-api/ara-bukhari-6473.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-bukhari/6473.json'),
    sha256: '257a0b3db3e1b3dd5886d291ff4f5eb2854f44feeb9011f0b2de2d9c2b6dc6ca',
  },
  // Muslim 594
  {
    path: 'raw/hadith-api/ara-muslim-1343.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/1343.json'),
    sha256: '4d1b5508ca8ec4a5f27a539b2fa26f348eb94cb20709f3949d03a855b07cb7e3',
  },
  // Muslim 597
  {
    path: 'raw/hadith-api/ara-muslim-1352.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/1352.json'),
    sha256: '935d41c8599847898fc054d45a87d5bf4d712a0875b015190666cc3a6e94a56f',
  },
  {
    path: 'raw/hadith-api/ara-tirmidhi-3474.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-tirmidhi/3474.json'),
    sha256: 'a2c16b0c892d30d66717e50bdd3ee31ca48ed564ae5ece40b80bb924493a1984',
  },
  {
    path: 'raw/hadith-api/ara-bukhari-5017.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-bukhari/5017.json'),
    sha256: '414d2d2839f8b470ef86f1e27a261e1718c0a191e20d412fe33a2c972a9caed7',
  },
  {
    path: 'raw/hadith-api/ara-bukhari-6320.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-bukhari/6320.json'),
    sha256: 'ddcf55047bd820de7634413d0fd4ee1eab75b8402c40f1aa9ec89509f159d882',
  },
  {
    path: 'raw/hadith-api/ara-tirmidhi-3401.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-tirmidhi/3401.json'),
    sha256: '056bd9c603ddbe0f16f0b20b283ecab57ed5666766e8cbfde397001be43cfb11',
  },
  // Muslim 2712
  {
    path: 'raw/hadith-api/ara-muslim-6888.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/6888.json'),
    sha256: 'ed8f7ba4444c84399e7233981bdc16a93772995040fa3a249e8512d323064ec6',
  },
  {
    path: 'raw/hadith-api/ara-abudawud-5045.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-abudawud/5045.json'),
    sha256: 'c6ac458aad0c628f897b027634ceedb9208294b995241bc0a5be7dbb6e55ae34',
  },
  {
    path: 'raw/hadith-api/ara-bukhari-6324.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-bukhari/6324.json'),
    sha256: 'd0365a33e5efa587c47d6cd7e753a2a62f5ed6a4c9dd1abb2c658782e3a6f3d8',
  },
  // Muslim 2713
  {
    path: 'raw/hadith-api/ara-muslim-6889.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/6889.json'),
    sha256: 'b69a84182be5180a218047f32e13563cec6c3ee8c804eea9cf0d92b1ef316de0',
  },
  // Muslim 2715
  {
    path: 'raw/hadith-api/ara-muslim-6894.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/6894.json'),
    sha256: '9d38453518d9ec336a7b59de606ba0adbaf9fa42638f28ba58729683b155d316',
  },
  // Muslim 2137: "the words dearest to Allah are four", a witness of the tasbih formulas
  {
    path: 'raw/hadith-api/ara-muslim-5601.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/5601.json'),
    sha256: 'ae98de157d899c31706351a3f9f77d37a72c3f22c738e83357ad7be7eac355b5',
  },
  {
    path: 'raw/hadith-api/ara-bukhari-6313.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-bukhari/6313.json'),
    sha256: 'f356f0f670034795ce7fac985298d4efb1b66788bfc2c09652558cecc2764370',
  },
  {
    path: 'raw/hadith-api/ara-tirmidhi-3383.json',
    url: gh('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-tirmidhi/3383.json'),
    sha256: '3d111f4b7ed8ae88f0d36078b140a810fdf09b7b54e28848d4e50ccd35a1334f',
  },
  {
    path: 'raw/tanzil-alquran-cloud/ayah-1-1.json',
    url: quran('ayah/1:1'),
    sha256: 'c3882599551e9714cbcc9fa602926a6f61e73484c34c0ef67aba9f86c49f9e4d',
  },
  {
    path: 'raw/tanzil-alquran-cloud/ayah-2-255.json',
    url: quran('ayah/2:255'),
    sha256: '6251e68f03339e5bbef6f5720aae206052a2b08f5369a0ce7dce9c07fda36b7d',
  },
  {
    path: 'raw/tanzil-alquran-cloud/ayah-2-285.json',
    url: quran('ayah/2:285'),
    sha256: '6bd15da0d5611712d31a392c2fe368e5d92e3494a02a8ab345a93d9525a0f619',
  },
  {
    path: 'raw/tanzil-alquran-cloud/ayah-2-286.json',
    url: quran('ayah/2:286'),
    sha256: 'd39dc7ccc25271fea1579dfd03b0460740e9488a09323d467dfee539b3326c64',
  },
  {
    path: 'raw/tanzil-alquran-cloud/ayah-9-129.json',
    url: quran('ayah/9:129'),
    sha256: '2f35c521e3293f4aa2f3a3d80281e6f1e8c32f1994781b83200e58f8b522e5d1',
  },
  {
    path: 'raw/tanzil-alquran-cloud/surah-32.json',
    url: quran('surah/32'),
    sha256: 'abd9a22413335dd8499b97c46c91a32fb1ccfcc546ff597454b0c77fb02243e1',
  },
  {
    path: 'raw/tanzil-alquran-cloud/surah-67.json',
    url: quran('surah/67'),
    sha256: '7a7ffea1c6346e1fb4e7997a051503cc4506cad2617997d47f471cb9a68b4f28',
  },
  {
    path: 'raw/tanzil-alquran-cloud/surah-112.json',
    url: quran('surah/112'),
    sha256: '8c836fdc8625d0873b63d1357c9f0061756fcfdaf4efe0d112ecab17d51753b0',
  },
  {
    path: 'raw/tanzil-alquran-cloud/surah-113.json',
    url: quran('surah/113'),
    sha256: 'b1fb435402ece5b0a01f2af623f2260026a500ac27441f52df906bdd58ca1a8e',
  },
  {
    path: 'raw/tanzil-alquran-cloud/surah-114.json',
    url: quran('surah/114'),
    sha256: '1b16252c0d9a57f26970837b9ea1fb4891406ffe2fb184287d1883e250c5766b',
  },
]

/**
 * Optional witnesses for verify.mjs, kept out of the repository: no licence is stated
 * (hisnmuslim.com), the licence is non-commercial (wird), the file is large (Tanzil), or it is
 * only a secondary witness (fitrahive, MIT).
 */
export const CACHE = [
  // With the pause marks, the sajdah sign and the rub' al-hizb sign, as the API serves the text.
  {
    path: '.cache/tanzil-simple-plain-signs.txt',
    url: 'https://tanzil.net/pub/download/index.php?quranType=simple-plain&marks=true&sajdah=true&rub=true&outType=txt-2&agree=true',
  },
  { path: '.cache/hisnmuslim-25.json', url: 'https://www.hisnmuslim.com/api/ar/25.json' },
  { path: '.cache/hisnmuslim-27.json', url: 'https://www.hisnmuslim.com/api/ar/27.json' },
  { path: '.cache/hisnmuslim-28.json', url: 'https://www.hisnmuslim.com/api/ar/28.json' },
  { path: '.cache/wird-data.json', url: gh('Open-Waqf/wird', WIRD, 'www/data.json') },
  {
    path: '.cache/fitrahive-morning.json',
    url: gh('fitrahive/dua-dhikr', FITRAHIVE, 'data/dua-dhikr/morning-dhikr/en.json'),
  },
  {
    path: '.cache/fitrahive-evening.json',
    url: gh('fitrahive/dua-dhikr', FITRAHIVE, 'data/dua-dhikr/evening-dhikr/en.json'),
  },
]

/** Hadith numbers quoted in references, checked by verify.mjs against the open hadith API. */
export const hadithUrl = (edition, number) =>
  gh('fawazahmed0/hadith-api', HADITH_API, `editions/ara-${edition}/${number}.json`)

const blob = (repo, sha, path) => `https://github.com/${repo}/blob/${sha}/${path}`

/**
 * Tanzil's copyright block, which its terms ask to be reproduced in every file that contains a
 * substantial portion of its text: azkar.json carries it, character for character, as copied from
 * the tanzil.net download into raw/tanzil-alquran-cloud/NOTICE.txt (verify.mjs compares the two).
 */
export const TANZIL_NOTICE = (() => {
  const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'raw', 'tanzil-alquran-cloud', 'NOTICE.txt'), 'utf8')
  const start = text.indexOf('# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK')
  const end = text.lastIndexOf('#====')
  if (start < 0 || end < start) throw new Error('azkar sources: the Tanzil copyright block is missing from NOTICE.txt')
  return text.slice(start, text.indexOf('\n', end) < 0 ? text.length : text.indexOf('\n', end))
})()

/** Credits written into azkar.json and shown to users. */
export const SOURCES = [
  {
    name: "Hisn al-Muslim (Fortress of the Muslim) by Sa'id ibn Ali ibn Wahf al-Qahtani, published by Matba'at Safir, Riyadh — digital text with footnotes, read from abdorizak/Hisnul-Muslim",
    url: blob('abdorizak/Hisnul-Muslim', ABDORIZAK, 'Hisnul%20Muslim/Resources/hisnul_muslim.json'),
    license:
      'The book and its footnotes belong to their author and publisher; no licence is stated for the text. The repository it was read from is MIT-licensed (Copyright (c) 2023 Abdorizak Abdalla), which covers that repository, not the book. Only short extracts are quoted here: citations, one-sentence virtues and notes from the footnotes of four chapters, one virtue from the text of the chapter on the virtue of tasbih, and two words of the title of the chapter on the prostration of recitation',
    usedFor:
      "Selection and order of the azkar of the morning and evening, after the salam of the prayer and before sleep, repeat counts, and the Arabic references, virtues and notes (extracts of the chapter footnotes; hadith numbers that pointed at another hadith are corrected). Where the book's footnote lacks a citation, the Arabic is not quoted but assembled from the book's own phrases with the other number (among them Ayat al-Kursi and 'Bismika rabbi' before sleep; scripts/azkar/verify.mjs lists every one), and so is the Arabic of the note on the prostration in Surah as-Sajdah. Also the vocalised text of two supplications before sleep, and single words that complete asellam's vocalisation or word order in two others",
  },
  {
    name: 'asellam/HisnElMuslim',
    url: blob('asellam/HisnElMuslim', ASELLAM, 'hisn.json'),
    license: 'MIT License — Copyright (c) 2021 Abdellah SELLAM',
    usedFor:
      "Vocalised Arabic text of the supplications and of the tasbih formulas, including the separate evening wordings, the isti'adha before Ayat al-Kursi and the last two ayat of al-Baqarah, and the Arabic of the note on blowing into the palms before sleep",
  },
  {
    name: 'Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    url: blob('Seen-Arabic/Morning-And-Evening-Adhkar-DB', SEEN, 'ar.json'),
    license: 'MIT License — Copyright (c) 2024 Seen Arabic',
    usedFor:
      'Three words whose vowel marks complete the text above, the closing part of one Arabic reference, and cross-checking of every morning and evening supplication',
  },
  {
    name: 'fawazahmed0/hadith-api — Arabic text of Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud and Jami at-Tirmidhi',
    url: `https://github.com/fawazahmed0/hadith-api/tree/${HADITH_API}/editions`,
    license: 'The Unlicense (public domain)',
    usedFor:
      'The hadiths that narrate the supplications (Sahih Muslim no. 2723 among them), against which each is checked word by word; the vowel marks of one word before sleep (at-Tirmidhi no. 3401); the Arabic of two notes, quoted from al-Bukhari no. 6320 and at-Tirmidhi nos. 3401 and 3474; and checking the hadith numbers quoted in the references',
  },
  {
    name: 'Tanzil Quran Text (Simple Plain, version 1.1), retrieved through the Al Quran Cloud API (edition quran-simple)',
    url: 'https://tanzil.net/',
    license:
      'Creative Commons Attribution 3.0 — Copyright © Tanzil Project; the text is reproduced verbatim and may not be changed',
    usedFor:
      "Every Qur'anic passage, with its pause marks and its sajdah and rub' al-hizb signs: Ayat al-Kursi (2:255), the last two ayat of al-Baqarah (2:285-286), Surah as-Sajdah (32), Surah al-Mulk (67), surahs 112 to 114, and the basmala (1:1)",
    notice: TANZIL_NOTICE,
  },
]
