// The app's only door to native features. Every function also works in a browser,
// either through the web equivalent or by doing nothing, so features never branch on the platform themselves.
export { restoreFromNative, mirrorToNative } from './durableStorage'
export { saveTextFile } from './files'
export { getNativePosition, NativeGeoError } from './geolocation'
export type { NativeGeoErrorCode, NativePosition } from './geolocation'
export { canHaptic, haptic } from './haptics'
export type { HapticKind } from './haptics'
export { setNativeKeepAwake } from './keepAwake'
export {
  nativeNotificationPermission,
  replaceScheduledNotifications,
  requestNativeNotificationPermission,
} from './notifications'
export type { NativeNotificationPermission, PlannedNotification } from './notifications'
export { appPlatform, isNativeApp } from './platform'
export type { AppPlatform } from './platform'
