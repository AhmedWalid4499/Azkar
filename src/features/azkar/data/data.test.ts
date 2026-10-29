import { describe, expect, it } from 'vitest'
import fingerprintFixture from './fixtures/arabic-fingerprints.json'
import quranFixture from './fixtures/quran.json'
import tanzilPinFixture from './fixtures/quran-tanzil-sha256.json'
import {
  COLLECTION_IDS,
  availableCollections,
  azkarData,
  getAfterPrayerAzkar,
  getCollection,
  getTasbihPresets,
} from './index'
import type { AfterPrayerName, Bilingual, Dhikr, QuranRef } from './index'

// These tests guard text that people recite. They are meant to fail loudly if azkar.json is ever
// damaged: by a hand edit, a bad merge, an encoding accident, or a careless rebuild.
// The dataset is produced by `node scripts/azkar/build.mjs`; never edit the Arabic by hand.

/** Canonical ayah texts (Tanzil), keyed "surah:ayah". Written by the build. */
const ayat: Record<string, string> = quranFixture
/**
 * sha256 of each of those ayat in the file downloaded from tanzil.net itself, written by
 * `node scripts/azkar/pin-quran.mjs` and never by the build: the independent half of the check.
 */
const tanzilPins: Record<string, string> = tanzilPinFixture
/** One fingerprint per recited text, written by the build. */
const fingerprints: Record<string, string> = fingerprintFixture

const items = Object.values(azkarData.items)
const collections = Object.entries(azkarData.collections)

// What a recited text may contain, spelled out so that anything else is caught:
// stray Latin, digits, tatweel, presentation-form ligatures, mojibake, invisible controls.
const ARABIC_LETTERS = '\u0621-\u063A\u0641-\u064A'
/** Tanwin, fatha, damma, kasra, shadda, sukun, and the superscript alef. */
const VOWEL_MARKS = '\u064B-\u0652\u0670'
/** The small high pause marks printed in the Qur'an text. */
const QURAN_PAUSE_MARKS = '\u06D6-\u06DC'
/** Arabic comma, full stop, colon. */
const PUNCTUATION = '\u060C.:'
const RECITED_TEXT = new RegExp(`^[${ARABIC_LETTERS}${VOWEL_MARKS}${QURAN_PAUSE_MARKS}${PUNCTUATION} \\n]+$`)
/**
 * The two signs the Tanzil text prints beside some ayat, which are not letters or marks: the
 * rub' al-hizb sign opening an ayah that begins a quarter, and the sajdah sign closing an ayah of
 * prostration. Qur'anic text keeps them verbatim; nothing else may contain them.
 */
const RUB_AL_HIZB = '\u06DE'
const SAJDAH = '\u06E9'
const QURANIC_TEXT = new RegExp(
  `^[${ARABIC_LETTERS}${VOWEL_MARKS}${QURAN_PAUSE_MARKS}${PUNCTUATION}${RUB_AL_HIZB}${SAJDAH} \\n]+$`,
)
/** Where the signs stand: the rub' al-hizb sign and a space open an ayah, a space and the sajdah sign close it. */
const SIGN_PLACES = new RegExp(`^(?:${RUB_AL_HIZB} )?[^${RUB_AL_HIZB}${SAJDAH}]+(?: ${SAJDAH})?$`)
const ARABIC_LETTER = new RegExp(`[${ARABIC_LETTERS}]`, 'g')
const VOWEL_MARK = new RegExp(`[${VOWEL_MARKS}]`, 'g')
const ANY_ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BASMALA_KEY = '1:1'

/**
 * The number of ayat in each surah the dataset recites whole, written here from the mushaf and
 * not read from any file, so that a surah cut short in both the item and the fixture cannot pass.
 */
const SURAH_LENGTHS: Record<number, number> = { 32: 30, 67: 30, 112: 4, 113: 5, 114: 6 }

/**
 * Ayat made of the disconnected letters that open a surah, read letter by letter by name. The
 * mushaf and Tanzil print them without vowel marks, so the completeness check skips such a line.
 */
const OPENING_LETTERS = ['32:1']

/** The five obligatory prayers, in the order of the day. */
const PRAYERS: AfterPrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

/**
 * Items that are parts of one narration, recited one after the other, each with its own count so
 * that the counter is truthful. They cite the same hadith, which is not otherwise allowed.
 */
const SPLIT_NARRATIONS: string[][] = [
  ['astaghfirullah', 'allahumma-antas-salam'],
  ['la-ilaha-illallah-wahdahu-three-times', 'allahumma-la-mania-lima-atayt'],
  ['subhanallah', 'alhamdulillah', 'allahu-akbar', 'la-ilaha-illallah-wahdahu-to-complete-a-hundred'],
  ['sleep-subhanallah', 'sleep-alhamdulillah', 'sleep-allahu-akbar'],
  ['surah-as-sajdah', 'surah-al-mulk'],
]

