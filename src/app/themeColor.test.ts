import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { syncThemeColor } from './themeColor'

/** The metas index.html ships: one per system colour scheme. */
function addDeclaredMetas() {
  for (const [scheme, color] of [['light', '#F5F1E8'], ['dark', '#0E1513']] as const) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = color
    // Set as an attribute: jsdom does not know the `media` property of a meta element.
    meta.setAttribute('media', `(prefers-color-scheme: ${scheme})`)
    document.head.append(meta)
  }
}

const themeColors = () => [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
const describeMeta = (meta: HTMLMetaElement | undefined) => [meta?.content, meta?.getAttribute('media')]

function pageBackground(color: string) {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => ` ${color}` } as unknown as CSSStyleDeclaration)
}

beforeEach(addDeclaredMetas)

afterEach(() => {
  for (const meta of themeColors()) meta.remove()
})

describe('syncThemeColor', () => {
  it('leaves the system-following metas alone while Appearance is Auto', () => {
    syncThemeColor('system')
    expect(themeColors().map(describeMeta)).toEqual([
      ['#F5F1E8', '(prefers-color-scheme: light)'],
      ['#0E1513', '(prefers-color-scheme: dark)'],
    ])
  })

  it('puts the page’s own background first, without a media query, for a forced theme', () => {
    pageBackground('#0e1513')
    syncThemeColor('dark')

    // Browsers take the first theme-color meta that applies.
    const [first, ...rest] = themeColors()
    expect(describeMeta(first)).toEqual(['#0e1513', null])
    expect(rest).toHaveLength(2)
  })

  it('follows a change from one forced theme to the other and back to Auto', () => {
    pageBackground('#0e1513')
    syncThemeColor('dark')
    vi.mocked(window.getComputedStyle).mockReturnValue({ getPropertyValue: () => '#f5f1e8' } as unknown as CSSStyleDeclaration)
    syncThemeColor('light')

    expect(themeColors()).toHaveLength(3)
    expect(describeMeta(themeColors()[0])).toEqual(['#f5f1e8', null])

    syncThemeColor('system')
    expect(themeColors().map((meta) => meta.content)).toEqual(['#F5F1E8', '#0E1513'])
  })

  it('falls back to the colour index.html declares for that scheme when the stylesheet cannot be read', () => {
    // jsdom computes no custom properties.
    syncThemeColor('dark')
    expect(describeMeta(themeColors()[0])).toEqual(['#0E1513', null])
    syncThemeColor('light')
    expect(describeMeta(themeColors()[0])).toEqual(['#F5F1E8', null])
    expect(themeColors()).toHaveLength(3)
  })

  it('does nothing when there is no colour to be had', () => {
    for (const meta of themeColors()) meta.remove()
    syncThemeColor('dark')
    expect(themeColors()).toEqual([])
  })
})
