import { useEffect } from 'react'
import { setNativeStatusBar } from '../native'
import type { AppSettings } from '../shared/settings'

const DARK_SCHEME = '(prefers-color-scheme: dark)'

/** The theme the page is drawn in: the setting, or the system's scheme while the setting is Auto. */
export function effectiveTheme(theme: AppSettings['theme']): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia(DARK_SCHEME).matches ? 'dark' : 'light'
}

/**
 * In the app, keeps the status bar readable over the page and, where the
 * system lets it have a colour, the colour of the page. Follows the system's
 * scheme while Appearance is Auto. Call after `data-theme` is set on <html>.
 */
export function useNativeStatusBar(theme: AppSettings['theme']): void {
  useEffect(() => {
    const apply = () => {
      // Read from the page itself so it cannot drift from tokens.css.
      const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      void setNativeStatusBar(effectiveTheme(theme), background || undefined)
    }
    apply()
    if (theme !== 'system') return
    const scheme = window.matchMedia(DARK_SCHEME)
    scheme.addEventListener('change', apply)
    return () => scheme.removeEventListener('change', apply)
  }, [theme])
}