/**
 * Fingerprint of the one line of a Qur'anic item that is not Qur'an: the isti'adha recited before
 * Ayat al-Kursi. Fixed here so that nothing else can be slipped in front of an ayah.
 */
const ISTIADHA_FINGERPRINT = 'a258bfef'

/**
 * Notes that are this project's remarks, which no source words in Arabic: their Arabic side is
 * empty and the reader shows the English. Every other note is bilingual.
 */
const ENGLISH_ONLY_NOTES = ['after-prayer-al-ikhlas-al-falaq-an-nas']

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** FNV-1a, 32 bits, over UTF-16 code units: the same function as scripts/azkar/lib/arabic.mjs. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const splitKey = (key: string): [number, number] => {
  const [surah = 0, ayah = 0] = key.split(':').map(Number)
  return [surah, ayah]
}

function ayahText(surah: number, ayah: number): string {
  const text = ayat[`${surah}:${ayah}`]
  if (text === undefined) throw new Error(`fixtures/quran.json has no ayah ${surah}:${ayah}`)
  return text
}

function ayatOf(ref: QuranRef): string[] {
  const texts: string[] = []
  for (let ayah = ref.from; ayah <= ref.to; ayah += 1) texts.push(ayahText(ref.surah, ayah))
  return texts
}

function expectBilingual(field: Bilingual, label: string) {
  expect(field.en.trim(), `${label}.en`).not.toBe('')
  expect(field.ar.trim(), `${label}.ar`).not.toBe('')
  expect(field.en, `${label}.en has no Arabic script`).not.toMatch(ANY_ARABIC)
  expect(field.ar, `${label}.ar has Arabic script`).toMatch(ANY_ARABIC)
  expect(field.ar, `${label}.ar has no Latin letters`).not.toMatch(/[A-Za-z]/)
  expect(field.en, `${label}.en is tidy`).toBe(squash(field.en))
  expect(field.ar, `${label}.ar is tidy`).toBe(squash(field.ar))
}

// --- completeness of the vocalisation (the same rules as scripts/azkar/lib/arabic.mjs) ----------

interface Letter {
  base: string
  marks: string
}

const IS_LETTER = new RegExp(`[${ARABIC_LETTERS}]`)
const IS_MARK = new RegExp(`[${VOWEL_MARKS}${QURAN_PAUSE_MARKS}]`)
const SHORT_VOWEL = /[\u064B-\u0650]/
const SHADDA = '\u0651'
const ALEF_MAQSURA = '\u0649'
/** Letters that may stand without a mark: the long vowels and the alef forms that carry none. */
const MAY_BE_BARE = /[\u0627\u0648\u064A\u0649\u0622]/
/**
 * The article, after any one-letter prefixes: its lam is silent or assimilated and often left bare.
 * After the preposition "li" the article loses its alef ("lil-", "lish-"), as in 67:5.
 */
const ARTICLE = /^(?:[\u0648\u0641\u0628\u0643\u0644]{0,2}\u0627\u0644|[\u0648\u0641]?\u0644\u0644)/
/** The letters the lam of the article is assimilated to; they are doubled after it. */
const SUN_LETTER = /[\u062A\u062B\u062F-\u0638\u0644\u0646]/

/** Words as letters, each with the marks typed after it. */
function lettersOf(text: string): Letter[][] {
  const words: Letter[][] = []
  let word: Letter[] | null = null
  for (const character of text) {
    if (IS_LETTER.test(character)) {
      if (!word) words.push((word = []))
      word.push({ base: character, marks: '' })
    } else if (IS_MARK.test(character)) {
      const last = word?.at(-1)
      if (last) last.marks += character
    } else {
      word = null
    }
  }
  return words
}

