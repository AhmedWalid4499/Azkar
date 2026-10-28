import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeBackEvent } from '../native'
import { DEFAULT_SETTINGS, useSettings } from '../shared/settings'
import { AppShell } from './AppShell'
import { LocalFileSheet } from './LocalFileSheet'
import { useNativeStatusBar } from './useNativeStatusBar'

const native = vi.hoisted(() => ({
  app: false,
  back: undefined as ((event: NativeBackEvent) => void) | undefined,
  exitNativeApp: vi.fn(),
  setNativeStatusBar: vi.fn(async (_theme: 'light' | 'dark', _background?: string) => {}),
}))

vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  isNativeApp: () => native.app,
  onNativeBackButton: (handler: (event: NativeBackEvent) => void) => {
    native.back = handler
    return () => {
      if (native.back === handler) native.back = undefined
    }
  },
  exitNativeApp: native.exitNativeApp,
  setNativeStatusBar: native.setNativeStatusBar,
}))

beforeEach(() => {
  // The shell scrolls to the top on navigation, which jsdom does not implement.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
})

afterEach(() => {
  useSettings.setState(DEFAULT_SETTINGS)
  native.app = false
  native.back = undefined
})

function Where() {
  return <output aria-label="path">{useLocation().pathname}</output>
}

function renderShell(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<Where />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const path = () => screen.getByRole('status', { name: 'path' }).textContent

function pressBack(canGoBack: boolean) {
  act(() => native.back?.({ canGoBack }))
}

describe('Android back button', () => {
  it('goes back to the previous screen, and leaves the app from Today', () => {
    renderShell(['/', '/log', '/settings'])

    pressBack(true)
    expect(path()).toBe('/log')
    pressBack(true)
    expect(path()).toBe('/')
    expect(native.exitNativeApp).not.toHaveBeenCalled()

    pressBack(false)
    expect(native.exitNativeApp).toHaveBeenCalledTimes(1)
    expect(path()).toBe('/')
  })

  it('goes to Today from a screen the app was opened on', () => {
    renderShell(['/azkar/morning'])
    pressBack(false)
    expect(path()).toBe('/')
    expect(native.exitNativeApp).not.toHaveBeenCalled()
  })

  it('closes an open sheet before anything else', () => {
    renderShell(['/', '/settings'])
    const dialog = document.createElement('dialog')
    const closed = vi.fn()
    dialog.addEventListener('close', closed)
    document.body.append(dialog)
    dialog.showModal()

    try {
      pressBack(true)
      expect(dialog.open).toBe(false)
      expect(closed).toHaveBeenCalledTimes(1)
      expect(path()).toBe('/settings')

      pressBack(true)
      expect(path()).toBe('/')
    } finally {
      dialog.remove()
    }
  })
})

describe('status bar', () => {
  function pageBackground(color: string) {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => ` ${color}` } as unknown as CSSStyleDeclaration)
  }

  it('follows a forced theme, with the page’s own background', () => {
    pageBackground('#0e1513')
    const { rerender } = renderHook(({ theme }) => useNativeStatusBar(theme), {
      initialProps: { theme: 'dark' as 'dark' | 'light' | 'system' },
    })
    expect(native.setNativeStatusBar).toHaveBeenLastCalledWith('dark', '#0e1513')

    pageBackground('#f5f1e8')
    rerender({ theme: 'light' })
    expect(native.setNativeStatusBar).toHaveBeenLastCalledWith('light', '#f5f1e8')
  })

  it('follows the system’s scheme while Appearance is Auto', () => {
    let dark = true
    const listeners = new Set<() => void>()
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          get matches() {
            return query.includes('dark') && dark
          },
          addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
          removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        }) as unknown as MediaQueryList,
    )

    const { unmount } = renderHook(() => useNativeStatusBar('system'))
    expect(native.setNativeStatusBar).toHaveBeenLastCalledWith('dark', undefined)

    dark = false
    for (const listener of listeners) listener()
    expect(native.setNativeStatusBar).toHaveBeenLastCalledWith('light', undefined)

    unmount()
    expect(listeners.size).toBe(0)
  })
})

describe('LocalFileSheet', () => {
  const LICENCES = 'MIT License\n\nCopyright (c) Meta Platforms, Inc. and affiliates.'

  function renderLinks() {
    return render(
      <>
        <a href="./licenses.txt" hrefLang="en" target="_blank" rel="noreferrer">
          <span>Licence notices</span>
          <span className="visually-hidden">(opens in a new tab)</span>
        </a>
        <a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noreferrer">
          adhan
        </a>
        <LocalFileSheet />
      </>,
    )
  }

  /** Whether the app took the click over. Stops jsdom from trying to follow the link either way. */
  function recordDefault() {
    const prevented: boolean[] = []
    const listener = (event: Event) => {
      prevented.push(event.defaultPrevented)
      event.preventDefault()
    }
    window.addEventListener('click', listener)
    return { prevented, stop: () => window.removeEventListener('click', listener) }
  }

  it('shows a file the app ships with in a sheet, inside the app', async () => {
    native.app = true
    const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(LICENCES))
    const clicks = recordDefault()
    try {
      renderLinks()
      await userEvent.click(screen.getByRole('link', { name: /Licence notices/ }))

      const sheet = await screen.findByRole('dialog', { name: 'Licence notices' })
      expect(sheet).toHaveTextContent('Copyright (c) Meta Platforms, Inc. and affiliates.')
      expect(sheet.querySelector('pre')).toHaveAttribute('lang', 'en')
      expect(fetch).toHaveBeenCalledWith(new URL('./licenses.txt', window.location.href).href)
      expect(clicks.prevented).toEqual([true])

      await userEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    } finally {
      clicks.stop()
    }
  })

  it('leaves links to other sites to the system browser', async () => {
    native.app = true
    const fetch = vi.spyOn(window, 'fetch')
    const clicks = recordDefault()
    try {
      renderLinks()
      await userEvent.click(screen.getByRole('link', { name: 'adhan' }))
      expect(clicks.prevented).toEqual([false])
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      clicks.stop()
    }
  })

  it('lets the browser open the file in a new tab on the web', async () => {
    const fetch = vi.spyOn(window, 'fetch')
    const clicks = recordDefault()
    try {
      renderLinks()
      await userEvent.click(screen.getByRole('link', { name: /Licence notices/ }))
      expect(clicks.prevented).toEqual([false])
      expect(fetch).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    } finally {
      clicks.stop()
    }
  })
})
