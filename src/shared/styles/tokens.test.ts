import { describe, expect, it } from 'vitest'
import { contrast, parseCss, readStylesheet, styleOf } from './testing'

const rules = parseCss(readStylesheet('src/shared/styles/tokens.css'))
const light = styleOf(rules, ':root')
const darkBySystem = styleOf(rules, ":root:not([data-theme='light'])", '(prefers-color-scheme: dark)')
const darkByChoice = styleOf(rules, ":root[data-theme='dark']")

/** A theme's colours: the dark theme overrides the light one and inherits the rest. */
const themes = [
  ['light', light],
  ['dark', { ...light, ...darkByChoice }],
] as const

const HEX = /^#[0-9a-f]{6}$/

/** WCAG 1.4.11: a control's state must stand out from what surrounds it. */
const GRAPHIC = 3
/** WCAG 1.4.3: body text. */
const TEXT = 4.5

// [what it is, foreground token, background token, minimum ratio]
const PAIRS = [
  ['the track of a switch that is off, on a card', '--switch-off', '--surface', GRAPHIC],
  ['the knob of a switch that is off, on its track', '--switch-knob', '--switch-off', GRAPHIC],
  ['the knob of a switch that is on, on its track', '--on-primary', '--primary', GRAPHIC],
  ['the ring of the chosen segment, on the segmented track', '--primary', '--surface-2', GRAPHIC],
  ['the ring of the selected calendar day, on the card', '--primary', '--surface', GRAPHIC],
  ['a jamaah mark on the selected calendar day', '--accent', '--primary-soft', GRAPHIC],
  ['a jamaah mark on a card', '--accent', '--surface', GRAPHIC],
  ['the glyph of a jamaah badge', '--surface', '--accent', GRAPHIC],
  ['the gold rim around the recommended session, on the page', '--accent', '--bg', GRAPHIC],
  ['quiet text on a hovered row', '--ink-3', '--surface-2', TEXT],
  ['quiet text on the page', '--ink-3', '--bg', TEXT],
  ['quiet text on a card', '--ink-3', '--surface', TEXT],
] as const

describe('design tokens', () => {
  it('defines the dark theme identically for the system setting and for the explicit choice', () => {
    expect(Object.keys(darkBySystem).length).toBeGreaterThan(20)
    expect(darkBySystem).toEqual(darkByChoice)
  })

  describe.each(themes)('%s theme', (_name, theme) => {
    it.each(PAIRS)('keeps %s distinguishable', (_what, foreground, background, minimum) => {
      const colours = [theme[foreground], theme[background]] as [string, string]
      expect(colours[0]).toMatch(HEX)
      expect(colours[1]).toMatch(HEX)
      expect(contrast(...colours)).toBeGreaterThanOrEqual(minimum)
    })
  })
})

describe('contrast', () => {
  it('follows the WCAG formula', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#777777')).toBe(1)
    // A published reference pair: #767676 is the lightest grey that passes AA on white.
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5)
  })
})
