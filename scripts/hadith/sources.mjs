// The Riyad as-Salihin text the hadith library is built from, pinned to an exact revision.
//
// `raw/` holds the inputs of build.mjs, each pinned by sha256, which is checked on every build so
// that a silent upstream change cannot alter the library. Only the licence is committed: each
// hadith file also carries an English translation (Darussalam's, which is under copyright and is
// never used here), so the files are not redistributed from this repository (raw/.gitignore).
// Run `node scripts/hadith/fetch.mjs` once to download them before building.

const REPO = 'CheeseWithSauce/HadithsJSONFormat'
const COMMIT = '1ef8f97ac41cd04845081de79529d879966c6fbc'

const gh = (path) => `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${path}`
const DIR = 'raw/cheesewithsauce-hadiths-json'

/** The twenty files of Riyad as-Salihin: the Introduction (book 0, "the book of miscellany" upstream) and books 1 to 19. */
const FILES = {
  'the_book_of_miscellany.json': '3704065ad97ae69d70bd8a740438d15334ddc3b8ac93f47e543827f4fb41dee8',
  '001_the_book_of_good_manners.json': '24d3f1b66b0b1c8ede9bc4c53d724593fb85d91d5c6085abc52de12c0a52fc64',
  '002_the_book_about_the_etiquette_of_eating.json': '7808dd4017ac233460a9adc0077d2c8b62dcc3fc0914fa99a224d50f7130f2f1',
  '003_the_book_of_dress.json': '248650a2de78dd9d3d17b756d76625f68c2ccf5fb884e1391355da2730add92c',
  '004_the_book_of_the_etiquette_of_sleeping_lying_and_sitting_etc.json': '36bc340e7bd8db0ca15982216ba0bbfdd0200e89937bbc551f6a7151678b4517',
  '005_the_book_of_greetings.json': '224bf3fc0e29cdba8ad0c27a01a3085f8cd8130d73eccb0bde5eeeef214ab123',
  '006_the_book_of_visiting_the_sick.json': '29182eca048388ecf2a11c66c74ee1cd3b458f31ced776bebb7d5409d3537f6c',
  '007_the_book_of_etiquette_of_traveling.json': '8a20e775d0ef7744d2abd7c56fcfed1e78cbd0d46e5018d5f71261acfbb12666',
  '008_the_book_of_virtues.json': '59fd0a5967d8bd23c202b2cd698dd02b5d38c11f5cb4b8ff36c8c8c0bd5dd580',
  '009_the_book_of_itikaf.json': 'e46c9cbb9f5336cdfdf8ee77076def2b91d2bf74f3e7ce113bc0c1a5cbc54674',
  '010_the_book_of_hajj.json': '4fb8180b0c646c539de3975f061a8a7f39f129721914ae63235452b322cc9db6',
  '011_the_book_of_jihad.json': 'a3a73523783de91a213b3c432a1c36258542087924e7e92d8ab242ca4025fd32',
  '012_the_book_of_knowledge.json': '54b4e9dba577020a53d4f43803f88dfad973c8bb68a568df13a7d0199960ecb4',
  '013_the_book_of_praise_and_gratitude_to_allah.json': 'c6877acf394251a3aca2b6fd03f0b731b9594bac4e95a94c83ce90c4359b1e6d',
  '014_the_book_of_supplicating_allah_to_exalt_the_mention_of_allahs_messenger.json': 'c2a106be9325209bd1dceadbd6c877043c8feaa354496ccd0efc2c93eb5a2dac',
  '015_the_book_of_the_remembrance_of_allah.json': '93c9614570dcef8a97a8a83bcb6e8ebaffeb87e8a0913c0497d423a158dac8fc',
  '016_the_book_of_dua_supplications.json': '8ea8d5a8e1cf8b7c21060fdd019130bbda25a1fa902f9afb00d8875e5ad2decd',
  '017_the_book_of_the_prohibited_actions.json': '9439169a0b17a839043054ca6945f29f8544fb5ee96fb3a7d82baef86eee6c50',
  '018_the_book_of_miscellaneous_ahadith_of_significant_values.json': '4192ef7ca1d239bad09f41114fcf1b729e9604deb7af1fbed43c0ff0380ed553',
  '019_the_book_of_forgiveness.json': 'e349acddbc60bee9f0133fc8a823f6ded4a57e91c432951d583ce90c57f7ba20',
}

/** Inputs of build.mjs, each pinned by sha256. */
export const RAW = [
  ...Object.entries(FILES).map(([name, sha256]) => ({
    path: `${DIR}/riyadussalihin/${name}`,
    url: gh(`Sunnah/riyadussalihin/${name}`),
    sha256,
  })),
  {
    path: `${DIR}/LICENSE`,
    url: gh('LICENSE'),
    sha256: '876e19fbb4b20ad0bb2fa409e5a4319976b4c0976f973ee3b3e3b9b4f0ae0fa3',
  },
]

/** The hadith files among RAW, in no particular order (build.mjs orders by number). */
export const HADITH_FILES = RAW.filter((entry) => entry.path.endsWith('.json'))

/**
 * English names of the twenty books, written for this project (short descriptions, not the
 * translation the source carries). The Arabic titles come from the source files.
 */
export const BOOK_NAMES = {
  0: 'Introduction',
  1: 'Good manners',
  2: 'Etiquette of eating',
  3: 'Dress',
  4: 'Sleeping, lying and sitting',
  5: 'Greetings',
  6: 'Visiting the sick and funerals',
  7: 'Etiquette of travel',
  8: 'Virtues',
  9: "I'tikaf",
  10: 'Hajj',
  11: 'Jihad',
  12: 'Knowledge',
  13: 'Praising and thanking Allah',
  14: 'Blessings on the Prophet',
  15: 'Remembrance of Allah',
  16: 'Supplications',
  17: 'Prohibited matters',
  18: 'Hadith of special value',
  19: 'Seeking forgiveness',
}

/** Credits written into riyad.json and shown to users. */
export const SOURCES = [
  {
    name: 'Riyad as-Salihin (The Gardens of the Righteous) by Imam Yahya ibn Sharaf an-Nawawi',
    url: 'https://sunnah.com/riyadussalihin',
    license:
      "The Arabic text of a classical work; numbered as on sunnah.com, from whose Arabic text the source repository's files were made",
    usedFor: 'The 1,896 hadith of the Introduction and the nineteen books, their numbering and the Arabic titles of the books',
  },
  {
    name: `${REPO}`,
    url: `https://github.com/${REPO}/tree/${COMMIT}/Sunnah/riyadussalihin`,
    license: 'MIT License — Copyright (c) 2025 CheeseWithSauce',
    usedFor:
      'The digital Arabic text of every hadith, shown as given (about 44% of it carries vowel marks), with the source note at its end (such as "agreed upon", meaning narrated by al-Bukhari and Muslim), shown apart as its takhrij. Only the Arabic is used: the English translation in the same files is not included',
  },
]
