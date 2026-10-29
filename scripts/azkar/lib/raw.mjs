// Read-only access to the pinned source files under scripts/azkar/raw.
// Each accessor returns text exactly as the source has it; cleaning happens in build.mjs.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RAW } from '../sources.mjs'
import { tidy } from './arabic.mjs'

export const AZKAR_SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  throw new Error(`azkar sources: ${message}`)
}

/** A pinned raw file as text, refused when its bytes differ from the hash in sources.mjs. */
export function readRaw(path) {
  const entry = RAW.find((candidate) => candidate.path === path)
  if (!entry) fail(`${path} is not listed in sources.mjs`)
  const file = join(AZKAR_SCRIPTS, path)
  if (!existsSync(file)) fail(`${path} is missing: run "node scripts/azkar/fetch.mjs"`)
  const bytes = readFileSync(file)
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== entry.sha256) fail(`${path} does not match its pinned sha256 (${actual})`)
  return bytes.toString('utf8')
}

const parsed = new Map()

function json(path) {
  if (!parsed.has(path)) parsed.set(path, JSON.parse(readRaw(path).replace(/^\uFEFF/, '')))
  return parsed.get(path)
}

/** An optional witness from .cache, or null when it has not been fetched. */
export function readCache(path) {
  const file = join(AZKAR_SCRIPTS, path)
  return existsSync(file) ? readFileSync(file, 'utf8').replace(/^\uFEFF/, '') : null
}

// --- asellam/HisnElMuslim: the book typed out, one chapter per section of the book -----------

/** Chapters used, as [position in the file, number of entries]. Morning and evening are separate. */
const ASELLAM_CHAPTERS = {
  morning: [26, 24],
  evening: [27, 22],
  'after-prayer': [24, 8],
  sleep: [28, 15],
  'tasbih-virtues': [130, 12],
}

function asellamChapter(name) {
  const [position, size] = ASELLAM_CHAPTERS[name] ?? fail(`asellam has no chapter "${name}" here`)
  const chapter = Object.values(json('raw/asellam-hisn-el-muslim/hisn.json'))[position]
  if (chapter?.Adhkar?.length !== size) fail(`asellam ${name} chapter is not where it is expected`)
  return chapter.Adhkar
}

/** `{ text, count }` of entry `index` of a chapter. */
export function asellam(chapter, index) {
  const entry = asellamChapter(chapter)[index]
  if (!entry) fail(`asellam ${chapter}[${index}] does not exist`)
  return { text: entry.Text, count: entry.Count }
}

/** The lines of an entry's text, blank lines left out, each exactly as typed. */
export function asellamLines(chapter, index) {
  return asellam(chapter, index)
    .text.split(/\r?\n/)
    .filter((line) => line.trim() !== '')
}

/** The source remark asellam prints under an entry (its copy of the book's footnote). */
export function asellamReference(chapter, index) {
  const entry = asellamChapter(chapter)[index]
  if (!entry) fail(`asellam ${chapter}[${index}] does not exist`)
  return entry.Reference
}

// --- Seen-Arabic/Morning-And-Evening-Adhkar-DB ------------------------------------------------

/** `{ text, count, source }` of the row whose `order` is given. */
export function seen(order) {
  const row = json('raw/seen-arabic-adhkar-db/ar.json').find((candidate) => candidate.order === order)
  if (!row) fail(`Seen row ${order} does not exist`)
  return { text: row.content, count: row.count, source: row.source }
}

// --- Hisn al-Muslim, book text with footnotes (abdorizak/Hisnul-Muslim) -----------------------

/**
 * Chapters used: the chapter's id in the file, its number of pages and of numbered entries.
 * `missing` lists entry numbers the digital text lost: in the chapter after the salam the text
 * of entry 6 (Ayat al-Kursi) is absent and the numbering jumps from (5) to (7).
 */
const BOOK_CHAPTERS = {
  'morning-evening': { id: 32, pages: 12, entries: 24 },
  'after-prayer': { id: 30, pages: 2, entries: 8, missing: [6] },
  sleep: { id: 33, pages: 6, entries: 13 },
  'tasbih-virtues': { id: 136, pages: 3, entries: 12 },
  // Only the title is read: "the supplication of the prostration of recitation".
  'sujud-at-tilawah': { id: 26, pages: 1, entries: 2 },
}
const FOOTNOTE_MARK = /\(\u00AC(\d+)\)/

