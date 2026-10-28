import { describe, expect, it } from 'vitest'
import { parseCss, readStylesheet } from '../../shared/styles/testing'

// jsdom applies no stylesheet, so these read the files and check what the rules declare.
const SHEETS = [
  'FastToggle.module.css',
  'FastingCard.module.css',
  'FastingDayPanel.module.css',
  'FastingStats.module.css',
  'RamadanCard.module.css',
].map((name) => [name, parseCss(readStylesheet(`src/features/fasting/${name}`))] as const)

/** Properties tied to the left or right edge, which would not flip in Arabic. */
const PHYSICAL = /^(margin|padding|border)-(left|right)|^(left|right)$|^text-align$|^float$/
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/i

describe.each(SHEETS)('%s', (_name, rules) => {
  it('is read', () => {
    expect(rules.length).toBeGreaterThan(3)
  })

  it('takes every colour from the design tokens, so both themes stay in step', () => {
    for (const rule of rules) {
      for (const [property, value] of Object.entries(rule.declarations)) {
        expect(`${rule.selectors.join(', ')} { ${property}: ${value} }`).not.toMatch(COLOUR_LITERAL)
      }
    }
  })

  it('lays out with logical properties, so the layout mirrors in Arabic', () => {
    for (const rule of rules) {
      for (const [property, value] of Object.entries(rule.declarations)) {
        if (property === 'text-align') expect(['start', 'end', 'center']).toContain(value)
        else expect(property).not.toMatch(PHYSICAL)
      }
    }
  })

  it('keeps every control at least 44px tall, for a fingertip', () => {
    for (const rule of rules) {
      const height = rule.declarations['min-height']
      if (height !== undefined && rule.selectors.some((selector) => /chip|choice|qada|input/.test(selector))) {
        expect(Number.parseFloat(height)).toBeGreaterThanOrEqual(44)
      }
    }
  })
})
