import { describe, expect, it } from 'vitest'
import { parseCss, readStylesheet, styleOf } from '../../../shared/styles/testing'

// jsdom lays nothing out, so this reads the stylesheet: the tap target is most of the screen.
const rules = parseCss(readStylesheet('src/features/azkar/tasbih/TasbihPage.module.css'))
const source = readStylesheet('src/features/azkar/tasbih/TasbihPage.module.css')
const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN')

describe('the tasbih page', () => {
  it('fills the screen above the tab bar, and gives the counter all the height that is left', () => {
    expect(styleOf(rules, '.page')['min-height']).toBe(
      'calc(100dvh - var(--tabbar-height) - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
    )
    expect(styleOf(rules, '.page')['flex-direction']).toBe('column')
    expect(styleOf(rules, '.counter').flex).toBe('1')
    expect(px(styleOf(rules, '.counter')['min-height'])).toBeGreaterThanOrEqual(240)
  })

  it('keeps a comfortable counter on a short screen', () => {
    expect(px(styleOf(rules, '.counter', '(max-height: 520px)')['min-height'])).toBeGreaterThanOrEqual(144)
  })

  it('takes every colour from the design tokens, and lays out with logical properties', () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i)
    expect(source).not.toMatch(/(margin|padding|border)-(left|right)\b|\b(left|right):/)
  })
})
