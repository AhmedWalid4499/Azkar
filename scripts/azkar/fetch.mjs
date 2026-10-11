// Downloads the pinned source files listed in sources.mjs.
//
// A fresh clone has to run this once before build.mjs or verify.mjs: three of the inputs (the
// adhkar compilations) are not committed, see raw/.gitignore. The app and its tests need none of
// this; they read the committed azkar.json and fixtures.
//
//   node scripts/azkar/fetch.mjs            fetch whatever is missing from raw/
//   node scripts/azkar/fetch.mjs --cache    also fetch the optional witnesses into .cache/
//   node scripts/azkar/fetch.mjs --force    re-download even when a file is already present
//
// Files are stored byte for byte. A file whose sha256 differs from sources.mjs is reported and
// the script exits non-zero: review the upstream change before pinning the new hash.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CACHE, RAW } from './sources.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = new Set(process.argv.slice(2))
const force = args.has('--force')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function download(entry) {
  const file = join(here, entry.path)
  if (existsSync(file) && !force) return readFileSync(file)
  const response = await fetch(entry.url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${entry.url} answered ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, bytes)
  console.log(`fetched ${entry.path} (${bytes.length} bytes)`)
  return bytes
}

let mismatches = 0
for (const entry of RAW) {
  const actual = sha256(await download(entry))
  if (entry.sha256 === actual) continue
  mismatches += 1
  console.error(`sha256 mismatch for ${entry.path}\n  pinned ${entry.sha256}\n  actual ${actual}`)
}

if (args.has('--cache')) {
  for (const entry of CACHE) {
    try {
      await download(entry)
    } catch (error) {
      console.warn(`skipped optional ${entry.path}: ${error.message}`)
    }
  }
}

if (mismatches > 0) process.exit(1)
console.log(`raw sources present and matching their pinned hashes (${RAW.length} files)`)
