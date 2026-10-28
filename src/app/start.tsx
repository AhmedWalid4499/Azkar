import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { isNativeApp } from '../native'
import { registerServiceWorker } from '../pwa'
import { App } from './App'
import { startTabSync } from './tabSync'

/**
 * Starts the app in `container`. src/main.tsx imports this module only once the
 * stored data is in place: importing it creates the stores, and each reads its
 * saved state as it is created. Resolves when the first screen is on the page.
 */
export async function startApp(container: HTMLElement): Promise<void> {
  // From here on this page follows what the app's other open tabs and windows store.
  startTabSync()

  // Rendered at once rather than in the background, so the launch screen comes down on a finished page.
  flushSync(() =>
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )

  // Production websites only: in development a service worker would serve stale modules behind the
  // dev server, and the installed app carries its own files and is updated through its store.
  if (import.meta.env.PROD && !isNativeApp()) void registerServiceWorker()

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}
