import { BookOpenText, CalendarCheck, Settings, Sunrise } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PrayerNotifier } from '../features/prayer-times'
import { UpdateBanner } from '../pwa'
import { useI18n } from '../shared/i18n'
import type { StringKey } from '../shared/i18n'
import { LocalFileSheet } from './LocalFileSheet'
import { useNativeBackButton } from './useNativeBackButton'
import './app.css'

const TABS: ReadonlyArray<{ to: string; label: StringKey; icon: typeof Sunrise; end?: boolean }> = [
  { to: '/', label: 'nav.today', icon: Sunrise, end: true },
  { to: '/azkar', label: 'nav.azkar', icon: BookOpenText },
  { to: '/log', label: 'nav.log', icon: CalendarCheck },
  { to: '/settings', label: 'nav.settings', icon: Settings },
]

export function AppShell() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  useNativeBackButton()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <PrayerNotifier />
      <main className="app__main">
        <Outlet />
      </main>
      <UpdateBanner />
      <LocalFileSheet />
      <nav className="tabbar" aria-label={t('nav.label')}>
        <div className="tabbar__inner">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="tabbar__tab">
              <Icon aria-hidden size={22} strokeWidth={1.9} />
              <span>{t(label)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