function bookChapter(name) {
  const { id, pages } = BOOK_CHAPTERS[name] ?? fail(`the book chapter "${name}" is not declared`)
  const chapter = json('raw/abdorizak-hisnul-muslim/hisnul_muslim.json').content.find(
    (candidate) => candidate.id === id,
  )
  if (chapter?.pages?.length !== pages) fail(`the book chapter "${name}" was not found`)
  return chapter
}

/** The title of a chapter of the book, whitespace tidied. */
export function bookTitle(chapter) {
  return tidy(bookChapter(chapter).title)
}

/**
 * Footnote `note` printed under page `page` (zero-based) of a chapter, whitespace tidied.
 * `occurrence` picks a later footnote when the digital text gives two the same number.
 */
export function bookFootnote(page, note, chapter = 'morning-evening', occurrence = 0) {
  const parts = bookChapter(chapter).pages[page]?.reference.split(FOOTNOTE_MARK) ?? []
  let seen = 0
  for (let i = 1; i < parts.length; i += 2) {
    if (Number(parts[i]) === note && seen++ === occurrence) return tidy(parts[i + 1])
  }
  return fail(`book footnote ${note} (occurrence ${occurrence}) on page ${page} of ${chapter} does not exist`)
}

const entriesCache = new Map()

/**
 * The numbered entries of a chapter, keyed by their number in the chapter (from 1).
 * `text` is the dhikr without footnote markers; `annotations` are the bracketed remarks printed
 * after it (the number of repetitions, or "in the morning"), and `remark` is the same passage as
 * one line, keeping any word the book prints between two brackets.
 */
export function bookEntries(chapter = 'morning-evening') {
  if (entriesCache.has(chapter)) return entriesCache.get(chapter)
  const { entries: expected, missing = [] } = BOOK_CHAPTERS[chapter]
  const content = bookChapter(chapter)
    .pages.map((page) => page.content)
    .join('\n')
  const numbers = Array.from({ length: expected }, (_, i) => i + 1).filter((number) => !missing.includes(number))
  // Entries are numbered "(1) ", "(2) " ... in order; any other bracketed number is ignored.
  const starts = []
  for (const match of content.matchAll(/\((\d+)\) /g)) {
    if (Number(match[1]) === numbers[starts.length]) starts.push(match)
  }
  if (starts.length !== numbers.length) fail(`expected ${numbers.length} entries in ${chapter}, found ${starts.length}`)
  const entries = {}
  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : content.length
    const chunk = content.slice(start.index + start[0].length, end)
    const close = chunk.lastIndexOf('))')
    const open = chunk.indexOf('((')
    const hasQuotes = open >= 0 && close > open
    const body = hasQuotes ? chunk.slice(open + 2, close) : chunk
    const tail = hasQuotes ? chunk.slice(close + 2) : ''
    const withoutMarks = (text) => text.replace(new RegExp(FOOTNOTE_MARK, 'g'), ' ')
    // The remark ends at the full stop that closes the entry; brackets around it are dropped.
    const remark = withoutMarks(tail).split('.')[0].replace(/[()]/g, ' ')
    entries[numbers[index]] = {
      text: tidy(withoutMarks(body)),
      annotations: [...withoutMarks(tail).matchAll(/\(([^()]+)\)/g)].map((match) => tidy(match[1])),
      remark: tidy(remark).replace(/ \u060C/g, '\u060C'),
    }
  })
  entriesCache.set(chapter, entries)
  return entries
}

// --- Sahih Muslim 2723 (fawazahmed0/hadith-api) ------------------------------------------------

/** The passages of the hadith that are inside quotation marks, in order. */
export function muslim2723Quotes() {
  const hadith = json('raw/hadith-api/ara-muslim-6908.json').hadiths[0]
  if (hadith.arabicnumber !== '2723.02') fail('raw/hadith-api/ara-muslim-6908.json is not Muslim 2723')
  return hadith.text.split('"').filter((_, index) => index % 2 === 1)
}

// --- Other hadiths of the same API, pinned one file per hadith --------------------------------

