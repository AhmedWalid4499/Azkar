import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AzkarSourcesSection } from './AzkarSourcesSection'
import { azkarData } from './data'
import { createFixtureData } from './testing/fixture'
import { resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  azkarData.sources = createFixtureData().sources
})

describe('AzkarSourcesSection', () => {
  it('credits each dataset source with a safe external link, its licence and what it was used for', () => {
    render(<AzkarSourcesSection />)
    const section = within(screen.getByRole('region', { name: 'Sources and credits' }))
    const link = section.getByRole('link', { name: /Test Source/ })
    expect(link).toHaveAttribute('href', 'https://example.org/source')
    expect(link).toHaveAttribute('rel', 'noreferrer')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAccessibleName('Test Source (opens in a new tab)')
    expect(section.getByText('Licence: CC0')).toBeInTheDocument()
    expect(section.getByText('Arabic text and counts')).toBeInTheDocument()
  })

  it('credits the prayer-time library and the typefaces', () => {
    render(<AzkarSourcesSection />)
    expect(screen.getByRole('link', { name: /^adhan/ })).toHaveAttribute('rel', 'noreferrer')
    expect(screen.getByText('Prayer-time calculation')).toBeInTheDocument()
    expect(screen.getByText('Licence: MIT')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Amiri/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^IBM Plex Sans Arabic/ })).toBeInTheDocument()
    expect(screen.getAllByText('Licence: SIL Open Font License 1.1')).toHaveLength(2)
  })

  it('still makes sense while the dataset lists no sources', () => {
    azkarData.sources = []
    render(<AzkarSourcesSection />)
    expect(screen.getByRole('region', { name: 'Sources and credits' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('does not turn anything but a web address into a link', () => {
    azkarData.sources = [{ name: 'Odd Source', url: 'javascript:alert(1)', license: '', usedFor: '' }]
    render(<AzkarSourcesSection />)
    expect(screen.getByText('Odd Source')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Odd Source/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Licence: $/)).not.toBeInTheDocument()
  })

  it('is titled in Arabic in the Arabic interface', () => {
    resetStores('ar')
    render(<AzkarSourcesSection />)
    expect(screen.getByRole('region', { name: 'المصادر والتراخيص' })).toBeInTheDocument()
    expect(screen.getByText('حساب مواقيت الصلاة')).toBeInTheDocument()
  })
})
