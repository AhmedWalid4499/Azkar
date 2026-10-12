import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AzkarRoutes } from '../features/azkar'
import { LogRoutes } from '../features/prayer-log'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TodayPage } from '../features/today/TodayPage'
import { useI18n } from '../shared/i18n'
import { useSettings } from '../shared/settings'
import { AppShell } from './AppShell'
import { ErrorBoundary } from './ErrorBoundary'
import { syncThemeColor } from './themeColor'

/** Keeps <html> in step with the chosen language, direction and theme. */
function useDocumentAttributes() {
  const { lang, dir, t } = useI18n()
  const theme = useSettings((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = dir
    document.title = t('app.name')
  }, [lang, dir, t])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    syncThemeColor(theme)
  }, [theme])
}

function AppRoutes() {
  useDocumentAttributes()
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="azkar/*" element={<AzkarRoutes />} />
          <Route path="log/*" element={<LogRoutes />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}
