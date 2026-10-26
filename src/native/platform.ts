import { Capacitor } from '@capacitor/core'

export type AppPlatform = 'ios' | 'android' | 'web'

/** Where the app is running: the iOS or Android app, or a browser. */
export function appPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

/** True inside the installed iOS or Android app, false in any browser (including the installed PWA). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
