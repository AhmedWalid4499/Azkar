// Downloads al-Mukhtasar fi Tafsir al-Qur'an al-Karim (Arabic), by the Tafsir Center for Qur'anic
// Studies, from QuranEnc.com into the app's package as tafsir-mukhtasar.json.
//
//   node scripts/quran/fetch-tafsir.mjs
//
// QuranEnc's terms allow republishing its texts unchanged, crediting the publisher and
// QuranEnc.com with the version. So each ayah's text is copied exactly as the database holds it;
// only the container changes, from SQLite to JSON (one string per ayah, in mushaf order).
// QuranTafsirTests pins the file's hash, so a change here must be investigated, not accepted.

import { writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RESOURCES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apple', 'AzkarKit', 'Sources', 'AzkarContent', 'Resources')
const KEY = 'arabic_mokhtasar'
const URL = `https://quranenc.com/downloads/sqlite/${KEY}.sqlite`
// QuranEnc publishes no version for its Arabic tafsirs; the day of the download stands for it.
const RETRIEVED = process.env.RETRIEVED ?? new Date().toISOString().slice(0, 10)

const response = await fetch(URL)
if (!response.ok) throw new Error(`${URL}: ${response.status}`)
const file = join(tmpdir(), `${KEY}-${process.pid}.sqlite`)
writeFileSync(file, Buffer.from(await response.arrayBuffer()))

const db = new DatabaseSync(file, { readOnly: true })
const rows = db.prepare('SELECT sura, aya, translation, footnotes FROM translations ORDER BY sura, aya').all()
if (rows.length !== 6236) throw new Error(`${rows.length} rows, not 6236`)
let previous = [1, 0]
for (const row of rows) {
  const next = row.sura === previous[0] ? [previous[0], previous[1] + 1] : [previous[0] + 1, 1]
  if (row.sura !== next[0] || row.aya !== next[1]) throw new Error(`${row.sura}:${row.aya} out of order`)
  if (row.footnotes) throw new Error(`${row.sura}:${row.aya} has footnotes, which the app does not show`)
  if (typeof row.translation !== 'string' || !row.translation.trim()) throw new Error(`${row.sura}:${row.aya} is empty`)
  previous = next
}

const out = {
  title: 'المختصر في تفسير القرآن الكريم',
  publisher: 'مركز تفسير للدراسات القرآنية',
  source: `https://quranenc.com/ar/browse/${KEY}`,
  key: KEY,
  retrieved: RETRIEVED,
  ayat: rows.map((row) => row.translation),
}
const json = JSON.stringify(out) + '\n'
writeFileSync(join(RESOURCES, 'tafsir-mukhtasar.json'), json)
console.log(`tafsir-mukhtasar.json: ${Buffer.byteLength(json)} bytes, ${rows.length} ayat`)
