import { SplashScreen } from '@capacitor/splash-screen'
import { isNativeApp } from './platform'

/**
 * Takes the app's launch screen away. It stays up until this is called
 * (`launchAutoHide: false` in capacitor.config.ts), so the first thing seen
 * after it is the rendered app. Does nothing in a browser. Never throws.
 */
export async function hideSplashScreen(): Promise<void> {
  if (!isNativeApp()) return
  try {
    await SplashScreen.hide()
  } catch {
    // Nothing else can be done about it.
  }
}
