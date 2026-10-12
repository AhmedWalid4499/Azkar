// Helpers for tests that guard a stylesheet. jsdom applies no CSS, so such a test reads the file
// and checks what its rules declare.

// The test runner hands back an empty string for every stylesheet import, `?raw` included, so the
// file is read through Node. The app's TypeScript project has no Node types; this is all it needs.
declare const process: {
  getBuiltinModule(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string }
}

/** The text of a stylesheet, given its path from the project root (where the tests run). */
export function readStylesheet(path: string): string {
  return process.getBuiltinModule('node:fs').readFileSync(path, 'utf8')
}

export interface CssRule {
  selectors: string[]
  /** The condition of the enclosing `@media`, e.g. "(max-height: 520px)", or `null` outside one. */
  media: string | null
  declarations: Record<string, string>
}

const squeeze = (text: string) => text.replace(/\s+/g, ' ').trim()

function parseDeclarations(body: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon === -1) continue
    declarations[part.slice(0, colon).trim()] = squeeze(part.slice(colon + 1))
  }
  return declarations
}

/** Every style rule of a stylesheet, in order. Understands `@media`; other at-rules are skipped. */
export function parseCss(source: string): CssRule[] {
  const rules: CssRule[] = []

  const walk = (text: string, media: string | null) => {
    let cursor = 0
    while (cursor < text.length) {
      const open = text.indexOf('{', cursor)
      if (open === -1) return
      let depth = 1
      let close = open + 1
      while (close < text.length && depth > 0) {
        if (text[close] === '{') depth++
        else if (text[close] === '}') depth--
        close++
      }
      const prelude = squeeze(text.slice(cursor, open))
      const body = text.slice(open + 1, close - 1)
      if (prelude.startsWith('@media')) walk(body, squeeze(prelude.slice('@media'.length)))
      else if (!prelude.startsWith('@'))
        rules.push({ selectors: prelude.split(',').map(squeeze), media, declarations: parseDeclarations(body) })
      cursor = close
    }
  }

  walk(source.replace(/\/\*[\s\S]*?\*\//g, ''), null)
  return rules
}

/** What the rules for exactly `selector` declare, later rules winning, inside `media` or outside any. */
export function styleOf(rules: CssRule[], selector: string, media: string | null = null): Record<string, string> {
  const matching = rules.filter((rule) => rule.media === media && rule.selectors.includes(selector))
  return Object.assign({}, ...matching.map((rule) => rule.declarations)) as Record<string, string>
}

function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [lighter = 0, darker = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}
