// Pins every ayah the dataset recites to the text published by tanzil.net itself.
//
//   node scripts/azkar/fetch.mjs --cache     downloads the Tanzil text into .cache/
//   node scripts/azkar/pin-quran.mjs         writes fixtures/quran-tanzil-sha256.json
//
// build.mjs takes the Qur'an from the Al Quran Cloud API and writes it into both azkar.json and
// fixtures/quran.json, so those two files cannot check each other. This script never reads the
// API files: it hashes the same ayat in the file downloaded from tanzil.net. data.test.ts then
// requires every ayah of fixtures/quran.json to have the hash recorded here, which makes the
// offline test an independent check of the Qur'anic text. Run it again only when the set of
// recited ayat changes; a changed hash for an ayah already pinned must be investigated, not accepted.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AZKAR_SCRIPTS } from './lib/raw.mjs'

const DATA_DIR = join(AZKAR_SCRIPTS, '..', '..', 'src', 'features', 'azkar', 'data')
const TANZIL = join(AZKAR_SCRIPTS, '.cache', 'tanzil-simple-plain-signs.txt')
const EDITION = 'Tanzil Quran Text (Simple Plain, Version 1.1)'

function fail(message) {
  console.error(`pin-quran: ${message}`)
  process.exit(1)
}

/** Ayah texts of the tanzil.net download keyed "surah:ayah", the basmala detached from first ayat. */
export function tanzilAyat() {
  if (!existsSync(TANZIL)) fail('the Tanzil text is not cached: run "node scripts/azkar/fetch.mjs --cache"')
  const file = readFileSync(TANZIL, 'utf8').replace(/^\uFEFF/, '')
  if (!file.includes(EDITION)) fail(`the cached file is not the ${EDITION}`)
  const ayat = new Map()
  for (const line of file.split('\n')) {
    const [surah, ayah, text] = line.split('|')
    if (text !== undefined) ayat.set(`${surah}:${ayah}`, text.trimEnd())
  }
  if (ayat.size !== 6236) fail(`expected 6236 ayat in the Tanzil text, found ${ayat.size}`)
  const basmala = ayat.get('1:1')
  for (const [key, text] of ayat) {
    const [surah, ayah] = key.split(':').map(Number)
    // Tanzil prints the basmala in front of the first ayah of every surah but 1 and 9.
    if (ayah === 1 && surah !== 1 && text.startsWith(`${basmala} `)) ayat.set(key, text.slice(basmala.length + 1))
  }
  return ayat
}

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const recited = Object.keys(JSON.parse(readFileSync(join(DATA_DIR, 'fixtures', 'quran.json'), 'utf8')))
  const ayat = tanzilAyat()
  const pins = Object.fromEntries(
    recited.map((key) => [key, sha256(ayat.get(key) ?? fail(`the Tanzil text has no ayah ${key}`))]),
  )
  writeFileSync(join(DATA_DIR, 'fixtures', 'quran-tanzil-sha256.json'), `${JSON.stringify(pins, null, 2)}\n`)
  console.log(`pinned ${recited.length} ayat to the tanzil.net download`)
}
