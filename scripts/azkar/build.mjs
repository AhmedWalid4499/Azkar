// Assembles src/features/azkar/data/azkar.json, and beside it two fixtures for the offline test:
// fixtures/quran.json (the canonical ayat) and fixtures/arabic-fingerprints.json (one fingerprint
// per recited text, so that a later hand edit of a single mark is noticed).
//
//   node scripts/azkar/build.mjs
//
// Inputs: the pinned files under raw/ (see sources.mjs, fetched by fetch.mjs) and mapping.mjs.
// Every Arabic string in the output is copied from one of those files; no Arabic is typed in any
// file of this directory, and the build refuses to run if it finds some. The changes made to
// Arabic are the ones listed here and nothing else.
//
//   recited text      the whole text of the selected record, then tidy(): invisible formatting
//                     characters removed, whitespace collapsed and trimmed.
//                     A record may then have single words replaced by the same word of another
//                     pinned record ("patches", declared word by word in mapping.mjs). Each patch
//                     is checked before it is applied:
//                       marks     same letters; the replacement only adds marks the word lacked
//                       vowel     same letters; one vowel differs, and at least two other pinned
//                                 records must carry the replacement's vowels on that word
//                       spelling  the replacement has one more alef and otherwise the same letters
//                                 and marks (a long vowel written out instead of left implicit)
//                     After patching, every recited text must be completely vocalised
//                     (lib/arabic.mjs, incompleteVocalisation), or the build fails.
//   Qur'anic text     copied character for character from the Tanzil text; the basmala that the
//                     API prepends to a surah's first ayah is detached (lib/raw.mjs) and placed
//                     before each complete surah. Ayat are separated by a space or a line break.
//                     Never patched.
//   references,       tidy(); a footnote is cut into sentences at "." and segments at the Arabic
//   virtues, notes    comma and the chosen pieces rejoined; the space the book prints after "/"
//                     in "volume/ page" is closed; trailing punctuation is dropped. Declared in
//                     mapping.mjs, piece by piece: a number may be changed (digits and "/" only)
//                     and a missing comma inserted after a number. A surah name is the API's own
//                     name of the surah with its vowel marks removed.
//
// Unicode normalisation is not applied (see lib/arabic.mjs).

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  RECITED_TEXT,
  compareVocalised,
  fingerprint,
  foreignCharacters,
  incompleteVocalisation,
  looseSkeleton,
  splitToken,
  strictSkeleton,
  stripMarks,
  tidy,
  vocalisedWords,
} from './lib/arabic.mjs'
import {
  AZKAR_SCRIPTS,
  asellam,
  bookEntries,
  bookFootnote,
  muslim2723Quotes,
  quranAyat,
  quranSurahs,
  seen,
} from './lib/raw.mjs'
import { COLLECTIONS, ITEMS, VERSION } from './mapping.mjs'
import { SOURCES } from './sources.mjs'

const DATA_DIR = join(AZKAR_SCRIPTS, '..', '..', 'src', 'features', 'azkar', 'data')
const ARABIC_COMMA = '\u060C'
const ALEF = '\u0627'

function fail(message) {
  throw new Error(`azkar build: ${message}`)
}

// --- no Arabic is typed by hand ---------------------------------------------------------------

/** Arabic script anywhere in a hand-written file means someone typed or pasted it: refuse. */
function assertNoHandTypedArabic() {
  const files = [
    ...readdirSync(AZKAR_SCRIPTS).filter((name) => name.endsWith('.mjs')),
    ...readdirSync(join(AZKAR_SCRIPTS, 'lib')).map((name) => join('lib', name)),
  ]
  for (const file of files) {
    const text = readFileSync(join(AZKAR_SCRIPTS, file), 'utf8')
    const at = text.search(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/)
    if (at >= 0) fail(`${file} contains Arabic script at offset ${at}; Arabic must come from raw/`)
  }
}

const ayat = quranAyat()
const surahs = quranSurahs()
const book = bookEntries()

// --- recited text ----------------------------------------------------------------------------

function quranAyatOf({ surah, from, to }) {
  const texts = []
  for (let ayah = from; ayah <= to; ayah += 1) {
    const text = ayat[`${surah}:${ayah}`]
    if (!text) fail(`ayah ${surah}:${ayah} is not among the fetched Qur'an files`)
    texts.push(text)
  }
  return texts
}

