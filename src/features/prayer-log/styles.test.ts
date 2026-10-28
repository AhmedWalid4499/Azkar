import { describe, expect, it } from 'vitest'
import { contrast, parseCss, readStylesheet, styleOf } from '../../shared/styles/testing'

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

describe('a sunnah chip', () => {
  const rules = parseCss(readStylesheet('src/features/prayer-log/SunnahToggle.module.css'))
  const tokens = parseCss(readStylesheet('src/shared/styles/tokens.css'))
  const light = styleOf(tokens, ':root')
  const themes = [light, { ...light, ...styleOf(tokens, ":root[data-theme='dark']") }]
  const token = (theme: Record<string, string>, value: string | undefined) =>
    theme[/^var\((--[\w-]+)\)$/.exec(value ?? '')?.[1] ?? ''] ?? ''

  it('is a full-size touch target', () => {
    expect(styleOf(rules, '.chip')['min-height']).toBe('44px')
  })

  it('keeps its label readable once done, in both themes', () => {
    const done = styleOf(rules, '.done')
    for (const theme of themes) {
      expect(contrast(token(theme, done.color), token(theme, done.background))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('shows the tick and the empty ring clearly against what is behind them', () => {
    const mark = styleOf(rules, '.done .mark')
    const ring = styleOf(rules, '.mark').border?.split(' ').at(-1)
    for (const theme of themes) {
      expect(contrast(token(theme, mark.color), token(theme, mark.background))).toBeGreaterThanOrEqual(3)
      expect(contrast(token(theme, ring), token(theme, styleOf(rules, '.chip').background))).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('the tracker', () => {
  const tokens = parseCss(readStylesheet('src/shared/styles/tokens.css'))
  const light = styleOf(tokens, ':root')
  const themes = [light, { ...light, ...styleOf(tokens, ":root[data-theme='dark']") }]
  const token = (theme: Record<string, string>, value: string | undefined) =>
    theme[/var\((--[\w-]+)\)/.exec(value ?? '')?.[1] ?? ''] ?? ''
  const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN')

  describe('calendar azkar marks', () => {
    const rules = parseCss(readStylesheet('src/features/prayer-log/MonthCalendar.module.css'))
    // What a day cell can be painted with: the card, the hover tint and the selected tint.
    const behind = ['var(--surface)', 'var(--surface-2)', styleOf(rules, '.selected').background]

    it('stand out from every background a day cell can have, in both themes', () => {
      for (const mark of ['.morning', '.evening']) {
        const colour = styleOf(rules, mark).color
        for (const theme of themes) {
          for (const background of behind) {
            expect(contrast(token(theme, colour), token(theme, background))).toBeGreaterThanOrEqual(3)
          }
        }
      }
    })

    it('fit in the cell under the number and the prayer marks', () => {
      const day = styleOf(rules, '.day')
      const gap = px(day.gap)
      const needed =
        px(styleOf(rules, '.number').height) + px(styleOf(rules, '.marks').height) + px(styleOf(rules, '.azkar').height) + 2 * gap
      expect(px(day['min-height'])).toBeGreaterThanOrEqual(needed)
    })
  })

  describe('weekly bars', () => {
    const rules = parseCss(readStylesheet('src/features/prayer-log/Trends.module.css'))

    it('show a bar clearly against its empty track, and the week under way by its outline, in both themes', () => {
      const fill = styleOf(rules, '.fill').background
      const track = styleOf(rules, '.track').background
      const outline = styleOf(rules, '.current').outline
      expect(outline).toContain('dashed')
      for (const theme of themes) {
        expect(contrast(token(theme, fill), token(theme, track))).toBeGreaterThanOrEqual(3)
        expect(contrast(token(theme, fill), token(theme, 'var(--surface)'))).toBeGreaterThanOrEqual(3)
        expect(contrast(token(theme, outline), token(theme, 'var(--surface)'))).toBeGreaterThanOrEqual(3)
      }
    })

    it('are eight to a row, so they fit a 360px screen', () => {
      expect(styleOf(rules, '.bars')['grid-template-columns']).toBe('repeat(8, minmax(0, 1fr))')
    })
  })

  describe('missed prayers', () => {
    const rules = parseCss(readStylesheet('src/features/prayer-log/MissedPrayers.module.css'))

    it('open from a full-size target whose text and icon read clearly in both themes', () => {
      const open = styleOf(rules, '.open')
      expect(px(open['min-height'])).toBeGreaterThanOrEqual(44)
      expect(px(styleOf(rules, '.day')['min-height'])).toBeGreaterThanOrEqual(44)
      for (const theme of themes) {
        expect(contrast(token(theme, open.color), token(theme, open.background))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(token(theme, styleOf(rules, '.openIcon').color), token(theme, open.background))).toBeGreaterThanOrEqual(3)
        expect(contrast(token(theme, styleOf(rules, '.prayers').color), token(theme, 'var(--surface)'))).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  describe('the day panel', () => {
    const rules = parseCss(readStylesheet('src/features/prayer-log/DayPanel.module.css'))

    it('gives the way into a session and the way back to last night full-size targets', () => {
      expect(px(styleOf(rules, '.sessionLink')['min-height'])).toBeGreaterThanOrEqual(44)
      expect(px(styleOf(rules, '.night .nightOpen')['min-height'])).toBeGreaterThanOrEqual(44)
    })

    it('keeps a session’s state readable, completed or not, in both themes', () => {
      for (const selector of ['.sessionState', '.sessionDone']) {
        const style = { ...styleOf(rules, '.sessionState'), ...styleOf(rules, selector) }
        for (const theme of themes) {
          expect(contrast(token(theme, style.color), token(theme, style.background))).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  })

  it('lays out with logical properties, so Arabic mirrors it', () => {
    const files = ['DayPanel', 'ExportHistory', 'LifetimeTotals', 'MissedPrayers', 'MonthCalendar', 'Overview', 'RecentRates', 'Tile', 'Trends']
    for (const file of files) {
      const source = readStylesheet(`src/features/prayer-log/${file}.module.css`)
      expect(source, file).not.toMatch(/(?:margin|padding|border)-(?:left|right)\b|text-align:\s*(?:left|right)|(?:^|[\s;{])(?:left|right):/m)
    }
  })
})
