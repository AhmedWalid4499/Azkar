/*
 * Loaded by the generated service worker (workbox.importScripts in vite.config.ts).
 * Prayer-time reminders are shown through the registration while the app is open;
 * tapping one brings that window forward, or opens the app if it has been closed since.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => client.url.startsWith(scope))
      if (open) await open.focus()
      else await self.clients.openWindow(scope)
    })(),
  )
})
