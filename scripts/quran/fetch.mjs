// Downloads the Qur'an text and its page table from tanzil.net into the app's package.
//
//   node scripts/quran/fetch.mjs
//
// Both files are kept exactly as published, notice included: Tanzil's terms allow verbatim copies
// only. QuranResourceTests pins their hashes, so a change here must be investigated, not accepted.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RESOURCES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apple', 'AzkarKit', 'Sources', 'AzkarContent', 'Resources')

const FILES = [
  ['quran-uthmani.txt', 'https://tanzil.net/pub/download/index.php?quranType=uthmani&marks=true&sajdah=true&rub=true&outType=txt-2&agree=true'],
  ['quran-data.xml', 'https://tanzil.net/res/text/metadata/quran-data.xml'],
]

for (const [name, url] of FILES) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(join(RESOURCES, name), bytes)
  console.log(`${name}: ${bytes.length} bytes`)
}