/** Every place where the vocalisation of `text` is incomplete or mistyped. */
function incompleteVocalisation(text: string): string[] {
  const found: string[] = []
  for (const letters of lettersOf(text)) {
    const word = letters.map((letter) => letter.base + letter.marks).join('')
    const bases = letters.map((letter) => letter.base).join('')
    const articleLam = (ARTICLE.exec(bases)?.[0].length ?? 0) - 1
    letters.forEach((letter, index) => {
      if (letter.marks.includes(SHADDA) && !SHORT_VOWEL.test(letter.marks)) {
        found.push(`${word}: shadda without a vowel`)
      } else if (letter.marks === '' && !MAY_BE_BARE.test(letter.base) && index !== articleLam) {
        found.push(`${word}: letter ${index + 1} carries no mark`)
      }
      if (letter.base === ALEF_MAQSURA && index < letters.length - 1) {
        found.push(`${word}: alef maqsura in the middle of the word`)
      }
    })
    const lam = letters[articleLam]
    const afterArticle = letters[articleLam + 1]
    if (articleLam > 0 && lam?.marks === '' && afterArticle) {
      if (SUN_LETTER.test(afterArticle.base) && !afterArticle.marks.includes(SHADDA)) {
        found.push(`${word}: sun letter after the article is not doubled`)
      }
    }
  }
  return found
}

// --- citations ----------------------------------------------------------------------------------

/** Every number in a text, sorted, so that two languages can be compared. */
const numbersIn = (text: string) => (text.match(/[0-9]+/g) ?? []).sort()

/**
 * The numbered citations of an English reference as "collection #number", e.g.
 * "abu dawud #5069" for "Abu Dawud 4/317 (no. 5069)". Volume and page are left out of the key.
 */
