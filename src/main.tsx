import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Latin subset first. The face declared last is consulted first, and that must be the Arabic subset:
// it carries the space, so a Qur'anic pause mark (space + combining sign) stays in Amiri in WebKit.
// The Latin subset still supplies the full stop and colon a few supplications carry.
import '@fontsource/amiri/latin-400.css'
import '@fontsource/amiri/arabic-400.css'
import '@fontsource/amiri/arabic-700.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css'
import './shared/styles/tokens.css'
import './shared/styles/global.css'
import { App } from './app/App'
import { startTabSync } from './app/tabSync'
import { registerServiceWorker } from './pwa'

// From here on this tab follows what the app's other open tabs and windows store.
startTabSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Production only: in development a service worker would serve stale modules behind the dev server.
if (import.meta.env.PROD) void registerServiceWorker()
