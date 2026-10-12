import { describe, expect, it } from 'vitest'
import { parseCss, readStylesheet, styleOf } from '../../shared/styles/testing'

// jsdom applies no stylesheet, so these read the files and check what the rules declare.

describe('status picker labels', () => {
  const label = styleOf(parseCss(readStylesheet('src/features/prayer-log/StatusPicker.module.css')), '.label')

  it('wrap instead of being cut to a letter and an ellipsis at large text sizes', () => {
    expect(label).not.toHaveProperty('text-overflow')
    expect(label).not.toHaveProperty('overflow')
    expect(label['white-space'] ?? 'normal').toBe('normal')
    expect(label['text-wrap']).toBe('balance')
  })

  it('break a word that is wider than its column rather than spill over the next option', () => {
    expect(label['overflow-wrap']).toBe('anywhere')
    expect(label['text-align']).toBe('center')
  })
})

describe('the selected calendar day', () => {
  const rules = parseCss(readStylesheet('src/features/prayer-log/MonthCalendar.module.css'))

  it('is ringed in the primary colour, because its tint is too faint to tell apart from the card', () => {
    const selected = styleOf(rules, '.selected')
    expect(selected.background).toBe('var(--primary-soft)')
    expect(selected['box-shadow']).toBe('inset 0 0 0 2px var(--primary)')
    // The ring must not disappear under the pointer.
    expect(styleOf(rules, '.selected:hover:not(:disabled)')['box-shadow']).toBe(selected['box-shadow'])
  })

  it('shows keyboard focus as a second ring around the first, not as the same ring a pixel thicker', () => {
    const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN')
    const page = parseCss(readStylesheet('src/shared/styles/global.css'))
    const tokens = styleOf(parseCss(readStylesheet('src/shared/styles/tokens.css')), ':root')
    // "3px solid var(--primary)": the same colour as the selection ring.
    const outline = styleOf(page, ':focus-visible').outline
    expect(outline).toContain('var(--primary)')
    expect(styleOf(rules, '.selected')['box-shadow']).toContain('inset 0 0 0 2px var(--primary)')

    // An outline is drawn outwards from its offset, so its outer edge lies at offset + width.
    const offset = (selector: string) => px(styleOf(rules, selector)['outline-offset'])
    // On other days the focus ring lies just inside the cell's edge, exactly where the selection ring is drawn...
    expect(offset('.day:focus-visible') + px(outline)).toBe(0)
    // ...so on the selected day it starts outside the cell, clear of that ring and of the day's number and marks.
    expect(offset('.selected:focus-visible')).toBeGreaterThan(0)
    // The card clips what leaves it, so the ring has to fit in the padding beside the outermost days.
    expect(styleOf(rules, '.body').padding).toMatch(/^var\(--space-2\) var\(--space-2\) /)
    expect(offset('.selected:focus-visible') + px(outline)).toBeLessThanOrEqual(px(tokens['--space-2']))

    // Both rules weigh the same, so the later one has to be the selected day's.
    const at = (selector: string) => rules.findIndex((rule) => rule.selectors.includes(selector))
    expect(at('.selected:focus-visible')).toBeGreaterThan(at('.day:focus-visible'))
  })

  it('still shows today by the ring around its number', () => {
    expect(styleOf(rules, '.today .number')['box-shadow']).toBe('inset 0 0 0 2px var(--primary)')
  })
})