function citations(reference: string): string[] {
  const found: string[] = []
  for (const match of reference.matchAll(/([^;.:()]+)\(([^()]*?)nos?\. ([^()]+)\)/g)) {
    const [, before = '', inside = '', numbers = ''] = match
    const collection = `${before} ${inside}`
      .replace(/[0-9]+\/[0-9]+( and [0-9]+)?/g, ' ')
      .replace(/ in 'Amal al-Yawm wal-Laylah/g, '')
      .replace(/[,\s]+/g, ' ')
      .trim()
      .toLowerCase()
    for (const number of numbers.match(/[0-9]+/g) ?? []) found.push(`${collection} #${number}`)
  }
  return found
}

// --- transliteration ----------------------------------------------------------------------------

/** Latin letters with the macrons and underdots of the scheme, ayn and hamza, and plain punctuation. */
const TRANSLITERATION = /^[A-Za-z\u0100\u0101\u012B\u016B\u02BE\u02BF\u1E0D\u1E24\u1E25\u1E63\u1E6D\u1E93 ,.:-]+$/
/** Names that keep a capital inside a sentence: Allah, Muhammad, Ibrahim, Musa, Isra'il. */
const PROPER_NAME = /^(All\u0101h|Mu\u1E25ammad|Ibr\u0101h\u012Bm|M\u016Bs\u0101|M\u016Bsal|Isr\u0101\u02BE\u012Bl)/

describe('adhkar dataset', () => {
  it('is not the placeholder any more', () => {
    expect(azkarData.version).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(azkarData)).not.toMatch(/placeholder/i)
  })

  it('credits its sources with https links', () => {
    expect(azkarData.sources.length).toBeGreaterThan(0)
    for (const source of azkarData.sources) {
      expect(source.name.trim()).not.toBe('')
      expect(source.license.trim()).not.toBe('')
      expect(source.usedFor.trim()).not.toBe('')
      expect(source.url).toMatch(/^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/)
    }
    // Tanzil's terms require the source to be named and linked wherever its text is used, and its
    // copyright block to be reproduced in a file holding a substantial portion of the text.
    const tanzil = azkarData.sources.find((source) => source.url.startsWith('https://tanzil.net'))
    expect(tanzil).toBeDefined()
    expect(tanzil?.notice).toMatch(/^# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK\n/)
    expect(tanzil?.notice).toContain('#  Tanzil Quran Text (Simple Plain, Version 1.1)\n')
    expect(tanzil?.notice).toContain('CHANGING IT IS NOT ALLOWED')
    expect(tanzil?.notice).toMatch(/\n#={68}$/)
  })

  it('names the holder of every MIT copyright, and claims no licence over the book itself', () => {
    for (const source of azkarData.sources) {
      // The MIT licence asks for its copyright line to travel with the copies.
      if (/\bMIT\b/.test(source.license)) expect(source.license, source.name).toMatch(/Copyright \(c\) \d{4} \S+/)
      // A repository's licence covers the repository, not a published book stored inside it.
      expect(source.license, source.name).not.toMatch(/^MIT \(repository\)$/)
    }
  })

  it('keys every item by its own id, a unique kebab-case slug', () => {
    const ids = new Set<string>()
    for (const [key, item] of Object.entries(azkarData.items)) {
      expect(item.id).toBe(key)
      expect(item.id).toMatch(SLUG)
      ids.add(item.id)
    }
    expect(ids.size).toBe(items.length)
    expect(items.length).toBeGreaterThan(0)
  })

  it('has morning, evening and sleep collections of a plausible size, with every id resolving', () => {
    for (const [id, ids] of collections) {
      expect(COLLECTION_IDS).toContain(id)
      expect(ids.length, `${id} is not empty`).toBeGreaterThan(0)
      expect(new Set(ids).size, `${id} has no duplicates`).toBe(ids.length)
      for (const dhikrId of ids) expect(azkarData.items[dhikrId], `${id}: ${dhikrId}`).toBeDefined()
    }
    for (const id of COLLECTION_IDS) expect(() => getCollection(id)).not.toThrow()
    expect(availableCollections()).toEqual(['morning', 'evening', 'sleep'])

    // The reference chapter of Hisn al-Muslim has 24 entries; a few are morning-only or evening-only.
    for (const id of ['morning', 'evening'] as const) {
      const size = getCollection(id).length
      expect(size, `${id} size`).toBeGreaterThanOrEqual(18)
      expect(size, `${id} size`).toBeLessThanOrEqual(28)
    }
    // The sleep chapter has 13 entries; the tasbih and the two surahs are split into their parts.
    const sleep = getCollection('sleep').length
    expect(sleep, 'sleep size').toBeGreaterThanOrEqual(13)
    expect(sleep, 'sleep size').toBeLessThanOrEqual(20)
  })

  it('uses every item in at least one collection or list, and keeps time-bound wordings in their session', () => {
    const used = new Set([
      ...collections.flatMap(([, ids]) => ids),
      ...(azkarData.afterPrayer ?? []),
      ...(azkarData.tasbih ?? []),
    ])
    for (const item of items) expect(used.has(item.id), `${item.id} is in a collection or list`).toBe(true)

    const morning = new Set(azkarData.collections.morning)
    const evening = new Set(azkarData.collections.evening)
    for (const item of items) {
      if (item.id.startsWith('morning-')) expect(evening.has(item.id), item.id).toBe(false)
      if (item.id.startsWith('evening-')) expect(morning.has(item.id), item.id).toBe(false)
    }
  })

  it('does not ask twice for a count that is a total for the whole day', () => {
    const morning = new Set(azkarData.collections.morning)
    const evening = new Set(azkarData.collections.evening)
    for (const item of items) {
      // "One hundred times during the day" listed in both sessions would ask for two hundred.
      if (morning.has(item.id) && evening.has(item.id)) {
        expect(item.note?.en ?? '', item.id).not.toMatch(/\b(a|the|per|each|every) day\b|\bdaily\b/i)
      }
    }
  })

  it.each(items)('$id has complete fields', (item: Dhikr) => {
    expect(Number.isInteger(item.repeat) && item.repeat >= 1, 'repeat is a positive integer').toBe(true)
    expect(item.arabic.trim(), 'arabic').not.toBe('')
    expect(item.translation.trim(), 'translation').not.toBe('')
    expect(item.translation, 'translation has no Arabic script').not.toMatch(ANY_ARABIC)
    expect(item.translation, 'translation is tidy').toBe(squash(item.translation))

    expect(item.transliteration?.trim() ?? '', 'transliteration').not.toBe('')
    expect(item.transliteration, 'transliteration has no Arabic script').not.toMatch(ANY_ARABIC)

    expectBilingual(item.reference, 'reference')
    if (item.virtue) expectBilingual(item.virtue, 'virtue')
    if (item.note && ENGLISH_ONLY_NOTES.includes(item.id)) {
      expect(item.note.ar).toBe('')
      expect(item.note.en.trim()).not.toBe('')
      expect(item.note.en).not.toMatch(ANY_ARABIC)
      expect(item.note.en, 'an English-only note quotes no number').not.toMatch(/[0-9]/)
    } else if (item.note) expectBilingual(item.note, 'note')
  })

  it.each(items)('$id is recited from clean, vocalised Arabic', (item: Dhikr) => {
    expect(item.arabic).toMatch(item.quran ? QURANIC_TEXT : RECITED_TEXT)
    for (const line of item.arabic.split('\n')) expect(line).toMatch(SIGN_PLACES)
    // Single spaces only, no blank lines, nothing dangling at either end of a line.
    expect(item.arabic).not.toMatch(/ {2}|\n\n|^[ \n]|[ \n]$| \n|\n /)

    // Fully vocalised text carries roughly one mark per letter; unvocalised text carries none.
    const letters = item.arabic.match(ARABIC_LETTER)?.length ?? 0
    const marks = item.arabic.match(VOWEL_MARK)?.length ?? 0
    expect(marks / letters, 'vowel marks per letter').toBeGreaterThan(0.6)
  })

  it.each(items)('$id leaves no letter without its mark', (item: Dhikr) => {
    // A shadda with no vowel, a consonant with no mark, a relative pronoun without its shadda,
    // an alef maqsura typed for a ya: each of these was once copied in from a source.
    const exempt = new Set(item.quran ? OPENING_LETTERS.map((key) => ayahText(...splitKey(key))) : [])
    const lines = item.arabic.split('\n').filter((line) => !exempt.has(line))
    expect(incompleteVocalisation(lines.join('\n'))).toEqual([])
    // A vowel or shadda is typed on its consonant, never after the alef that follows it.
    expect(item.arabic).not.toMatch(/\u0627[\u064E\u0651]/)
  })

  it.each(items)('$id still has the Arabic the build produced', (item: Dhikr) => {
    // A changed fingerprint means the recited text changed. If that was intended, rebuild with
    // `node scripts/azkar/build.mjs`, which rewrites the fixture; never adjust it by hand.
    expect(fingerprint(item.arabic)).toBe(fingerprints[item.id])
  })

  it('has a fingerprint for every item and no stale ones', () => {
    expect(Object.keys(fingerprints).sort()).toEqual(items.map((item) => item.id).sort())
  })

  it.each(items)('$id is transliterated in the one scheme', (item: Dhikr) => {
    const text = item.transliteration ?? ''
    expect(text).toMatch(TRANSLITERATION)
    expect(text, 'starts with a capital and ends with a full stop').toMatch(/^[A-Z\u0100\u1E24].*\.$/s)
    expect(text, 'single spaces').toBe(squash(text))
    // Inside a sentence only proper names are capitalised; divine attributes are not.
    for (const sentence of text.split(/(?<=\.) /)) {
      const words = sentence.split(/[ -]/).slice(1)
      for (const word of words) {
        if (/^[A-Z\u0100\u1E24]/.test(word)) expect(word, `capital inside "${sentence}"`).toMatch(PROPER_NAME)
      }
    }
  })
})

describe('references', () => {
  it.each(items)('$id quotes the same numbers in English and in Arabic', (item: Dhikr) => {
    expect(numbersIn(item.reference.ar)).toEqual(numbersIn(item.reference.en))
    if (item.virtue) expect(numbersIn(item.virtue.ar)).toEqual(numbersIn(item.virtue.en))
  })

  it.each(items)('$id separates a volume and page from the next word', (item: Dhikr) => {
    // "4/2071 <word>": a comma was dropped between the page and what follows it.
    expect(item.reference.ar).not.toMatch(new RegExp(`[0-9]+/[0-9]+ [${ARABIC_LETTERS}]`))
    // "/ 2075": a volume number was lost in front of the page.
    expect(item.reference.ar).not.toMatch(/(^|[^0-9])\/ ?[0-9]/)
    expect(item.reference.en).not.toMatch(/(^|[^0-9])\/ ?[0-9]/)
  })

  it('never gives one hadith number to two different adhkar', () => {
    const cited = new Map<string, string[]>()
    for (const item of items) {
      for (const citation of new Set(citations(item.reference.en))) {
        cited.set(citation, [...(cited.get(citation) ?? []), item.id])
      }
    }
    // The parser must actually see the citations, or this test would pass on nothing.
    expect(cited.size).toBeGreaterThan(40)
    expect(cited.has('abu dawud #5069')).toBe(true)
    expect(cited.has("an-nasa'i #9")).toBe(true)
    expect(cited.has('ahmad #15363')).toBe(true)
    expect(cited.has('ibn hibban mawarid #2361')).toBe(true)
    expect(cited.has('muslim #597')).toBe(true)
    expect(cited.has('at-tirmidhi #3404')).toBe(true)
    for (const [citation, ids] of cited) {
      if (ids.length === 1) continue
      // One hadith may carry the morning and the evening wording of the same dhikr, or the parts of
      // one narration that are recited one after the other (SPLIT_NARRATIONS), nothing more.
      const parts = SPLIT_NARRATIONS.find((group) => group.includes(ids[0] ?? ''))
      if (parts && ids.every((id) => parts.includes(id))) continue
      const sessions = ids.map((id) => id.split('-')[0]).sort()
      expect({ citation, sessions }, ids.join(', ')).toEqual({ citation, sessions: ['evening', 'morning'] })
    }
  })

  it('declares as parts of one narration only items that cite the same hadith', () => {
    for (const group of SPLIT_NARRATIONS) {
      const [first, ...rest] = group.map((id) => {
        const item = azkarData.items[id]
        expect(item, id).toBeDefined()
        return new Set(citations(item?.reference.en ?? ''))
      })
      const shared = [...(first ?? [])].filter((citation) => rest.every((other) => other.has(citation)))
      expect(shared.length, group.join(', ')).toBeGreaterThan(0)
    }
  })
})

describe("Qur'anic passages", () => {
  const quranic = items.filter((item) => item.quran !== undefined)

  it('exist in the dataset', () => {
    expect(quranic.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'ayat-al-kursi',
        'al-ikhlas-al-falaq-an-nas',
        'after-prayer-ayat-al-kursi',
        'after-prayer-al-ikhlas-al-falaq-an-nas',
        'sleep-al-ikhlas-al-falaq-an-nas',
        'sleep-ayat-al-kursi',
        'last-two-ayat-of-al-baqarah',
        'surah-as-sajdah',
        'surah-al-mulk',
      ]),
    )
  })

  it('give Ayat al-Kursi and the three surahs the same text wherever they are recited', () => {
    const textOf = (id: string) => azkarData.items[id]?.arabic
    expect(textOf('after-prayer-ayat-al-kursi')).toBe(textOf('ayat-al-kursi'))
    expect(textOf('sleep-ayat-al-kursi')).toBe(textOf('ayat-al-kursi'))
    expect(textOf('after-prayer-al-ikhlas-al-falaq-an-nas')).toBe(textOf('al-ikhlas-al-falaq-an-nas'))
    expect(textOf('sleep-al-ikhlas-al-falaq-an-nas')).toBe(textOf('al-ikhlas-al-falaq-an-nas'))
  })

  it('come from a fixture of well-formed canonical ayat', () => {
    expect(ayat[BASMALA_KEY]).toBeDefined()
    for (const [key, text] of Object.entries(ayat)) {
      expect(key).toMatch(/^\d+:\d+$/)
      expect(text).toMatch(QURANIC_TEXT)
      expect(text).toMatch(SIGN_PLACES)
      expect(text).toBe(squash(text))
    }
  })

  it('pin every ayah, and only those, to the tanzil.net download', () => {
    expect(Object.keys(tanzilPins).sort()).toEqual(Object.keys(ayat).sort())
  })

  it.each(Object.keys(ayat))('%s is the text tanzil.net publishes', async (key) => {
    expect(await sha256(ayat[key] ?? '')).toBe(tanzilPins[key])
  })

  it.each(quranic)('$id is exactly its ayat, in order, and nothing else', (item: Dhikr) => {
    const refs = item.quran ?? []
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) expect(ref.from, 'ayah range').toBeLessThanOrEqual(ref.to)

    // One ayah to a line; each complete surah opens with the basmala on a line of its own.
    const wholeSurahs = refs.every((ref) => ref.from === 1 && ref.to === SURAH_LENGTHS[ref.surah])
    const expected = wholeSurahs ? refs.flatMap((ref) => [ayahText(1, 1), ...ayatOf(ref)]) : refs.flatMap(ayatOf)

    const lines = item.arabic.split('\n')
    // The only line allowed in front of the Qur'an is the isti'adha, and only before a lone passage.
    const opening = lines.length - expected.length
    expect(opening === 0 || (opening === 1 && !wholeSurahs), 'lines before the passage').toBe(true)
    if (opening === 1) expect(fingerprint(lines[0] ?? '')).toBe(ISTIADHA_FINGERPRINT)
    expect(lines.slice(opening)).toEqual(expected)
  })

  it('keep the signs of the Tanzil text where Tanzil prints them', () => {
    // Tanzil's terms forbid changing the text: the sign of the quarter that opens 32:11 and the
    // sign of the prostration that closes 32:15 are part of it, and no other recited ayah has one.
    const signed = Object.entries(ayat).filter(([, text]) => text.includes(RUB_AL_HIZB) || text.includes(SAJDAH))
    expect(signed.map(([key]) => key)).toEqual(['32:11', '32:15'])
    expect(ayat['32:11']?.startsWith(`${RUB_AL_HIZB} `)).toBe(true)
    expect(ayat['32:15']?.endsWith(` ${SAJDAH}`)).toBe(true)
    const lines = azkarData.items['surah-as-sajdah']?.arabic.split('\n') ?? []
    expect(lines[11]).toBe(ayat['32:11'])
    expect(lines[15]).toBe(ayat['32:15'])
    for (const item of items.filter((candidate) => candidate.quran === undefined)) {
      expect(item.arabic, item.id).not.toMatch(new RegExp(`[${RUB_AL_HIZB}${SAJDAH}]`))
    }
  })

  it('tell the reader of Surah as-Sajdah where to prostrate', () => {
    const note = azkarData.items['surah-as-sajdah']?.note
    expect(note?.en).toMatch(/\b15\b.*prostration/)
    expect(numbersIn(note?.ar ?? '')).toEqual(['15'])
  })

  it('recite a surah whole whenever they begin it', () => {
    for (const item of quranic) {
      for (const ref of item.quran ?? []) {
        const length = SURAH_LENGTHS[ref.surah]
        if (length !== undefined) expect([ref.from, ref.to], `${item.id} surah ${ref.surah}`).toEqual([1, length])
      }
    }
  })

  it('leave no unused ayah in the fixture', () => {
    const used = new Set([BASMALA_KEY])
    for (const item of quranic) {
      for (const ref of item.quran ?? []) {
        for (let ayah = ref.from; ayah <= ref.to; ayah += 1) used.add(`${ref.surah}:${ayah}`)
      }
    }
    expect(Object.keys(ayat).sort()).toEqual([...used].sort())
  })
})

