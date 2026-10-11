/**
 * Renders the app icons in public/ from the SVG sources next to this file.
 * Run with `npm run icons` after changing a source, and commit the results.
 *
 *   icon.svg           rounded ground, transparent corners  -> pwa-192x192.png, pwa-512x512.png
 *   icon-maskable.svg  full-bleed ground, artwork at 90%    -> maskable-icon-512x512.png
 *   icon-apple.svg     full-bleed ground, artwork at 100%   -> apple-touch-icon-180x180.png
 *   public/favicon.svg the browser tab icon                 -> favicon.ico (48px, for browsers without SVG favicons)
 */
import { writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateFavicon, generateMaskableAsset, generateTransparentAsset } from '@vite-pwa/assets-generator/api'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const publicDir = resolve(root, 'public')

/** Must match --primary (light) in src/shared/styles/tokens.css and the ground of the SVG sources. */
const GROUND = '#0e6b54'

// Lossless: the artwork is three flat colours, so the files stay small without quantising.
const outputOptions = { compressionLevel: 9 }
const transparent = { padding: 0, resizeOptions: { fit: 'contain', background: 'transparent' }, outputOptions }
const opaque = { padding: 0, resizeOptions: { fit: 'contain', background: GROUND }, outputOptions }

const source = (name) => resolve(here, name)

const pngs = [
  ['pwa-192x192.png', () => generateTransparentAsset('png', source('icon.svg'), 192, transparent)],
  ['pwa-512x512.png', () => generateTransparentAsset('png', source('icon.svg'), 512, transparent)],
  ['maskable-icon-512x512.png', () => generateMaskableAsset('png', source('icon-maskable.svg'), 512, opaque)],
  ['apple-touch-icon-180x180.png', () => generateMaskableAsset('png', source('icon-apple.svg'), 180, opaque)],
]

const written = []

for (const [name, render] of pngs) {
  const image = await render()
  const file = resolve(publicDir, name)
  await image.toFile(file)
  written.push(file)
}

const favicon48 = await generateTransparentAsset('png', resolve(publicDir, 'favicon.svg'), 48, transparent)
const ico = resolve(publicDir, 'favicon.ico')
await writeFile(ico, await generateFavicon('png', await favicon48.toBuffer()))
written.push(ico)

for (const file of written) console.log(`wrote ${relative(root, file)}`)
