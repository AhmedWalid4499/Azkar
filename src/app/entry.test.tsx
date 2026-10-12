import { expect, it, vi } from 'vitest'
import { SETTINGS_STORAGE_KEY, useSettings } from '../shared/settings'

// The entry point is what is under test, not the screens it draws.
vi.mock('./App', () => ({ App: () => null }))

it('starts following the app’s other tabs when the page loads', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  await import('../main')
  expect(useSettings.getState().language).toBe('system')

  // Another tab saves a setting; this page hears of it and takes it over.
  const raw = JSON.stringify({ state: { language: 'ar' }, version: 1 })
  localStorage.setItem(SETTINGS_STORAGE_KEY, raw)
  window.dispatchEvent(
    new StorageEvent('storage', { key: SETTINGS_STORAGE_KEY, oldValue: null, newValue: raw, storageArea: localStorage }),
  )

  expect(useSettings.getState().language).toBe('ar')
})
