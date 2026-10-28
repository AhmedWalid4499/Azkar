import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useLocationStore } from '../../../shared/location'
import { DEFAULT_SETTINGS, useSettings } from '../../../shared/settings'
import type { Lang } from '../../../shared/types'
import { AzkarRoutes } from '../AzkarRoutes'
import { CurrentPath } from './CurrentPath'
import { emptyAzkarProgress, useAzkarProgress } from '../progressStore'
import { DEFAULT_AZKAR_SETTINGS, useAzkarSettings } from '../settingsStore'

/** Stores outlive a test, so each one starts from a known state: English, UTC, nothing counted. */
export function resetStores(lang: Lang = 'en', timeZone = 'UTC') {
  useAzkarProgress.setState(emptyAzkarProgress())
  useAzkarSettings.setState({ ...DEFAULT_AZKAR_SETTINGS })
  useSettings.setState({ ...DEFAULT_SETTINGS, language: lang })
  useLocationStore.setState({
    location: {
      latitude: 0,
      longitude: 0,
      timeZone,
      label: 'Test',
      countryCode: null,
      source: 'manual',
      updatedAt: 0,
    },
  })
}

/** Renders the feature's routes the way the app mounts them, with a stand-in Today page. */
export function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Today page</h1>} />
        <Route path="azkar/*" element={<AzkarRoutes />} />
      </Routes>
      <CurrentPath />
    </MemoryRouter>,
  )
}

export function renderInRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}
