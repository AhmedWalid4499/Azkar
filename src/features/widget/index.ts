// Public surface of the widget feature. Other features import only from here.
// WidgetSync is mounted once, inside the router, next to the other app-wide syncs.
export { WidgetSync } from './WidgetSync'
export { applyWidgetActions } from './actions'
export { buildWidgetSnapshot, WIDGET_SNAPSHOT_VERSION } from './snapshot'
export type { WidgetDay, WidgetLabels, WidgetPrayer, WidgetSnapshot } from './snapshot'
