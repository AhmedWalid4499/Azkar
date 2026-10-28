/// <reference types="@capacitor/local-notifications" />
/// <reference types="@capacitor/splash-screen" />
import type { CapacitorConfig } from '@capacitor/cli'

/** `--bg` of the light theme in src/shared/styles/tokens.css: what the web view shows before the page has painted. */
const PARCHMENT = '#f5f1e8'
/** `--primary` of the light theme: the tint Android gives the notification icon. */
const EMERALD = '#0e6b54'

/**
 * The iOS and Android apps wrap the same build as the website (`npm run build:app`).
 *
 * There is no `server.url`: the app always runs the copy of dist/ bundled into it, offline.
 * Leave `server.hostname`, `iosScheme` and `androidScheme` at their defaults. The stored data
 * belongs to the web view's origin (capacitor://localhost, https://localhost), and a new origin
 * starts with empty storage; the native copy (src/native/durableStorage.ts) would put it back, but
 * nothing should depend on that.
 */
const config: CapacitorConfig = {
  appId: 'io.github.ahmedwalid4499.azkar',
  appName: 'Azkar',
  webDir: 'dist',
  // Behind the page until it paints, so there is no white flash.
  backgroundColor: PARCHMENT,
  ios: {
    // The page pads itself with env(safe-area-inset-*) (src/app/app.css).
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      // Hidden by src/main.tsx once the first screen has rendered.
      launchAutoHide: false,
      backgroundColor: PARCHMENT,
      showSpinner: false,
    },
    LocalNotifications: {
      // android/app/src/main/res/drawable/ic_stat_azkar.xml
      smallIcon: 'ic_stat_azkar',
      iconColor: EMERALD,
    },
  },
}

export default config
