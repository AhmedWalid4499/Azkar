import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/amiri/arabic-400.css'
import '@fontsource/amiri/arabic-700.css'
// Latin subset too: a few supplications carry a full stop or colon, which should not fall back to another face.
import '@fontsource/amiri/latin-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css'
import './shared/styles/tokens.css'
import './shared/styles/global.css'
import { App } from './app/App'
import { registerServiceWorker } from './pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Production only: in development a service worker would serve stale modules behind the dev server.
if (import.meta.env.PROD) void registerServiceWorker()
