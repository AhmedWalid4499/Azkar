import { KeepAwake } from '@capacitor-community/keep-awake'
import { isNativeApp } from './platform'

/**
 * In the app, keeps the screen on (`true`) or lets it follow the system timeout
 * again (`false`). Does nothing in a browser, where the Screen Wake Lock API is
 * used instead. Never throws.
 */
export async function setNativeKeepAwake(on: boolean): Promise<void> {
  if (!isNativeApp()) return
  try {
    if (on) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {
    // The screen simply follows the system timeout.
  }
}
