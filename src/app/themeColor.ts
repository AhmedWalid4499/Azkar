import type { AppSettings } from '../shared/settings'

const FORCED = 'data-forced-theme'

/** The colour index.html declares for a scheme, for where the stylesheet cannot be read. */
function declaredColor(theme: 'light' | 'dark'): string {
  return document.head.querySelector<HTMLMetaElement>(`meta[name="theme-color"][media*="${theme}"]`)?.content ?? ''
}

/**
 * Keeps the browser's toolbar and status bar the colour of the page. The two
 * theme-color metas in index.html follow the system's colour scheme, which is
 * wrong once Appearance is set to Light or Dark. Browsers use the first meta
 * that applies, so a forced theme gets one without a media query ahead of
 * those two; it is removed again when the setting returns to Auto.
 *
 * Call after `data-theme` has been set on <html>.
 */
export function syncThemeColor(theme: AppSettings['theme']): void {
  const head = document.head
  let meta = head.querySelector<HTMLMetaElement>(`meta[${FORCED}]`)
  // Read from the page itself so it cannot drift from tokens.css.
  const color =
    theme === 'system'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || declaredColor(theme)
  if (!color) {
    meta?.remove()
    return
  }
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.setAttribute(FORCED, '')
    head.insertBefore(meta, head.querySelector('meta[name="theme-color"]'))
  }
  meta.content = color
}
