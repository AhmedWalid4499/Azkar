// Assembles the native app's Riyad as-Salihin library, apple/AzkarKit/Sources/AzkarContent/Resources/riyad.json,
// and beside this script fixtures/riyad-fingerprints.json (one fingerprint per hadith, checked by
// the Swift tests, so that a later hand edit of a single mark is noticed).
//
//   node scripts/hadith/fetch.mjs   (once, to download the pinned files)
//   node scripts/hadith/build.mjs
//
// Inputs: the pinned files under raw/ (see sources.mjs). Every Arabic string in the output is
// copied from them; no Arabic is typed in any file of this directory, and the build refuses to run
// if it finds some. The changes made to the Arabic are these and nothing else:
//
//   text       the "arabic" field, with the byte-order mark removed and the ends trimmed. Vowel
//              marks, tatweel, punctuation and quotation marks are kept exactly as given.
//   source     the note in double brackets that ends most hadith, such as ((rawahu Muslim)), is
//              split off when nothing but spaces and the punctuation . , : follows it; its inner
//              text (trimmed) becomes `source` and the text keeps what came before it (trimmed).
//              A note followed by more words (another narration, a remark) stays in the text,
//              and that hadith has no `source`.
//   book       the Arabic title is the "book" field from its first Arabic letter, as given.
//
// The number (1 to 1896, as on sunnah.com), the book (0 for the Introduction) and the number in
// the book are read from the "reference" field. The "english" and "grade" fields are not read.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOK_NAMES, HADITH_FILES, RAW, SOURCES } from './sources.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const OUTPUT = join(repo, 'apple/AzkarKit/Sources/AzkarContent/Resources/riyad.json')
const FINGERPRINTS = join(here, 'fixtures', 'riyad-fingerprints.json')
const EXPECTED_COUNT = 1896
const EXPECTED_BOOKS = 20

function fail(message) {
  console.error(`hadith build: ${message}`)
  process.exit(1)
}

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

function assertNoHandTypedArabic() {
  for (const name of readdirSync(here).filter((file) => file.endsWith('.mjs'))) {
    const at = readFileSync(join(here, name), 'utf8').search(ARABIC)
    if (at >= 0) fail(`${name} contains Arabic script at offset ${at}; Arabic must come from raw/`)
  }
}

function readPinned(entry) {
  const bytes = readFileSync(join(here, entry.path))
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== entry.sha256) fail(`${entry.path} does not match its pinned sha256; run fetch.mjs or review the change`)
  return bytes.toString('utf8').replace(/^\uFEFF/, '')
}

const REFERENCE = /^Reference : Riyad as-Salihin (\d+) In-book reference : (?:Introduction|Book (\d+)), Hadith (\d+)$/
const NOTE_AT_END = /\(\(([^()]+)\)\)[\s.,:\u060C]*$/

/** `{ text, source }`: the trailing source note split off, everything else as given. */
export function splitSource(arabic) {
  const text = arabic.replace(/^\uFEFF/, '').trim()
  const match = NOTE_AT_END.exec(text)
  if (!match) return { text, source: null }
  const before = text.slice(0, match.index).trim()
  const source = match[1].trim()
  if (!before || !source) return { text, source: null }
  return { text: before, source }
}

/** The first 16 hex digits of sha256(text, NUL, source): what the Swift tests recompute. */
export function fingerprint(hadith) {
  return createHash('sha256').update(`${hadith.text}\u0000${hadith.source ?? ''}`, 'utf8').digest('hex').slice(0, 16)
}

function build() {
  assertNoHandTypedArabic()
  for (const entry of RAW.filter((item) => !HADITH_FILES.includes(item))) readPinned(entry)

  const hadith = []
  const books = new Map()
  for (const entry of HADITH_FILES) {
    const records = JSON.parse(readPinned(entry))
    if (!Array.isArray(records)) fail(`${entry.path} is not a list`)
    for (const record of records) {
      if (record.collection !== 'riyadussalihin') fail(`${entry.path}: a record of ${record.collection}`)
      const reference = REFERENCE.exec(String(record.reference).trim())
      if (!reference) fail(`${entry.path}: unreadable reference ${JSON.stringify(record.reference)}`)
      const number = Number(reference[1])
      const book = reference[2] === undefined ? 0 : Number(reference[2])
      const inBook = Number(reference[3])
      const title = String(record.book)
      const at = title.search(ARABIC)
      if (at < 0) fail(`${entry.path}: no Arabic title in ${JSON.stringify(title)}`)
      const arabicTitle = title.slice(at).trim()
      const known = books.get(book)
      if (known && known !== arabicTitle) fail(`book ${book} has two titles`)
      books.set(book, arabicTitle)
      const { text, source } = splitSource(String(record.arabic ?? ''))
      if (!text || !ARABIC.test(text)) fail(`hadith ${number} has no Arabic text`)
      hadith.push({ number, book, inBook, text, source })
    }
  }

  hadith.sort((a, b) => a.number - b.number)
  if (hadith.length !== EXPECTED_COUNT) fail(`${hadith.length} hadith, expected ${EXPECTED_COUNT}`)
  hadith.forEach((item, index) => {
    if (item.number !== index + 1) fail(`numbering breaks at ${index + 1} (found ${item.number})`)
  })
  if (books.size !== EXPECTED_BOOKS) fail(`${books.size} books, expected ${EXPECTED_BOOKS}`)
  for (const [book] of books) if (!BOOK_NAMES[book]) fail(`book ${book} has no English name`)
  // Within each book the in-book numbers are 1 to the book's count, each once. They follow the
  // overall numbers except in a few places where the source (as sunnah.com) swaps two; kept as given.
  for (const [book] of books) {
    const inBook = hadith.filter((item) => item.book === book).map((item) => item.inBook).sort((a, b) => a - b)
    inBook.forEach((value, index) => {
      if (value !== index + 1) fail(`book ${book}: in-book numbers skip or repeat at ${index + 1}`)
    })
  }

  const bookList = [...books.keys()].sort((a, b) => a - b).map((number) => ({
    number,
    title: books.get(number),
    english: BOOK_NAMES[number],
    count: hadith.filter((item) => item.book === number).length,
  }))

  const line = (value) => JSON.stringify(value)
  const output =
    '{\n' +
    `  "version": 1,\n` +
    `  "sources": ${JSON.stringify(SOURCES, null, 2).replace(/\n/g, '\n  ')},\n` +
    `  "books": [\n    ${bookList.map(line).join(',\n    ')}\n  ],\n` +
    `  "hadith": [\n    ${hadith
      .map((item) => line(item.source ? item : { number: item.number, book: item.book, inBook: item.inBook, text: item.text }))
      .join(',\n    ')}\n  ]\n}\n`
  JSON.parse(output)
  writeFileSync(OUTPUT, output)

  mkdirSync(dirname(FINGERPRINTS), { recursive: true })
  const prints = Object.fromEntries(hadith.map((item) => [String(item.number), fingerprint(item)]))
  writeFileSync(FINGERPRINTS, `${JSON.stringify(prints, null, 0).replace(/,"/g, ',\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, '\n}')}\n`)

  const withSource = hadith.filter((item) => item.source).length
  const vowelled = hadith.filter((item) => /[\u064B-\u0652]/.test(item.text)).length
  console.log(
    `riyad.json: ${hadith.length} hadith in ${books.size} books, ${withSource} with the source split off, ` +
      `${vowelled} carrying vowel marks, ${Math.round(output.length / 1024)} KB`,
  )
}

build()
