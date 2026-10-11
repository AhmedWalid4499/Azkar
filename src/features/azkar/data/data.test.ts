import { describe, expect, it } from 'vitest'
import fingerprintFixture from './fixtures/arabic-fingerprints.json'
import quranFixture from './fixtures/quran.json'
import tanzilPinFixture from './fixtures/quran-tanzil-sha256.json'
import { COLLECTION_IDS, availableCollections, azkarData, getCollection } from './index'
import type { Bilingual, Dhikr, QuranRef } from './index'

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
const ARABIC_LETTER = new RegExp(`[${ARABIC_LETTERS}]`, 'g')
const VOWEL_MARK = new RegExp(`[${VOWEL_MARKS}]`, 'g')
const ANY_ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BASMALA_KEY = '1:1'

/**
 * The number of ayat in each surah the dataset recites whole, written here from the mushaf and
 * not read from any file, so that a surah cut short in both the item and the fixture cannot pass.
 */
const SURAH_LENGTHS: Record<number, number> = { 112: 4, 113: 5, 114: 6 }

/**
 * Fingerprint of the one line of a Qur'anic item that is not Qur'an: the isti'adha recited before
 * Ayat al-Kursi. Fixed here so that nothing else can be slipped in front of an ayah.
 */
const ISTIADHA_FINGERPRINT = 'a258bfef'

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
/** The article, after any one-letter prefixes: its lam is silent or assimilated and often left bare. */
const ARTICLE = /^[\u0648\u0641\u0628\u0643\u0644]{0,2}\u0627\u0644/
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
const TRANSLITERATION = /^[A-Za-z\u0101\u012B\u016B\u02BE\u02BF\u1E0D\u1E24\u1E25\u1E63\u1E6D\u1E93 ,.:-]+$/
/** Names that keep a capital inside a sentence: Allah, Muhammad, Ibrahim. */
const PROPER_NAME = /^(All\u0101h|Mu\u1E25ammad|Ibr\u0101h\u012Bm)/

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
    // Tanzil's terms require the source to be named and linked wherever its text is used.
    expect(azkarData.sources.some((source) => source.url.startsWith('https://tanzil.net'))).toBe(true)
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

  it('has morning and evening collections of a plausible size, with every id resolving', () => {
    for (const [id, ids] of collections) {
      expect(COLLECTION_IDS).toContain(id)
      expect(ids.length, `${id} is not empty`).toBeGreaterThan(0)
      expect(new Set(ids).size, `${id} has no duplicates`).toBe(ids.length)
      for (const dhikrId of ids) expect(azkarData.items[dhikrId], `${id}: ${dhikrId}`).toBeDefined()
    }
    for (const id of COLLECTION_IDS) expect(() => getCollection(id)).not.toThrow()
    expect(availableCollections()).toEqual(expect.arrayContaining(['morning', 'evening']))

    // The reference chapter of Hisn al-Muslim has 24 entries; a few are morning-only or evening-only.
    for (const id of ['morning', 'evening'] as const) {
      const size = getCollection(id).length
      expect(size, `${id} size`).toBeGreaterThanOrEqual(18)
      expect(size, `${id} size`).toBeLessThanOrEqual(28)
    }
  })

  it('uses every item in at least one collection, and keeps time-bound wordings in their session', () => {
    const used = new Set(collections.flatMap(([, ids]) => ids))
    for (const item of items) expect(used.has(item.id), `${item.id} is in a collection`).toBe(true)

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
    if (item.note) expectBilingual(item.note, 'note')
  })

  it.each(items)('$id is recited from clean, vocalised Arabic', (item: Dhikr) => {
    expect(item.arabic).toMatch(RECITED_TEXT)
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
    expect(incompleteVocalisation(item.arabic)).toEqual([])
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
    expect(text, 'starts with a capital and ends with a full stop').toMatch(/^[A-Z\u1E24].*\.$/)
    expect(text, 'single spaces').toBe(squash(text))
    // Inside a sentence only proper names are capitalised; divine attributes are not.
    for (const sentence of text.split(/(?<=\.) /)) {
      const words = sentence.split(/[ -]/).slice(1)
      for (const word of words) {
        if (/^[A-Z\u1E24]/.test(word)) expect(word, `capital inside "${sentence}"`).toMatch(PROPER_NAME)
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
    for (const [citation, ids] of cited) {
      if (ids.length === 1) continue
      // One hadith may carry the morning and the evening wording of the same dhikr, nothing more.
      const sessions = ids.map((id) => id.split('-')[0]).sort()
      expect({ citation, sessions }, ids.join(', ')).toEqual({ citation, sessions: ['evening', 'morning'] })
    }
  })
})

describe("Qur'anic passages", () => {
  const quranic = items.filter((item) => item.quran !== undefined)

  it('exist in the dataset', () => {
    expect(quranic.map((item) => item.id)).toEqual(
      expect.arrayContaining(['ayat-al-kursi', 'al-ikhlas-al-falaq-an-nas']),
    )
  })

  it('come from a fixture of well-formed canonical ayat', () => {
    expect(ayat[BASMALA_KEY]).toBeDefined()
    for (const [key, text] of Object.entries(ayat)) {
      expect(key).toMatch(/^\d+:\d+$/)
      expect(text).toMatch(RECITED_TEXT)
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

    // Complete surahs: the basmala, then one ayah to a line. Otherwise the passage on one line.
    const wholeSurahs = refs.every((ref) => ref.from === 1 && ref.to === SURAH_LENGTHS[ref.surah])
    const expected = wholeSurahs
      ? refs.flatMap((ref) => [ayahText(1, 1), ...ayatOf(ref)])
      : [refs.flatMap(ayatOf).join(' ')]

    const lines = item.arabic.split('\n')
    // The only line allowed in front of the Qur'an is the isti'adha, and only before a lone passage.
    const opening = lines.length - expected.length
    expect(opening === 0 || (opening === 1 && !wholeSurahs), 'lines before the passage').toBe(true)
    if (opening === 1) expect(fingerprint(lines[0] ?? '')).toBe(ISTIADHA_FINGERPRINT)
    expect(lines.slice(opening)).toEqual(expected)
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
