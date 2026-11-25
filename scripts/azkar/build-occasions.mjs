// Assembles the duas for occasions for the native app:
//   apple/AzkarKit/Sources/AzkarContent/Resources/occasions.json
//   scripts/native/content/fixtures/occasion-fingerprints.json (for the Swift tests)
//
//   node scripts/azkar/build-occasions.mjs
//
// Inputs: asellam/HisnElMuslim's hisn.json (raw/, pinned in sources.mjs and checked by its
// sha256) and mapping-occasions.mjs with the English in occasions/part-*.mjs. As in build.mjs, no
// Arabic is typed in any file of this directory, and the build refuses to run if it finds some.
//
// What is copied, and the only changes made to it:
//   chapter titles   asellam's title of the chapter, tidy()
//   recited text     the entry's whole text as asellam prints it, tidy(): invisible formatting
//                    removed, whitespace collapsed and trimmed. The book's brackets stay: (…) round
//                    words quoted inside a narration, […] round a variant wording, {…} round
//                    Qur'an. Nothing is patched.
//   references       asellam's copy of the book's footnote, tidy()
//   counts           asellam's count; an entry that is guidance rather than words to say has none
//
// Unlike the daily sessions, the occasions are not cross-checked word by word against a second
// witness, and a word the source leaves without its last mark is shown as the source has it. The
// build prints every such word, and the test fixture keeps a fingerprint of each text so that a
// later edit of a single mark is noticed.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fingerprint, incompleteVocalisation, tidy } from './lib/arabic.mjs'
import { AZKAR_SCRIPTS, readRaw } from './lib/raw.mjs'
import { CHAPTER_TITLES, ENTRIES, LEFT_OUT, OCCASIONS_VERSION, READ_AS_SESSIONS, THEMES } from './mapping-occasions.mjs'
import { SOURCES } from './sources.mjs'

const APPLE = join(AZKAR_SCRIPTS, '..', '..', 'apple', 'AzkarKit')
const OUTPUT = join(APPLE, 'Sources', 'AzkarContent', 'Resources', 'occasions.json')
const FINGERPRINTS = join(AZKAR_SCRIPTS, '..', 'native', 'content', 'fixtures', 'occasion-fingerprints.json')
const TRANSLITERATION = /^[A-Za-z\u0100\u0101\u012B\u016B\u02BE\u02BF\u1E0D\u1E24\u1E25\u1E63\u1E6D\u1E93 ,.:-]+$/
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

function fail(message) {
  throw new Error(`occasions build: ${message}`)
}

function assertNoHandTypedArabic() {
  const files = [
    ...readdirSync(AZKAR_SCRIPTS).filter((name) => name.endsWith('.mjs')),
    ...readdirSync(join(AZKAR_SCRIPTS, 'lib')).map((name) => join('lib', name)),
    ...readdirSync(join(AZKAR_SCRIPTS, 'occasions')).map((name) => join('occasions', name)),
  ]
  for (const file of files) {
    const at = readFileSync(join(AZKAR_SCRIPTS, file), 'utf8').search(ARABIC)
    if (at >= 0) fail(`${file} contains Arabic script at offset ${at}; Arabic must come from raw/`)
  }
}

assertNoHandTypedArabic()

const book = Object.entries(JSON.parse(readRaw('raw/asellam-hisn-el-muslim/hisn.json').replace(/^\uFEFF/, '')))
if (book.length !== 133) fail(`asellam has ${book.length} chapters, 133 expected`)

// Every chapter is accounted for exactly once.
const placed = [...READ_AS_SESSIONS, ...LEFT_OUT, ...THEMES.flatMap((theme) => theme.chapters)]
for (let number = 1; number <= book.length; number += 1) {
  const times = placed.filter((chapter) => chapter === number).length
  if (times !== 1) fail(`chapter ${number} is placed ${times} times`)
}

const entriesByChapter = new Map()
for (const entry of ENTRIES) {
  const key = `${entry.chapter}.${entry.index}`
  if (entriesByChapter.has(key)) fail(`entry ${key} is mapped twice`)
  entriesByChapter.set(key, entry)
}

const items = {}
const chapters = []
const fingerprints = {}
const unvowelled = []
let used = 0

for (const theme of THEMES) {
  for (const number of theme.chapters) {
    const [arabicTitle, chapter] = book[number - 1]
    const title = CHAPTER_TITLES[number] ?? fail(`chapter ${number} has no English title`)
    const ids = []
    chapter.Adhkar.forEach((source, index) => {
      const mapped = entriesByChapter.get(`${number}.${index}`) ?? fail(`entry ${number}.${index} is not mapped`)
      used += 1
      const id = `occasion-${number}-${index + 1}`
      const arabic = tidy(source.Text)
      if (!arabic) fail(`${id} has no text`)
      const say = mapped.kind === 'say'
      if (!say && mapped.kind !== 'read') fail(`${id} has kind "${mapped.kind}"`)
      if (say && !TRANSLITERATION.test(mapped.transliteration ?? '')) fail(`${id} transliteration is not in the scheme`)
      if (!say && mapped.transliteration) fail(`${id} is guidance but has a transliteration`)
      for (const field of ['translation', 'reference']) {
        if (!mapped[field]?.trim()) fail(`${id} has no English ${field}`)
        if (ARABIC.test(mapped[field])) fail(`${id} English ${field} has Arabic script`)
      }
      for (const problem of incompleteVocalisation(arabic)) unvowelled.push(`${id}: ${problem.reason}`)
      items[id] = {
        id,
        arabic,
        ...(say ? { transliteration: mapped.transliteration } : {}),
        translation: mapped.translation,
        repeat: say ? Math.max(1, Number(source.Count) || 1) : 0,
        reference: { en: mapped.reference, ar: tidy(source.Reference ?? '') },
      }
      fingerprints[id] = fingerprint(arabic)
      ids.push(id)
    })
    chapters.push({ number, theme: theme.id, title: { en: title, ar: tidy(arabicTitle) }, items: ids })
  }
}

if (used !== ENTRIES.length) fail(`${ENTRIES.length - used} mapped entries belong to no chapter in a theme`)

const theBook = SOURCES.find((source) => source.name.startsWith('Hisn al-Muslim'))
const asellam = SOURCES.find((source) => source.url.includes('asellam/HisnElMuslim'))
if (!theBook || !asellam) fail('the book or asellam is not among the sources')

const dataset = {
  version: OCCASIONS_VERSION,
  sources: [
    {
      name: "Hisn al-Muslim (Fortress of the Muslim) by Sa'id ibn Ali ibn Wahf al-Qahtani, published by Matba'at Safir, Riyadh",
      url: theBook.url,
      license: theBook.license,
      usedFor: 'The chapters, their order and the duas for every occasion, with their counts and references',
    },
    {
      name: asellam.name,
      url: asellam.url,
      license: asellam.license,
      usedFor:
        'The vocalised Arabic text of the book: every dua, chapter title and reference of the duas for occasions. The English meanings, transliterations and references were written for this app',
    },
  ],
  themes: THEMES.map(({ id, title, chapters }) => ({ id, title, chapters })),
  chapters,
  items,
}

writeFileSync(OUTPUT, `${JSON.stringify(dataset, null, 2)}\n`)
writeFileSync(FINGERPRINTS, `${JSON.stringify(fingerprints, null, 2)}\n`)

const said = Object.values(items).filter((item) => item.repeat > 0).length
console.log(`${chapters.length} chapters, ${Object.keys(items).length} entries (${said} to say)`)
console.log(`${unvowelled.length} words shown as the source leaves them:`)
for (const line of unvowelled) console.log(`  ${line}`)
