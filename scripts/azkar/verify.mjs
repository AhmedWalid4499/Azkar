// Cross-checks the built dataset against independent witnesses. It writes nothing into the app.
//
//   node scripts/azkar/fetch.mjs --cache     once: downloads the witnesses that are not committed
//   node scripts/azkar/verify.mjs            the committed sources plus whatever is in .cache/
//   node scripts/azkar/verify.mjs --online   also downloads the cited hadiths that are not cached yet
//
// 1. Qur'an    every recited ayah equals the text downloaded from tanzil.net itself, and its hash
//              is the one pinned in fixtures/quran-tanzil-sha256.json. The Tanzil download is
//              required: without it the run fails instead of skipping the comparison.
// 2. Words     each supplication has exactly the words of every witness that carries the same
//              wording; a difference not declared in mapping.mjs fails the run.
// 3. Vowels    each supplication is compared, mark by mark, with those witnesses. Two sources that
//              disagree on a mark cannot both be right, so any disagreement not already explained
//              in mapping.mjs fails the run.
// 4. Marks     every recited text must be completely vocalised (build.mjs already refuses to
//              write one that is not); a reading a witness marks differently is listed.
// 5. Numbers   hadith numbers quoted in the references are looked up in the open hadith API and
//              the hadith found must contain the words of the dhikr. Where two hadiths carry the
//              same dhikr with different counts, the count word is checked as well.
// 6. Amended   every number of a reference that differs from the book's print is listed.
//
// Exit code 1 means an unexplained disagreement: do not ship the dataset until it is understood.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AMENDMENTS, buildDataset, quranFixture, record } from './build.mjs'
import { compareVocalised, incompleteVocalisation, looseSkeleton, tidy } from './lib/arabic.mjs'
import { AZKAR_SCRIPTS, bookEntries, quranAyat, readCache } from './lib/raw.mjs'
import { ITEMS } from './mapping.mjs'
import { sha256, tanzilAyat } from './pin-quran.mjs'
import { hadithUrl } from './sources.mjs'

const online = process.argv.includes('--online')
const data = buildDataset()
let failures = 0

const heading = (text) => console.log(`\n== ${text}`)
function problem(text) {
  failures += 1
  console.log(`  FAIL  ${text}`)
}

// --- 1. Qur'an against the Tanzil download -----------------------------------------------------

heading("Qur'an text against tanzil.net (Simple Plain, with pause marks)")
{
  const tanzil = tanzilAyat()
  const pinsFile = join(AZKAR_SCRIPTS, '..', '..', 'src', 'features', 'azkar', 'data', 'fixtures', 'quran-tanzil-sha256.json')
  const pins = existsSync(pinsFile) ? JSON.parse(readFileSync(pinsFile, 'utf8')) : {}
  const fixture = quranFixture(data)
  for (const [key, text] of Object.entries(fixture)) {
    if (tanzil.get(key) !== text) problem(`${key} differs from the Tanzil download`)
    else if (pins[key] !== sha256(text)) problem(`${key} is not pinned to this text: run "node scripts/azkar/pin-quran.mjs"`)
    else console.log(`  ok    ${key}`)
  }
  for (const key of Object.keys(pins)) if (!(key in fixture)) problem(`${key} is pinned but no longer recited`)
  // Ayat that are fetched for a cross-check only (a supplication made of Qur'anic words).
  for (const [key, text] of Object.entries(quranAyat())) {
    if (key in fixture) continue
    if (tanzil.get(key) === text) console.log(`  ok    ${key} (not recited as Qur'an; used to check a supplication)`)
    else problem(`${key} differs from the Tanzil download`)
  }
}

// --- 2 to 4. Words and vowel marks against the other sources -----------------------------------

const witnessKey = (selector) =>
  [selector.from, selector.chapter, selector.index ?? selector.order ?? selector.entry]
    .filter((part) => part !== undefined)
    .join(':')

/**
 * The lam of the article is left bare by some typesetters and given a sukun by others, so a bare
 * article lam is not reported as a different reading. Any other difference is.
 */
function isArticleLam({ skeleton, index }) {
  const article = /^[\u0648\u0641\u0628\u0643\u0644]{0,2}\u0627\u0644/.exec(skeleton)
  return article !== null && index === article[0].length - 1
}

/**
 * The morning wording beside an evening item (the book prints the morning wording only): a witness
 * for the vowels of the words the two wordings share, whose other words are expected to differ.
 */
const otherSession = (spec, witness) =>
  spec.id.startsWith('evening-') && (witness.from === 'book' || (witness.from === 'asellam' && witness.chapter === 'morning'))