describe('after-prayer list', () => {
  const list = azkarData.afterPrayer ?? []
  const repeatsAfter = (prayer: AfterPrayerName) =>
    Object.fromEntries(getAfterPrayerAzkar(prayer).map((dhikr) => [dhikr.id, dhikr.repeat]))

  it('follows the chapter of remembrance after the salam, in its order', () => {
    // Hisn al-Muslim nos. 66 to 73. Entries that mix counts are split into their parts.
    expect(list).toEqual([
      'astaghfirullah',
      'allahumma-antas-salam',
      'la-ilaha-illallah-wahdahu-three-times',
      'allahumma-la-mania-lima-atayt',
      'la-ilaha-illallah-wa-la-nabudu-illa-iyyah',
      'subhanallah',
      'alhamdulillah',
      'allahu-akbar',
      'la-ilaha-illallah-wahdahu-to-complete-a-hundred',
      'after-prayer-al-ikhlas-al-falaq-an-nas',
      'after-prayer-ayat-al-kursi',
      'la-ilaha-illallah-yuhyi-wa-yumit-ten-times',
      'allahumma-inni-asaluka-ilman-nafian',
    ])
    for (const prayer of PRAYERS) expect(() => getAfterPrayerAzkar(prayer)).not.toThrow()
  })

  it('gives after-prayer rules only to items of the list, and only valid ones', () => {
    const listed = new Set(list)
    for (const item of items) {
      const rule = item.afterPrayer
      if (!rule) continue
      expect(listed.has(item.id), `${item.id} has a rule but is not in the list`).toBe(true)
      if (rule.prayers) {
        expect(rule.prayers.length, item.id).toBeGreaterThan(0)
        // Known prayers, each once, in the order of the day.
        expect(rule.prayers, item.id).toEqual(PRAYERS.filter((prayer) => rule.prayers?.includes(prayer)))
      }
      for (const [prayer, count] of Object.entries(rule.repeat ?? {})) {
        expect(rule.prayers ?? PRAYERS, `${item.id} counts ${prayer}`).toContain(prayer)
        expect(Number.isInteger(count) && count >= 1, `${item.id} count after ${prayer}`).toBe(true)
      }
      for (const key of Object.keys(rule)) expect(['prayers', 'repeat'], item.id).toContain(key)
    }
  })

  it('says the ten tahlils after Fajr and Maghrib only, and the supplication for knowledge after Fajr only', () => {
    for (const prayer of PRAYERS) {
      const repeats = repeatsAfter(prayer)
      const tenTimes = prayer === 'fajr' || prayer === 'maghrib'
      expect(repeats['la-ilaha-illallah-yuhyi-wa-yumit-ten-times'], prayer).toBe(tenTimes ? 10 : undefined)
      expect(repeats['allahumma-inni-asaluka-ilman-nafian'], prayer).toBe(prayer === 'fajr' ? 1 : undefined)
      expect(getAfterPrayerAzkar(prayer).length, prayer).toBe(11 + (tenTimes ? 1 : 0) + (prayer === 'fajr' ? 1 : 0))
    }
  })

  it('counts every split entry truthfully after every prayer', () => {
    for (const prayer of PRAYERS) {
      const repeats = repeatsAfter(prayer)
      // "Astaghfirullah" three times, then "Allahumma antas-salam" once (Muslim 591).
      expect(repeats.astaghfirullah, prayer).toBe(3)
      expect(repeats['allahumma-antas-salam'], prayer).toBe(1)
      // The tahlil three times (al-Bukhari 6473), then "Allahumma la mani'a" once.
      expect(repeats['la-ilaha-illallah-wahdahu-three-times'], prayer).toBe(3)
      expect(repeats['allahumma-la-mania-lima-atayt'], prayer).toBe(1)
      // Thirty-three of each, and the tahlil that completes the hundred (Muslim 597).
      const hundred = ['subhanallah', 'alhamdulillah', 'allahu-akbar'].map((id) => repeats[id] ?? 0)
      expect(hundred, prayer).toEqual([33, 33, 33])
      expect(repeats['la-ilaha-illallah-wahdahu-to-complete-a-hundred'], prayer).toBe(1)
      // The three surahs and Ayat al-Kursi once after every prayer.
      expect(repeats['after-prayer-al-ikhlas-al-falaq-an-nas'], prayer).toBe(1)
      expect(repeats['after-prayer-ayat-al-kursi'], prayer).toBe(1)
    }
  })

  it('recites each formula alone, without the conjunction that joins them in the book', () => {
    for (const id of ['subhanallah', 'alhamdulillah', 'allahu-akbar', 'astaghfirullah']) {
      const words = azkarData.items[id]?.arabic.split(' ') ?? []
      expect(words.length, id).toBe(2)
      expect(words[0]?.startsWith('و'), `${id} does not open with "wa"`).toBe(false)
    }
  })
})

