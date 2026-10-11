import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../app/AppShell'
import { DEFAULT_SETTINGS, useSettings } from '../shared/settings'
import { applyUpdate, useUpdateStore } from './serviceWorker'
import { UpdateBanner } from './UpdateBanner'

// The real applyUpdate ends in a page reload, which jsdom cannot do.
vi.mock('./serviceWorker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./serviceWorker')>()),
  applyUpdate: vi.fn(),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UpdateBanner />
    </MemoryRouter>,
  )
}

const banner = () => screen.queryByRole('complementary', { name: 'App update' })

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
  useUpdateStore.setState({ status: 'idle', dismissed: false })
})

afterEach(() => {
  useSettings.setState(DEFAULT_SETTINGS)
  useUpdateStore.setState({ status: 'idle', dismissed: false })
})

describe('UpdateBanner', () => {
  it('renders nothing until an update is waiting', () => {
    renderAt('/')
    expect(banner()).not.toBeInTheDocument()
  })

  it('announces a waiting update and offers Reload', async () => {
    renderAt('/')
    useUpdateStore.setState({ status: 'ready' })

    expect(await screen.findByRole('status')).toHaveTextContent('A new version is available')
    expect(banner()).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('goes away for the visit on "Not now"', async () => {
    useUpdateStore.setState({ status: 'ready' })
    renderAt('/log')

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(banner()).not.toBeInTheDocument()
    expect(useUpdateStore.getState()).toMatchObject({ status: 'ready', dismissed: true })
    expect(applyUpdate).not.toHaveBeenCalled()
  })

  it('locks its buttons while the update is being applied', () => {
    useUpdateStore.setState({ status: 'applying' })
    renderAt('/')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled()
  })

  it.each(['/azkar/morning', '/azkar/evening', '/azkar/sleep'])('holds back while the reader is open at %s', (path) => {
    useUpdateStore.setState({ status: 'ready' })
    renderAt(path)
    expect(banner()).not.toBeInTheDocument()
  })

  it.each(['/', '/azkar', '/log', '/settings'])('shows at %s', (path) => {
    useUpdateStore.setState({ status: 'ready' })
    renderAt(path)
    expect(banner()).toBeInTheDocument()
  })

  it('is translated', () => {
    useSettings.setState({ language: 'ar' })
    useUpdateStore.setState({ status: 'ready' })
    renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('يتوفر إصدار جديد')
    expect(screen.getByRole('button', { name: 'إعادة التحميل' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ليس الآن' })).toBeInTheDocument()
  })
})

describe('in the app shell', () => {
  it('sits between the page and the tab bar', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    useUpdateStore.setState({ status: 'ready' })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>Page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const update = screen.getByRole('complementary', { name: 'App update' })
    const main = screen.getByRole('main')
    const tabs = screen.getByRole('navigation', { name: 'Main' })
    expect(main.compareDocumentPosition(update) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(update.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
