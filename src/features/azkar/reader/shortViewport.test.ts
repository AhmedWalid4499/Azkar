import { describe, expect, it } from 'vitest'
import { parseCss, readStylesheet, styleOf } from '../../../shared/styles/testing'

// jsdom lays nothing out, so this reads the stylesheet: on a short screen the reader must give
// the height back to the dhikr. Pinned at full size, the header (78px), the dock (133px) and
// the app's tab bar (65px) leave one line of Arabic on a phone held sideways.

const SHORT = '(max-height: 520px)'
const SHORT_AND_NARROW = '(max-height: 520px) and (max-width: 479px)'

const rules = parseCss(readStylesheet('src/features/azkar/reader/reader.module.css'))
const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN')

describe('the reader on a short screen', () => {
  it('is pinned top and bottom at full height', () => {
    expect(styleOf(rules, '.header').position).toBe('sticky')
    expect(styleOf(rules, '.dock').position).toBe('fixed')
    expect(styleOf(rules, '.dockInner')['flex-direction']).toBe('column')
  })

  it('lets the header scroll away with the text', () => {
    expect(styleOf(rules, '.header', SHORT).position).toBe('static')
  })

  it('lays the dock out as one row, with a shorter counter beside the tools', () => {
    expect(styleOf(rules, '.dockInner', SHORT)['flex-direction']).toBe('row')
    expect(styleOf(rules, '.tools', SHORT).flex).toBe('none')
    expect(styleOf(rules, '.counter', SHORT).flex).toBe('1')
    expect(px(styleOf(rules, '.counter', SHORT)['min-height'])).toBeLessThan(px(styleOf(rules, '.counter')['min-height']))
    // Still a comfortable target.
    expect(px(styleOf(rules, '.counter', SHORT)['min-height'])).toBeGreaterThanOrEqual(44)
  })

  it('reserves no more room under the text than the smaller dock needs', () => {
    const full = px(styleOf(rules, '.reader')['--dock-space'])
    const short = px(styleOf(rules, '.reader', SHORT)['--dock-space'])
    // One row: the 1px border, 8px above and below, and the counter.
    const dock = 1 + 8 + px(styleOf(rules, '.counter', SHORT)['min-height']) + 8
    expect(styleOf(rules, '.dockInner', SHORT)['padding-block']).toBe('var(--space-2)')
    expect(short).toBeGreaterThanOrEqual(dock)
    expect(short).toBeLessThan(full / 1.5)
  })

  it('still lets the last line scroll clear of the dock when the text is twice its size', () => {
    const tokens = styleOf(parseCss(readStylesheet('src/shared/styles/tokens.css')), ':root')
    const page = styleOf(parseCss(readStylesheet('src/shared/styles/global.css')), 'body')
    const rem = (token: string) => px(tokens[token]) * 16
    // The counter grows with its text: the count over the hint, which takes the page's line height.
    const count = rem('--text-xl') * px(styleOf(rules, '.counterValue')['line-height'])
    const hint = rem('--text-xs') * px(page['line-height'])
    expect(styleOf(rules, '.counterValue')['font-size']).toBe('var(--text-xl)')
    expect(styleOf(rules, '.counterHint')['font-size']).toBe('var(--text-xs)')
    // Border, padding, the counter's own border and its two lines at 200%, padding.
    const dock = 1 + 8 + 2 + 2 * (count + hint) + 8
    // The text ends that far above the tab bar: the reserved space and the body's own bottom padding.
    expect(styleOf(rules, '.body').padding).toContain('calc(var(--dock-space) + var(--space-8))')
    const reserved = px(styleOf(rules, '.reader', SHORT)['--dock-space']) + px(tokens['--space-8'])
    expect(reserved).toBeGreaterThanOrEqual(dock)
  })

  it('leaves the app’s tab bar alone', () => {
    const touched = rules.filter((rule) => rule.media !== null).flatMap((rule) => Object.keys(rule.declarations))
    expect(touched).not.toContain('--tabbar-height')
    expect(styleOf(rules, '.dock', SHORT)).toEqual({})
  })

  it('shrinks "Mark all done" to its icon where the row is also narrow, without losing its name', () => {
    const label = styleOf(rules, '.toolLabel', SHORT_AND_NARROW)
    // Hidden from sight only: display none or visibility hidden would take the button's name away.
    expect(label).toMatchObject({ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' })
    expect(label).not.toHaveProperty('display')
    expect(label).not.toHaveProperty('visibility')
    expect(styleOf(rules, '.tool', SHORT_AND_NARROW).width).toBe('44px')
  })
})