describe('sleep session', () => {
  it('follows the chapter of the adhkar of sleep, in its order', () => {
    // Hisn al-Muslim nos. 99 to 111. The tasbih and the two surahs are split into their parts;
    // entry 11 is the morning and evening dhikr "Allahumma 'alimal-ghayb", word for word.
    expect(azkarData.collections.sleep).toEqual([
      'sleep-al-ikhlas-al-falaq-an-nas',
      'sleep-ayat-al-kursi',
      'last-two-ayat-of-al-baqarah',
      'bismika-rabbi-wadatu-janbi',
      'allahumma-innaka-khalaqta-nafsi',
      'allahumma-qini-adhabaka',
      'bismika-allahumma-amutu-wa-ahya',
      'sleep-subhanallah',
      'sleep-alhamdulillah',
      'sleep-allahu-akbar',
      'allahumma-rabbas-samawatis-sab',
      'alhamdu-lillahil-ladhi-atamana',
      'allahumma-alim-al-ghayb-wash-shahadah',
      'surah-as-sajdah',
      'surah-al-mulk',
      'allahumma-aslamtu-nafsi-ilayk',
    ])
  })

  it('counts thirty-three, thirty-three and thirty-four, and the three surahs three times', () => {
    const repeat = (id: string) => azkarData.items[id]?.repeat
    expect(['sleep-subhanallah', 'sleep-alhamdulillah', 'sleep-allahu-akbar'].map(repeat)).toEqual([33, 33, 34])
    expect(repeat('sleep-al-ikhlas-al-falaq-an-nas')).toBe(3)
    expect(repeat('allahumma-qini-adhabaka')).toBe(3)
  })

  it('describes in a note the actions around a recitation', () => {
    // Blowing into the palms and wiping the body; dusting the bed; the hand under the cheek;
    // ablution and lying on the right side.
    for (const id of [
      'sleep-al-ikhlas-al-falaq-an-nas',
      'bismika-rabbi-wadatu-janbi',
      'allahumma-qini-adhabaka',
      'allahumma-aslamtu-nafsi-ilayk',
    ]) {
      expect(azkarData.items[id]?.note, id).toBeDefined()
    }
  })

  it('renders Surah as-Sajdah and Surah al-Mulk ayah by ayah', () => {
    for (const id of ['surah-as-sajdah', 'surah-al-mulk']) {
      const item = azkarData.items[id]
      // The basmala and thirty ayat, each a sentence of the transliteration.
      expect(item?.arabic.split('\n').length, id).toBe(31)
      expect(item?.transliteration?.split(/(?<=\.) (?=[A-ZĀḤ])/).length, id).toBeGreaterThanOrEqual(31)
    }
  })
})

describe('tasbih presets', () => {
  const presets = getTasbihPresets()

  it('offer the short formulas, each an item of the dataset', () => {
    expect(azkarData.tasbih).toEqual([
      'subhanallah',
      'alhamdulillah',
      'allahu-akbar',
      'la-ilaha-illallah',
      'astaghfirullah',
      'allahumma-salli-wa-sallim-ala-nabiyyina-muhammad',
      'subhanallahi-wa-bihamdih',
    ])
    expect(new Set(presets.map((preset) => preset.arabic)).size).toBe(presets.length)
    for (const preset of presets) {
      expect(preset.quran, preset.id).toBeUndefined()
      expect(preset.arabic, preset.id).not.toMatch(/\n/)
      expect(preset.arabic.split(' ').length, preset.id).toBeLessThanOrEqual(6)
    }
  })
})
