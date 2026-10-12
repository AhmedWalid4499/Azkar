import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS_STORAGE_KEY } from '../shared/settings'
import { storageKey } from '../shared/storage'
import { ErrorBoundary } from './ErrorBoundary'

const LOG_KEY = storageKey('prayer-log')

function Broken(): never {
  throw new Error('render failed')
}

const reload = vi.fn()

beforeEach(() => {
  reload.mockClear()
  vi.stubGlobal('location', { reload })
  // React reports the caught error; it is the point of the test, not noise worth printing.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  localStorage.setItem(SETTINGS_STORAGE_KEY, '{"state":{},"version":1}')
  localStorage.setItem(LOG_KEY, '{"state":{"entries":{}},"version":1}')
  localStorage.setItem('someone-else', '1')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderBroken() {
  return render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  )
}

describe('ErrorBoundary', () => {
  it('renders its children while nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })

  it('shows a way out in both languages instead of a blank page', () => {
    renderBroken()

    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Something went wrong')
    expect(title).toHaveTextContent('حدث خطأ غير متوقع')
    expect(title).toHaveFocus()
    expect(screen.getByText('Something went wrong')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('حدث خطأ غير متوقع')).toHaveAttribute('lang', 'ar')
    expect(screen.getByText('حدث خطأ غير متوقع')).toHaveAttribute('dir', 'rtl')
    // Two phrases, not one run-together word, where the name is built from the text alone.
    expect(title).toHaveAccessibleName('Something went wrong حدث خطأ غير متوقع')
    expect(screen.getByRole('button', { name: 'Reload إعادة التحميل' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erase all data مسح كل البيانات' })).toBeInTheDocument()
  })

  it('reloads', async () => {
    renderBroken()
    await userEvent.click(screen.getByRole('button', { name: /Reload/ }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull()
  })

  it('resets the general settings only, keeping the log', async () => {
    renderBroken()
    await userEvent.click(screen.getByRole('button', { name: /Reset settings/ }))

    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LOG_KEY)).not.toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('erases everything only after a second, separate confirmation', async () => {
    renderBroken()
    await userEvent.click(screen.getByRole('button', { name: /Erase all data/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('It cannot be undone.')
    // The focus lands on the safe choice, and nothing has been removed yet.
    expect(screen.getByRole('button', { name: /Cancel/ })).toHaveFocus()
    expect(localStorage.getItem(LOG_KEY)).not.toBeNull()
    expect(reload).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: /Erase all data/ })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: /Erase all data/ }))
    await userEvent.click(screen.getByRole('button', { name: /Yes, erase everything/ }))

    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LOG_KEY)).toBeNull()
    expect(localStorage.getItem('someone-else')).toBe('1')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