heading('Words and vowel marks against the committed witnesses')
for (const spec of ITEMS) {
  if (spec.arabic.from === 'quran') continue
  const arabic = data.items[spec.id].arabic
  const readings = new Set()
  const notes = []
  for (const witness of spec.witnesses) {
    const key = witnessKey(witness)
    const comparison = compareVocalised(arabic, tidy(record(witness).text))

    const differentWords = Math.max(comparison.onlyInA.length, comparison.onlyInB.length)
    const expectedWords = spec.knownWordDifferences?.[key] ?? 0
    const words = `[${comparison.onlyInA.join(' ')}] here, [${comparison.onlyInB.join(' ')}] there`
    if (otherSession(spec, witness)) {
      if (differentWords === 0) problem(`${spec.id} vs ${key}: expected the other session's wording to differ`)
    } else if (differentWords !== expectedWords) {
      problem(`${spec.id} vs ${key}: ${differentWords} different words, ${expectedWords} expected (${words})`)
    } else if (differentWords > 0) {
      notes.push(`${key}: ${differentWords} known word difference(s) (${words})`)
    }

    const expected = spec.knownWitnessConflicts?.[key] ?? 0
    const found = comparison.conflicts.length
    const detail = found > 0 ? ` (${comparison.conflicts.join(' ; ')})` : ''
    if (found !== expected) problem(`${spec.id} vs ${key}: ${found} conflicts, ${expected} expected${detail}`)
    else if (found > 0) notes.push(`${key}: ${found} known vowel disagreement(s)${detail}`)
    for (const letter of comparison.missingInA) if (!isArticleLam(letter)) readings.add(letter.word)
  }
  const gaps = incompleteVocalisation(arabic)
  if (gaps.length > 0) problem(`${spec.id}: incomplete vocalisation ${JSON.stringify(gaps)}`)
  console.log(`  ok    ${spec.id}  [${spec.witnesses.map(witnessKey).join(', ')}]`)
  for (const patch of spec.arabic.patches ?? []) {
    console.log(`          word ${patch.word} taken from ${witnessKey(patch.from)} (${patch.kind})`)
  }
  for (const text of notes) console.log(`          ${text}`)
  if (readings.size > 0) console.log(`          a witness marks one more letter in  ${[...readings].join(' ')}`)
}

heading('Completeness of the vocalisation, every recited text')
for (const item of Object.values(data.items)) {
  const gaps = incompleteVocalisation(item.arabic)
  if (gaps.length > 0) problem(`${item.id}: ${JSON.stringify(gaps)}`)
}
if (failures === 0) console.log(`  ok    ${Object.keys(data.items).length} texts, no letter left without its mark`)

// Optional witnesses: matched to an item by shared words, reported but never failing the run,
// because their own typing mistakes are not ours to explain.
function optionalWitnesses() {
  const witnesses = []
  const add = (source, raw, texts) => {
    if (raw) witnesses.push(...texts(JSON.parse(raw)).map((text) => ({ source, text })))
  }
  add('hisnmuslim.com', readCache('.cache/hisnmuslim-27.json'), (json) =>
    Object.values(json)[0].map((row) => row.ARABIC_TEXT.replace(/\[[^\]]*\]/g, ' ')),
  )
  add('wird', readCache('.cache/wird-data.json'), (json) => json.map((row) => row.arabic))
  add('fitrahive', readCache('.cache/fitrahive-morning.json'), (json) => json.map((row) => row.arabic))
  add('fitrahive', readCache('.cache/fitrahive-evening.json'), (json) => json.map((row) => row.arabic))
  return witnesses
}

function sharedWords(a, b) {
  const wordsB = new Set(looseSkeleton(b))
  const wordsA = looseSkeleton(a)
  return wordsA.filter((word) => wordsB.has(word)).length / Math.max(wordsA.length, 1)
}

heading('Vowel marks against the optional witnesses in .cache (information only)')
const optional = optionalWitnesses()
if (optional.length === 0) console.log('  skipped: nothing cached')
for (const spec of optional.length > 0 ? ITEMS : []) {
  if (spec.arabic.from === 'quran') continue
  const arabic = data.items[spec.id].arabic
  const lines = new Set()
  for (const witness of optional) {
    if (sharedWords(arabic, witness.text) < 0.95 || sharedWords(witness.text, arabic) < 0.8) continue
    const { conflicts } = compareVocalised(arabic, witness.text)
    lines.add(`${witness.source}: ${conflicts.length === 0 ? 'agrees' : conflicts.join(' ; ')}`)
  }
  console.log(`  ${spec.id}: ${lines.size > 0 ? [...lines].join(' | ') : 'no optional witness has this wording'}`)
}

// --- 5. Hadith numbers quoted in the references ------------------------------------------------

/**
 * The word "hundred", taken from the book's own remark on entry 19 ("a hundred times ..."). The
 * same tahlil is narrated to be said once, ten times and a hundred times, so matching the words of
 * the dhikr cannot tell those hadiths apart; the count word can.
 */
const HUNDRED = looseSkeleton(bookEntries()[19].annotations[0])[0]

/**
 * [item, edition, number as printed in the reference, count word expected or excluded].
 * Sahih Muslim is numbered differently by the API, so its numbers are not looked up here.
 */
