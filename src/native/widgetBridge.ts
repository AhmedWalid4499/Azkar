import { registerPlugin } from '@capacitor/core'
import { appPlatform } from './platform'

/**
 * A prayer marked on a home-screen widget, waiting in the App Group for the
 * app to record it. Checked here for shape only; what the fields mean is the
 * prayer log's business.
 */
export interface WidgetAction {
  /** Unique per tap. */
  id: string
  /** The calendar day the prayer belongs to at the saved place, `YYYY-MM-DD`. */
  date: string
  prayer: string
  status: string
  /** When it was tapped, in epoch milliseconds. */
  at: number
}

/**
 * The plugin compiled into the iOS app (ios/App/App/AzkarWidgetPlugin.swift).
 * `publish` hands the widgets what they show and reloads them; `takePendingActions`
 * returns the prayers marked on a widget since the last call and forgets them.
 */
interface AzkarWidgetPlugin {
  publish(options: { json: string }): Promise<void>
  takePendingActions(): Promise<{ actions?: unknown }>
}

const AzkarWidget = registerPlugin<AzkarWidgetPlugin>('AzkarWidget')

/** Home-screen and lock-screen widgets exist only in the iOS app. */
export function hasNativeWidgets(): boolean {
  return appPlatform() === 'ios'
}

/** Gives the widgets a new snapshot (JSON). True once they have it; false in a browser, on Android or on failure. */
export async function publishWidgetSnapshot(json: string): Promise<boolean> {
  if (!hasNativeWidgets()) return false
  try {
    await AzkarWidget.publish({ json })
    return true
  } catch {
    return false
  }
}

function isWidgetAction(value: unknown): value is WidgetAction {
  if (typeof value !== 'object' || value === null) return false
  const { id, date, prayer, status, at } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof date === 'string' &&
    typeof prayer === 'string' &&
    typeof status === 'string' &&
    typeof at === 'number' &&
    Number.isFinite(at)
  )
}

/**
 * The prayers marked on a widget since the last call, oldest first. They are
 * removed from the widget's queue as they are returned, so record them at once.
 * Empty in a browser, on Android or on failure.
 */
export async function takeWidgetActions(): Promise<WidgetAction[]> {
  if (!hasNativeWidgets()) return []
  try {
    const { actions } = await AzkarWidget.takePendingActions()
    if (!Array.isArray(actions)) return []
    return actions.filter(isWidgetAction).sort((a, b) => a.at - b.at)
  } catch {
    return []
  }
}
