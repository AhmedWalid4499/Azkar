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
    path: 'raw/tanzil-alquran-cloud/ayah-9-129.json',
    url: quran('ayah/9:129'),
    sha256: '2f35c521e3293f4aa2f3a3d80281e6f1e8c32f1994781b83200e58f8b522e5d1',
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
  {
    path: '.cache/tanzil-simple-plain.txt',
    url: 'https://tanzil.net/pub/download/index.php?quranType=simple-plain&marks=true&outType=txt-2&agree=true',
  },
  { path: '.cache/hisnmuslim-27.json', url: 'https://www.hisnmuslim.com/api/ar/27.json' },
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

/** Credits written into azkar.json and shown to users. */
export const SOURCES = [
  {
    name: "Hisn al-Muslim (Fortress of the Muslim) by Sa'id ibn Ali ibn Wahf al-Qahtani, published by Matba'at Safir, Riyadh — digital text with footnotes, read from abdorizak/Hisnul-Muslim",
    url: blob('abdorizak/Hisnul-Muslim', ABDORIZAK, 'Hisnul%20Muslim/Resources/hisnul_muslim.json'),
    license:
      'The book and its footnotes belong to their author and publisher; no licence is stated for the text. The repository it was read from is MIT-licensed (Copyright (c) 2023 Abdorizak Abdalla), which covers that repository, not the book. Only short citations and one-sentence virtues from the footnotes of one chapter are quoted here',
    usedFor:
      'Selection and order of the adhkar, repeat counts, and the Arabic references, virtues and notes (extracts of the chapter footnotes; hadith numbers that pointed at another hadith are corrected)',
  },
  {
    name: 'asellam/HisnElMuslim',
    url: blob('asellam/HisnElMuslim', ASELLAM, 'hisn.json'),
    license: 'MIT License — Copyright (c) 2021 Abdellah SELLAM',
    usedFor:
      "Vocalised Arabic text of every supplication, including the separate evening wordings, and the isti'adha before Ayat al-Kursi",
  },
  {
    name: 'Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    url: blob('Seen-Arabic/Morning-And-Evening-Adhkar-DB', SEEN, 'ar.json'),
    license: 'MIT License — Copyright (c) 2024 Seen Arabic',
    usedFor:
      'Three words whose vowel marks complete the text above, the closing part of one Arabic reference, and cross-checking of every supplication',
  },
  {
    name: 'fawazahmed0/hadith-api — Sahih Muslim, Arabic',
    url: blob('fawazahmed0/hadith-api', HADITH_API, 'editions/ara-muslim/6908.json'),
    license: 'The Unlicense (public domain)',
    usedFor:
      'Sahih Muslim no. 2723, the standard the evening supplication it narrates is checked against word by word, and checking the hadith numbers quoted in the references',
  },
  {
    name: 'Tanzil Quran Text (Simple Plain, version 1.1), retrieved through the Al Quran Cloud API (edition quran-simple)',
    url: 'https://tanzil.net/',
    license:
      'Creative Commons Attribution 3.0 — Copyright © Tanzil Project; the text is reproduced verbatim and may not be changed',
    usedFor: "Every Qur'anic passage: Ayat al-Kursi (2:255), surahs 112 to 114, and the basmala (1:1)",
  },
]