/** The source record a selector points at: `{ text, count }`, text still exactly as published. */
export function record(selector) {
  switch (selector.from) {
    case 'asellam':
      return asellam(selector.chapter, selector.index)
    case 'seen':
      return seen(selector.order)
    case 'book':
      return { text: book[selector.entry].text }
    case 'muslim-2723': {
      const quotes = muslim2723Quotes()
      return { text: selector.quotes.map((index) => quotes[index]).join(' ') }
    }
    default:
      return fail(`unknown selector ${JSON.stringify(selector)}`)
  }
}

const letterMarks = (word) => vocalisedWords(word)[0] ?? []
const sameMarks = (a, b) => a.length === b.length && a.every((letter, i) => letter.marks === b[i].marks)

/** True when `witness` carries, on at least one occurrence of the word, exactly the marks of `word`. */
function confirmsVowels(word, witness) {
  const [letters] = strictSkeleton(word)
  const occurrences = vocalisedWords(tidy(record(witness).text)).filter(
    (candidate) => candidate.map((letter) => letter.base).join('') === letters,
  )
  const marked = occurrences.filter((candidate) => candidate.some((letter) => letter.marks !== ''))
  return marked.length > 0 && marked.every((candidate) => sameMarks(candidate, letterMarks(word)))
}

/** Replace single words of `text` by the same word of another pinned record, after checking each. */
function applyPatches(text, patches, id) {
  const tokens = text.split(' ')
  for (const patch of patches) {
    const where = `${id}: patch of word ${patch.word}`
    const donorTokens = tidy(record(patch.from).text).split(' ')
    if (tokens[patch.word] === undefined || donorTokens[patch.fromWord] === undefined) fail(`${where}: no such word`)
    const target = splitToken(tokens[patch.word])
    const donor = splitToken(donorTokens[patch.fromWord])
    const [targetLetters] = strictSkeleton(target.core)
    const [donorLetters] = strictSkeleton(donor.core)
    const comparison = compareVocalised(target.core, donor.core)
    const differs = comparison.conflicts.length + comparison.missingInA.length + comparison.missingInB.length
    switch (patch.kind) {
      case 'marks':
        if (targetLetters !== donorLetters) fail(`${where}: the letters differ`)
        if (comparison.conflicts.length > 0 || comparison.missingInB.length > 0) fail(`${where}: not a pure addition of marks`)
        if (comparison.missingInA.length === 0) fail(`${where}: the word lacks no mark`)
        break
      case 'vowel': {
        if (targetLetters !== donorLetters) fail(`${where}: the letters differ`)
        if (comparison.conflicts.length === 0) fail(`${where}: the two words do not disagree`)
        const confirming = (patch.confirmedBy ?? []).filter((witness) => confirmsVowels(donor.core, witness))
        if (confirming.length < 2 || confirming.length !== patch.confirmedBy.length) {
          fail(`${where}: the replacement is not confirmed by every listed witness (at least two)`)
        }
        break
      }
      case 'spelling': {
        const at = [...donorLetters].findIndex(
          (letter, i) => letter === ALEF && donorLetters.slice(0, i) + donorLetters.slice(i + 1) === targetLetters,
        )
        if (at < 0) fail(`${where}: the replacement is not the same word with one more alef`)
        const withoutAlef = letterMarks(donor.core).filter((_, i) => i !== at)
        if (letterMarks(donor.core)[at].marks !== '' || !sameMarks(withoutAlef, letterMarks(target.core))) {
          fail(`${where}: the marks of the two spellings differ`)
        }
        break
      }
      default:
        fail(`${where}: unknown kind ${patch.kind}`)
    }
    if (patch.kind !== 'spelling' && differs === 0) fail(`${where}: nothing changes`)
    tokens[patch.word] = target.lead + donor.core + target.trail
  }
  return tokens.join(' ')
}

/**
 * Qur'anic items are laid out in lines, which the reader shows as written: the isti'adha or the
 * basmala on a line of its own, then a lone ayah on one line, or a complete surah one ayah to a
 * line so that the ends of its ayat stay visible without adding any mark to the text.
 */
function recitedText(spec, id) {
  if (spec.from !== 'quran') return applyPatches(tidy(record(spec).text), spec.patches ?? [], id)
  if (spec.patches) fail(`${id}: Qur'anic text is never patched`)
  const lines = []
  if (spec.prefix) lines.push(tidy(record(spec.prefix).text.split('\n')[spec.prefix.line]))
  for (const passage of spec.passages) {
    if (spec.basmala) {
      // The basmala opens a surah, so the passage must be a whole surah from its first ayah.
      if (passage.from !== 1 || passage.to !== surahs[passage.surah]?.ayat) fail(`${id}: ${passage.surah} is not a whole surah`)
      lines.push(ayat['1:1'], ...quranAyatOf(passage))
    } else {
      lines.push(quranAyatOf(passage).join(' '))
    }
  }
  return lines.join('\n')
}

