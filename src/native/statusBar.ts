import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { appPlatform } from './platform'

/**
 * In the app, keeps the status bar readable over a page drawn in `theme`: dark
 * text on light, light text on dark. On Android versions that still give the
 * bar its own background (before 15), it also takes `background`, a #rrggbb
 * colour. Does nothing in a browser, where the theme-color metas do this job.
 * Never throws.
 */
export async function setNativeStatusBar(theme: 'light' | 'dark', background?: string): Promise<void> {
  const platform = appPlatform()
  if (platform === 'web') return
  const dark = theme === 'dark'
  try {
    // The style names the background the text sits on: Dark gives light text.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    if (platform !== 'android') return
    // Capacitor's own SystemBars puts its last style back on every configuration change (turning the
    // phone, the system switching to dark), after the plugin above: the system's scheme, unless told
    // the page's. Told it, it also gives the navigation bar's buttons the page's style.
    await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light })
    if (background) await StatusBar.setBackgroundColor({ color: background })
  } catch {
    // The bar keeps the system's own style.
  }
}
