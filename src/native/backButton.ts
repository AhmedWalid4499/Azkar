import { App } from '@capacitor/app'
import { appPlatform } from './platform'

export interface NativeBackEvent {
  /** The web view has an earlier page in its history to go back to. */
  canGoBack: boolean
}

/**
 * Calls `handler` when Android's back button or back gesture is used, instead
 * of the system's own handling (which walks back through the web view's
 * history and only then closes the app). iOS has no back button, and in a
 * browser the browser handles it, so elsewhere this does nothing. Returns a
 * function that stops it.
 */
export function onNativeBackButton(handler: (event: NativeBackEvent) => void): () => void {
  if (appPlatform() !== 'android') return () => {}
  const listening = App.addListener('backButton', ({ canGoBack }) => handler({ canGoBack })).catch(() => null)
  return () => {
    void listening.then((handle) => handle?.remove()).catch(() => {})
  }
}

/** Closes the app, as the back button does on the first screen of other Android apps. Android only. */
export function exitNativeApp(): void {
  if (appPlatform() !== 'android') return
  App.exitApp().catch(() => {})
}