// --- references, virtues and notes ------------------------------------------------------------

const trimPunctuation = (text) => text.replace(/^[\s.\u060C]+|[\s.\u060C]+$/g, '')

/**
 * Every number of a reference that is not the one the book prints there, for verify.mjs to list:
 * `{ id, from, to, kind }`, kind "amend" for a corrected number and "citeAs" for a phrase of the
 * book re-used to cite another hadith.
 */
export const AMENDMENTS = []
let currentId = ''

/** Replace the number `from`, which must occur exactly once, by `to`. Digits and "/" only. */
function changeNumber(text, [from, to], kind, piece) {
  if (!/^[0-9/]+$/.test(from) || !/^[0-9/]+$/.test(to)) fail(`only numbers can be changed: ${JSON.stringify(piece)}`)
  const pattern = new RegExp(`(?<![0-9])${from}(?![0-9])`, 'g')
  if ((text.match(pattern) ?? []).length !== 1) fail(`"${from}" does not occur exactly once in ${JSON.stringify(piece)}`)
  AMENDMENTS.push({ id: currentId, from, to, kind })
  return text.replace(pattern, to)
}

function footnotePiece(piece) {
  if (piece.from === 'list') return piece.pieces.map(footnotePiece).join(`${ARABIC_COMMA} `)
  if (piece.from === 'surah-name') {
    const name = stripMarks(surahs[piece.surah]?.name ?? fail(`surah ${piece.surah} is not among the fetched files`))
    if (!/^[\u0621-\u064A]+ [\u0621-\u064A]+$/.test(name)) fail(`unexpected surah name for ${piece.surah}`)
    return name
  }
  if (piece.from === 'book-annotation') return book[piece.entry].annotations[piece.index]
  if (piece.from === 'book-remark') return book[piece.entry].remark
  let text = piece.from === 'seen-source' ? tidy(seen(piece.order).source) : bookFootnote(piece.page, piece.number)
  if (piece.sentence !== undefined) text = text.split('.')[piece.sentence]
  if (piece.after !== undefined) {
    const at = text?.indexOf(piece.after) ?? -1
    if (at < 0) fail(`"${piece.after}" not found by ${JSON.stringify(piece)}`)
    text = text.slice(at + piece.after.length)
  }
  if (piece.segments) {
    const segments = text.split(ARABIC_COMMA).map((segment) => segment.trim())
    const pick = (index) => segments[index] ?? fail(`segment ${index} missing in ${JSON.stringify(piece)}`)
    text = piece.segments
      .map((choice) => (Array.isArray(choice) ? choice.map(pick).join(' ') : pick(choice)))
      .join(`${ARABIC_COMMA} `)
  }
  if (text === undefined) fail(`nothing selected by ${JSON.stringify(piece)}`)
  let body = trimPunctuation(tidy(text)).replace(/\/ +/g, '/')
  for (const change of piece.amend ?? []) body = changeNumber(body, change, 'amend', piece)
  for (const change of piece.citeAs ?? []) body = changeNumber(body, change, 'citeAs', piece)
  for (const number of piece.commaAfter ?? []) {
    if (!/^[0-9/]+$/.test(number) || body.split(`${number} `).length !== 2) fail(`cannot put a comma after "${number}"`)
    body = body.replace(`${number} `, `${number}${ARABIC_COMMA} `)
  }
  return piece.label ? `${footnotePiece(piece.label)}: ${body}` : body
}

const arabicFrom = (pieces) => [pieces].flat().map(footnotePiece).join('. ')

const numbersIn = (text) => (text.match(/[0-9]+/g) ?? []).sort().join(' ')

function bilingual(field, what, id) {
  currentId = id
  const ar = arabicFrom(field.ar)
  if (!field.en?.trim() || !ar) fail(`${id}: ${what} is empty`)
  if (/[A-Za-z]/.test(ar)) fail(`${id}: ${what}.ar contains Latin letters`)
  if (numbersIn(field.en) !== numbersIn(ar)) {
    fail(`${id}: ${what} quotes different numbers in English (${numbersIn(field.en)}) and Arabic (${numbersIn(ar)})`)
  }
  return { en: field.en.trim(), ar }
}

// --- items -----------------------------------------------------------------------------------