/**
 * `{ text, number }` of a hadith file `raw/hadith-api/ara-<edition>-<file>.json`: the vocalised
 * text, isnad included, and the hadith number the collection prints (Sahih Muslim's files are
 * numbered by the API's own sequence, so `number` is the one to compare with a citation).
 */
export function hadith(edition, file) {
  const path = `raw/hadith-api/ara-${edition}-${file}.json`
  const entry = json(path).hadiths[0]
  if (!entry || String(entry.hadithnumber) !== String(file)) fail(`${path} is not hadith ${file} of ${edition}`)
  return { text: entry.text, number: String(entry.arabicnumber) }
}

// --- Tanzil text served by api.alquran.cloud (edition quran-simple) ---------------------------

const QURAN_FILES = [
  'ayah-1-1',
  'ayah-2-255',
  'ayah-2-285',
  'ayah-2-286',
  'ayah-9-129',
  'surah-32',
  'surah-67',
  'surah-112',
  'surah-113',
  'surah-114',
]

/** The rub' al-hizb sign, which Tanzil prints at the start of an ayah that begins a quarter (32:11). */
export const RUB_AL_HIZB = '\u06DE'
/** The sign of a prostration of recitation, which Tanzil prints at the end of its ayah (32:15). */
export const SAJDAH = '\u06E9'

function quranFile(name) {
  const { data } = json(`raw/tanzil-alquran-cloud/${name}.json`)
  if (data.edition.identifier !== 'quran-simple') fail(`${name} is not the quran-simple edition`)
  return data
}

/**
 * What the API says about each surah among the fetched files, keyed by surah number:
 * `{ name, ayat }`, the Arabic name exactly as served and the number of ayat in the surah.
 */
export function quranSurahs() {
  const surahs = {}
  for (const name of QURAN_FILES) {
    const data = quranFile(name)
    const surah = data.surah ?? data
    surahs[surah.number] = { name: surah.name, ayat: surah.numberOfAyahs }
  }
  return surahs
}

/**
 * Ayah texts keyed "surah:ayah", character for character as Tanzil publishes them.
 *
 * Two quirks of the API are undone on purpose, and nothing else is touched:
 * - ayah 1:1 arrives with a leading byte-order mark;
 * - the first ayah of every other surah arrives with the basmala prepended, although the basmala
 *   is not part of that ayah. It is removed here and added back explicitly by build.mjs.
 * The rub' al-hizb sign that opens an ayah (32:11) and the sajdah sign that closes one (32:15)
 * are part of the Tanzil text and are kept, each set off by a space as Tanzil prints it; the
 * tanzil.net download that verify.mjs compares with is fetched with both signs (sources.mjs).
 * A sign anywhere else is refused.
 */
export function quranAyat() {
  const ayat = {}
  for (const name of QURAN_FILES) {
    const data = quranFile(name)
    if (data.ayahs) {
      for (const ayah of data.ayahs) ayat[`${data.number}:${ayah.numberInSurah}`] = ayah.text
    } else {
      ayat[`${data.surah.number}:${data.numberInSurah}`] = data.text
    }
  }
  ayat['1:1'] = ayat['1:1'].replace(/^\uFEFF/, '')
  const basmala = ayat['1:1']
  for (const key of Object.keys(ayat)) {
    const [surah, ayah] = key.split(':').map(Number)
    if (surah === 1 || ayah !== 1) continue
    if (!ayat[key].startsWith(`${basmala} `)) fail(`${key} does not start with the basmala as expected`)
    ayat[key] = ayat[key].slice(basmala.length + 1)
  }
  for (const [key, text] of Object.entries(ayat)) {
    const withoutSigns = text.replace(new RegExp(`^${RUB_AL_HIZB} `), '').replace(new RegExp(` ${SAJDAH}$`), '')
    if (withoutSigns.includes(RUB_AL_HIZB) || withoutSigns.includes(SAJDAH)) fail(`${key} has a section sign inside it`)
  }
  for (const [key, text] of Object.entries(ayat)) {
    if (text !== text.trim() || /\s{2,}|[^\S ]/.test(text)) fail(`${key} has unexpected whitespace`)
  }
  return ayat
}
