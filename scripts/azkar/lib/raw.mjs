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

// --- asellam/HisnElMuslim: the book typed out with separate morning and evening chapters -------

const ASELLAM_CHAPTERS = { morning: [26, 24], evening: [27, 22] }

function asellamChapter(name) {
  const [position, size] = ASELLAM_CHAPTERS[name]
  const chapter = Object.values(json('raw/asellam-hisn-el-muslim/hisn.json'))[position]
  if (chapter?.Adhkar?.length !== size) fail(`asellam ${name} chapter is not where it is expected`)
  return chapter.Adhkar
}

/** `{ text, count }` of entry `index` in the morning or evening chapter. */
export function asellam(chapter, index) {
  const entry = asellamChapter(chapter)[index]
  if (!entry) fail(`asellam ${chapter}[${index}] does not exist`)
  return { text: entry.Text, count: entry.Count }
}

// --- Seen-Arabic/Morning-And-Evening-Adhkar-DB ------------------------------------------------

/** `{ text, count, source }` of the row whose `order` is given. */
export function seen(order) {
  const row = json('raw/seen-arabic-adhkar-db/ar.json').find((candidate) => candidate.order === order)
  if (!row) fail(`Seen row ${order} does not exist`)
  return { text: row.content, count: row.count, source: row.source }
}

// --- Hisn al-Muslim, book text with footnotes (abdorizak/Hisnul-Muslim) -----------------------

const BOOK_CHAPTER_ID = 32
const BOOK_ENTRIES = 24
const FOOTNOTE_MARK = /\(\u00AC(\d+)\)/

function bookChapter() {
  const chapter = json('raw/abdorizak-hisnul-muslim/hisnul_muslim.json').content.find(
    (candidate) => candidate.id === BOOK_CHAPTER_ID,
  )
  if (chapter?.pages?.length !== 12) fail('the morning and evening chapter of the book was not found')
  return chapter
}

/** Footnote `note` printed under page `page` (zero-based) of the chapter, whitespace tidied. */
export function bookFootnote(page, note) {
  const parts = bookChapter().pages[page]?.reference.split(FOOTNOTE_MARK) ?? []
  for (let i = 1; i < parts.length; i += 2) {
    if (Number(parts[i]) === note) return tidy(parts[i + 1])
  }
  return fail(`book footnote ${note} on page ${page} does not exist`)
}

/**
 * The 24 numbered entries of the chapter, keyed by their number in the chapter (1 to 24).
 * `text` is the dhikr without footnote markers; `annotations` are the bracketed remarks printed
 * after it (the number of repetitions, or "in the morning"), and `remark` is the same passage as
 * one line, keeping any word the book prints between two brackets.
 */
export function bookEntries() {
  const content = bookChapter()
    .pages.map((page) => page.content)
    .join('\n')
  // Entries are numbered "(1) ", "(2) " ... in order; any other bracketed number is ignored.
  const starts = []
  for (const match of content.matchAll(/\((\d+)\) /g)) {
    if (Number(match[1]) === starts.length + 1) starts.push(match)
  }
  if (starts.length !== BOOK_ENTRIES) fail(`expected ${BOOK_ENTRIES} book entries, found ${starts.length}`)
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
    entries[index + 1] = {
      text: tidy(withoutMarks(body)),
      annotations: [...withoutMarks(tail).matchAll(/\(([^()]+)\)/g)].map((match) => tidy(match[1])),
      remark: tidy(remark).replace(/ \u060C/g, '\u060C'),
    }
  })
  return entries
}

// --- Sahih Muslim 2723 (fawazahmed0/hadith-api) ------------------------------------------------

/** The passages of the hadith that are inside quotation marks, in order. */
export function muslim2723Quotes() {
  const hadith = json('raw/hadith-api/ara-muslim-6908.json').hadiths[0]
  if (hadith.arabicnumber !== '2723.02') fail('raw/hadith-api/ara-muslim-6908.json is not Muslim 2723')
  return hadith.text.split('"').filter((_, index) => index % 2 === 1)
}

// --- Tanzil text served by api.alquran.cloud (edition quran-simple) ---------------------------

const QURAN_FILES = ['ayah-1-1', 'ayah-2-255', 'ayah-9-129', 'surah-112', 'surah-113', 'surah-114']

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
    if (text !== text.trim() || /\s{2,}|[^\S ]/.test(text)) fail(`${key} has unexpected whitespace`)
  }
  return ayat
}
