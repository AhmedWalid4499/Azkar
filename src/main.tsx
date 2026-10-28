// Latin subset first. The face declared last is consulted first, and that must be the Arabic subset:
// it carries the space, so a Qur'anic pause mark (space + combining sign) stays in Amiri in WebKit.
// The Latin subset still supplies the full stop and colon a few supplications carry.
import '@fontsource/amiri/latin-400.css'
import '@fontsource/amiri/arabic-400.css'
import '@fontsource/amiri/arabic-700.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css'
import './shared/styles/tokens.css'
import './shared/styles/global.css'
// Nothing above or here may import a store: see start().
import { hideSplashScreen, mirrorToNative, restoreFromNative } from './native'

/** The launch screen comes down after this long even if the app has not started, rather than hide a failure. */
const SPLASH_LIMIT_MS = 8_000

/**
 * The stores read their saved state the moment their modules are imported. In
 * the iOS and Android apps, whatever the web view lost is first put back from
 * the native copy, and every write from then on is copied there too, so the
 * app itself is imported only after that. In a browser both steps do nothing.
 */
async function start(): Promise<void> {
  await restoreFromNative()
  mirrorToNative()
  const { startApp } = await import('./app/start')
  await startApp(document.getElementById('root')!)
}

const limit = setTimeout(() => void hideSplashScreen(), SPLASH_LIMIT_MS)
void start()
  // The app forwards the console to the device log.
  .catch((error: unknown) => console.error('Azkar could not start', error))
  .finally(() => {
    clearTimeout(limit)
    // Also when starting failed: an error, or even a blank page, says more than a launch screen that stays up.
    void hideSplashScreen()
  })
