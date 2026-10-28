import { describe, expect, it } from 'vitest'
import { contrast, parseCss, readStylesheet, styleOf } from '../../shared/styles/testing'

// jsdom applies no stylesheet, so these read the files and check what the rules declare.

const SHEETS = ['src/features/qibla/QiblaDial.module.css', 'src/features/qibla/QiblaPage.module.css']
const COLOUR_PROPERTIES = ['color', 'background', 'background-color', 'fill', 'stroke', 'border-color', 'outline-color']
const PHYSICAL = /^(margin|padding|border)-(left|right|top|bottom)|^(left|right|width|height|min-width|max-width|min-height|max-height)$/

describe.each(SHEETS)('%s', (sheet) => {
  const rules = parseCss(readStylesheet(sheet))

  it('takes every colour from the design tokens, so both themes apply', () => {
    for (const rule of rules) {
      for (const [property, value] of Object.entries(rule.declarations)) {
        if (COLOUR_PROPERTIES.includes(property)) expect(value, `${rule.selectors.join(', ')} { ${property} }`).toMatch(/^var\(--[a-z0-9-]+\)$/)
      }
    }
  })

  it('uses logical properties, so the layout follows the direction of the text', () => {
    for (const rule of rules) {
      for (const property of Object.keys(rule.declarations)) expect(property).not.toMatch(PHYSICAL)
    }
  })
})

describe('the dial', () => {
  const rules = parseCss(readStylesheet('src/features/qibla/QiblaDial.module.css'))
  const tokens = parseCss(readStylesheet('src/shared/styles/tokens.css'))
  const light = styleOf(tokens, ':root')
  const themes = [
    ['light', light],
    ['dark', { ...light, ...styleOf(tokens, ":root[data-theme='dark']") }],
  ] as const
  const token = (value: string | undefined) => /^var\((--[a-z0-9-]+)\)$/.exec(value ?? '')?.[1] ?? ''
  const face = token(styleOf(rules, '.face').fill)

  it('fits a 360-pixel screen and keeps its proportions', () => {
    expect(styleOf(rules, '.dial')['inline-size']).toBe('min(100%, 300px)')
    expect(styleOf(rules, '.dial')['aspect-ratio']).toBe('240 / 256')
  })

  describe.each(themes)('in the %s theme', (_name, theme) => {
    it.each([
      ['the compass letters', '.letter', 'fill', 4.5],
      ['the north letter', '.north', 'fill', 4.5],
      ['the Qibla arrow', '.shaft', 'stroke', 3],
      ['the Kaaba mark', '.kaaba', 'fill', 3],
      ['the mark for where the phone points', '.index', 'fill', 3],
      ['the graduations', '.tickMajor', 'stroke', 3],
    ])('draws %s clearly on the face', (_what, selector, property, minimum) => {
      const colour = theme[token(styleOf(rules, selector)[property]) as keyof typeof theme]
      const background = theme[face as keyof typeof theme]
      expect(contrast(colour ?? '', background ?? '')).toBeGreaterThanOrEqual(minimum)
    })
  })
})