function buildItem(spec) {
  const arabic = recitedText(spec.arabic, spec.id)
  if (!RECITED_TEXT.test(arabic)) {
    fail(`${spec.id}: unexpected characters in the Arabic: ${foreignCharacters(arabic).join(' ')}`)
  }
  const gaps = incompleteVocalisation(arabic)
  if (gaps.length > 0) fail(`${spec.id}: incomplete vocalisation: ${JSON.stringify(gaps)}`)
  for (const witness of spec.agreesWith ?? []) {
    // Same words, and not one differing vowel, as a record that was not used to build the text.
    const comparison = compareVocalised(arabic, tidy(record(witness).text))
    if (comparison.onlyInA.length + comparison.onlyInB.length + comparison.conflicts.length > 0) {
      fail(`${spec.id}: differs from ${JSON.stringify(witness)}: ${JSON.stringify(comparison)}`)
    }
  }
  if (spec.quranTail) {
    // The supplication is the end of an ayah: the same words and vowels as the Tanzil text.
    const { surah, ayah, words } = spec.quranTail
    const text = ayat[`${surah}:${ayah}`] ?? fail(`${spec.id}: ayah ${surah}:${ayah} is not fetched`)
    const tail = looseSkeleton(text).slice(-words).join(' ')
    const comparison = compareVocalised(arabic, text)
    if (looseSkeleton(arabic).join(' ') !== tail || comparison.conflicts.length + comparison.onlyInA.length > 0) {
      fail(`${spec.id}: is not the last ${words} words of ${surah}:${ayah}`)
    }
  }
  for (const witness of [spec.arabic, ...spec.witnesses, ...(spec.countWitnesses ?? [])]) {
    const count = witness.from === 'asellam' || witness.from === 'seen' ? record(witness).count : undefined
    if (count !== undefined && count !== spec.repeat) {
      fail(`${spec.id}: repeat ${spec.repeat} but ${JSON.stringify(witness)} says ${count}`)
    }
  }
  const item = {
    id: spec.id,
    arabic,
    transliteration: spec.transliteration,
    translation: spec.translation,
    repeat: spec.repeat,
  }
  if (spec.note) item.note = bilingual(spec.note, 'note', spec.id)
  if (spec.virtue) item.virtue = bilingual(spec.virtue, 'virtue', spec.id)
  item.reference = bilingual(spec.reference, 'reference', spec.id)
  if (spec.arabic.from === 'quran') item.quran = spec.arabic.passages
  return item
}

export function buildDataset() {
  assertNoHandTypedArabic()
  AMENDMENTS.length = 0
  const items = {}
  const collections = Object.fromEntries(COLLECTIONS.map((id) => [id, []]))
  for (const spec of ITEMS) {
    if (items[spec.id]) fail(`duplicate id ${spec.id}`)
    items[spec.id] = buildItem(spec)
    for (const collection of spec.in) {
      if (!collections[collection]) fail(`${spec.id}: unknown collection ${collection}`)
      collections[collection].push(spec.id)
    }
  }
  return { version: VERSION, sources: SOURCES, items, collections }
}

/**
 * The ayat the dataset recites, keyed "surah:ayah" in Qur'an order, for the offline test.
 * The basmala (1:1) is included because it opens each complete surah.
 */
export function quranFixture(data = buildDataset()) {
  const keys = new Set(['1:1'])
  for (const item of Object.values(data.items)) {
    for (const { surah, from, to } of item.quran ?? []) {
      for (let ayah = from; ayah <= to; ayah += 1) keys.add(`${surah}:${ayah}`)
    }
  }
  const byPosition = (a, b) => {
    const [surahA, ayahA] = a.split(':').map(Number)
    const [surahB, ayahB] = b.split(':').map(Number)
    return surahA - surahB || ayahA - ayahB
  }
  return Object.fromEntries([...keys].sort(byPosition).map((key) => [key, ayat[key] ?? fail(`${key} is not fetched`)]))
}

function write(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const data = buildDataset()
  write(join(DATA_DIR, 'azkar.json'), data)
  write(join(DATA_DIR, 'fixtures', 'quran.json'), quranFixture(data))
  const fingerprints = Object.values(data.items).map((item) => [item.id, fingerprint(item.arabic)])
  write(join(DATA_DIR, 'fixtures', 'arabic-fingerprints.json'), Object.fromEntries(fingerprints))
  const sizes = Object.entries(data.collections).map(([id, ids]) => `${id} ${ids.length}`)
  console.log(`azkar.json written: ${Object.keys(data.items).length} items (${sizes.join(', ')})`)
}
