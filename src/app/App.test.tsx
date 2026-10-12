import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, useSettings } from '../shared/settings'
import { App } from './App'

const forcedThemeColor = () => document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')

beforeEach(() => {
  // The shell scrolls to the top on navigation, which jsdom does not implement.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  useSettings.setState(DEFAULT_SETTINGS)
  window.location.hash = ''
})

describe('App', () => {
  it('opens with settings from a damaged backup instead of a blank page', async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { language: 'fr', hijriOffset: 1e9, update: 1 }, version: 1 }),
    )
    await useSettings.persist.rehydrate()

    render(<App />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(document.documentElement.lang).toMatch(/^(en|ar)$/)
  })

  it('shows a way out, not a blank page, when a screen fails to render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Past the store's own checks: a value no screen can be drawn with.
    useSettings.setState({ language: 'fr' as never })

    const { container } = render(<App />)

    expect(container).not.toBeEmptyDOMElement()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: /Reset settings/ })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('gives the browser chrome the colour of a forced theme, and hands it back on Auto', () => {
    const declared = document.createElement('meta')
    declared.name = 'theme-color'
    declared.content = '#0E1513'
    declared.setAttribute('media', '(prefers-color-scheme: dark)')
    document.head.append(declared)

    try {
      render(<App />)
      expect(forcedThemeColor()).toBeNull()

      act(() => useSettings.getState().update({ theme: 'dark' }))
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(forcedThemeColor()?.content).toBe('#0E1513')
      expect(document.head.querySelector('meta[name="theme-color"]')).toBe(forcedThemeColor())

      act(() => useSettings.getState().update({ theme: 'system' }))
      expect(forcedThemeColor()).toBeNull()
    } finally {
      declared.remove()
    }
  })
})
