import { useEffect, useRef } from 'react'
import { hasNativeWidgets, onAppActive, publishWidgetSnapshot, takeWidgetActions } from '../../native'
import { applyWidgetActions } from './actions'
import { useWidgetSnapshot } from './useWidgetSnapshot'

/**
 * Keeps the iOS widgets in step with the app. Hands them a new snapshot when
 * the app starts, each time it comes back to the foreground and whenever
 * anything they show changes, and records in the prayer log the prayers marked
 * on a widget in the meantime. Renders nothing, and does nothing outside the
 * iOS app.
 */
export function WidgetSync() {
  return hasNativeWidgets() ? <WidgetPublisher /> : null
}

function WidgetPublisher() {
  const snapshot = useWidgetSnapshot()
  const latest = useRef(snapshot)

  useEffect(() => {
    latest.current = snapshot
    // A failure is made good by the next change or return to the foreground.
    void publishWidgetSnapshot(snapshot)
  }, [snapshot])

  useEffect(() => {
    // Recording a tap changes the log, and with it the snapshot, which is then published again.
    const collect = () => void takeWidgetActions().then((actions) => applyWidgetActions(actions))
    collect()
    return onAppActive(() => {
      collect()
      void publishWidgetSnapshot(latest.current)
    })
  }, [])

  return null
}
