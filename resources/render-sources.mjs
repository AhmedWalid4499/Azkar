/**
 * Renders the source images @capacitor/assets turns into the iOS and Android icons and
 * splash screens, from the artwork in scripts/pwa. Run `npm run assets`, which runs this and
 * then the generator, after changing the artwork; commit what both write.
 *
 *   icon-only.png        1024  iOS icon, Android's pre-8.0 icons  icon-apple.svg: opaque, full bleed
 *   icon-foreground.png  1024  Android adaptive icon, artwork     icon.svg's artwork alone, at 110%
 *   icon-background.png  1024  Android adaptive icon, ground      --primary
 *   splash.png           2732  launch screen, light               icon.svg on the light --bg
 *   splash-dark.png      2732  launch screen, dark                icon.svg on the dark --bg
 */
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const artwork = (name) => resolve(root, 'scripts/pwa', name)

/** From src/shared/styles/tokens.css: --primary (light), and --bg of each theme. */
const GROUND = '#0e6b54'
const BG_LIGHT = '#f5f1e8'
const BG_DARK = '#0e1513'

/**
 * The generator insets both adaptive-icon layers by 16.7%, so the foreground spans the 72 of 108
 * units the launcher shows, cut to its shape. At 110% the artwork fills that cut-out about as
 * much as it fills the PWA's maskable icon, and stays inside the 66-unit safe circle.
 */
const FOREGROUND_SCALE = 1.1
/** The icon's width on the splash canvas: about 160 points tall on an iPhone. */
const SPLASH_ICON = 560

const png = { compressionLevel: 9 }

function render(svg, size) {
  return sharp(Buffer.from(svg), { density: 72 * (size / 512) })
    .resize(size, size)
    .png(png)
}

/** The crescent and the star of icon.svg, without the rounded ground or the comment. */
async function artworkOnly() {
  const svg = await readFile(artwork('icon.svg'), 'utf8')
  const paths = svg.match(/<path\b[^>]*\/>/g)
  if (!paths || paths.length === 0) throw new Error('scripts/pwa/icon.svg has no <path> elements')
  return paths.join('')
}

async function splash(background) {
  const icon = await render(await readFile(artwork('icon.svg'), 'utf8'), SPLASH_ICON).toBuffer()
  const canvas = await sharp({ create: { width: 2732, height: 2732, channels: 3, background } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer()
  // Composited in a second step: sharp composites last, after any flatten in the same pipeline.
  return sharp(canvas).flatten({ background }).png(png)
}

const art = await artworkOnly()
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(${FOREGROUND_SCALE}) translate(-256 -256)">${art}</g>
</svg>`

const outputs = [
  ['icon-only.png', async () => render(await readFile(artwork('icon-apple.svg'), 'utf8'), 1024).flatten({ background: GROUND })],
  ['icon-foreground.png', async () => render(foreground, 1024)],
  ['icon-background.png', async () => sharp({ create: { width: 1024, height: 1024, channels: 3, background: GROUND } }).png(png)],
  ['splash.png', () => splash(BG_LIGHT)],
  ['splash-dark.png', () => splash(BG_DARK)],
]

for (const [name, make] of outputs) {
  const file = resolve(here, name)
  await (await make()).toFile(file)
  console.log(`wrote ${relative(root, file)}`)
}