const HADITH_NUMBERS = [
  ['morning-allahumma-bika-asbahna', 'tirmidhi', 3391],
  ['morning-allahumma-bika-asbahna', 'abudawud', 5068],
  ['evening-allahumma-bika-amsayna', 'tirmidhi', 3391],
  ['evening-allahumma-bika-amsayna', 'ibnmajah', 3868],
  ['sayyid-al-istighfar', 'bukhari', 6306],
  ['morning-asbahtu-ushhiduka', 'abudawud', 5069],
  ['morning-ma-asbaha-bi-min-nimah', 'abudawud', 5073],
  ['allahumma-afini-fi-badani', 'abudawud', 5090],
  ['hasbiyallahu-la-ilaha-illa-huwa', 'abudawud', 5081],
  ['allahumma-inni-asaluka-al-afwa-wal-afiyah', 'abudawud', 5074],
  ['allahumma-inni-asaluka-al-afwa-wal-afiyah', 'ibnmajah', 3871],
  ['allahumma-alim-al-ghayb-wash-shahadah', 'tirmidhi', 3392],
  ['allahumma-alim-al-ghayb-wash-shahadah', 'tirmidhi', 3529],
  ['allahumma-alim-al-ghayb-wash-shahadah', 'abudawud', 5067],
  ['bismillah-alladhi-la-yadurru', 'abudawud', 5088],
  ['bismillah-alladhi-la-yadurru', 'tirmidhi', 3388],
  ['bismillah-alladhi-la-yadurru', 'ibnmajah', 3869],
  ['raditu-billahi-rabban', 'abudawud', 5072],
  ['raditu-billahi-rabban', 'tirmidhi', 3389],
  ['morning-asbahna-rabbil-alamin', 'abudawud', 5084],
  ['la-ilaha-illallah-wahdahu-ten-times', 'abudawud', 5077, { without: HUNDRED }],
  ['la-ilaha-illallah-wahdahu-ten-times', 'ibnmajah', 3867, { without: HUNDRED }],
  ['la-ilaha-illallah-wahdahu-hundred-times', 'bukhari', 3293, { with: HUNDRED }],
  ['allahumma-inni-asaluka-ilman-nafian', 'ibnmajah', 925],
  ['astaghfirullah-wa-atubu-ilayh', 'bukhari', 6307],
]

async function hadithText(edition, number) {
  const path = `.cache/hadith/ara-${edition}-${number}.json`
  const file = join(AZKAR_SCRIPTS, path)
  if (!existsSync(file)) {
    if (!online) return null
    const response = await fetch(hadithUrl(edition, number))
    if (!response.ok) throw new Error(`${hadithUrl(edition, number)} answered ${response.status}`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  }
  return JSON.parse(readFileSync(file, 'utf8')).hadiths[0].text
}

const quotes = (text, number) => new RegExp(`(?<![0-9/])${number}(?![0-9/])`).test(text)

heading('Hadith numbers quoted in the references')
let skipped = 0
for (const [id, edition, number, count = {}] of HADITH_NUMBERS) {
  const item = data.items[id]
  if (!quotes(item.reference.en, number) || !quotes(item.reference.ar, number)) {
    problem(`${id}: the reference no longer quotes ${edition} ${number}`)
    continue
  }
  const text = await hadithText(edition, number)
  if (text === null) {
    skipped += 1
    continue
  }
  const share = sharedWords(item.arabic, text)
  const words = new Set(looseSkeleton(text))
  if (share < 0.6) problem(`${id}: ${edition} ${number} is a different hadith (${Math.round(share * 100)}% of its words)`)
  else if (count.without && words.has(count.without)) problem(`${id}: ${edition} ${number} is the hundred-times narration`)
  else if (count.with && !words.has(count.with)) problem(`${id}: ${edition} ${number} does not mention a hundred times`)
  else console.log(`  ok    ${id}: ${edition} ${number} (${Math.round(share * 100)}% of its words)`)
}
if (skipped > 0) problem(`${skipped} cited hadiths are not cached: run with --online to download and check them`)

// --- 6. Numbers that differ from the book's print -----------------------------------------------

function listChanges(kind) {
  const changes = new Map()
  for (const change of AMENDMENTS.filter((candidate) => candidate.kind === kind)) {
    const key = `${change.from} -> ${change.to}`
    changes.set(key, [...(changes.get(key) ?? []), change.id])
  }
  for (const [change, ids] of changes) console.log(`  ${change.padEnd(18)} ${[...new Set(ids)].join(', ')}`)
}

heading("Reference numbers corrected against the book's print (reasons are in mapping.mjs)")
listChanges('amend')
heading("Citations the book does not have, written with a phrase of the book and another number")
listChanges('citeAs')

console.log(failures === 0 ? '\nverify: no unexplained disagreement' : `\nverify: ${failures} problem(s)`)
process.exit(failures === 0 ? 0 : 1)
