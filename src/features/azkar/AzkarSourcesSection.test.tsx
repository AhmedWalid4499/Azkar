import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../shared/settings'
import { AzkarSourcesSection } from './AzkarSourcesSection'
import { azkarData } from './data'
import { createFixtureData } from './testing/fixture'
import { resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())

const TANZIL = {
  name: 'Tanzil Quran Text',
  url: 'https://tanzil.net/',
  license: 'Creative Commons Attribution 3.0',
  usedFor: "Every Qur'anic passage: Ayat al-Kursi (2:255), surahs 112 to 114, and the basmala (1:1)",
}

/** The whole entry a credit's link belongs to: its name, what it was used for and its licence. */
function credit(name: RegExp): HTMLElement {
  const item = screen.getByRole('link', { name }).closest('div')
  if (!item) throw new Error(`No credit for ${name}`)
  return item
}

const icon = (link: HTMLElement) => link.querySelector('svg')?.getAttribute('class') ?? ''

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
    // The licence wording sits in its own element (see the language test below), so the line is read as a whole.
    expect(section.getByText('CC0').parentElement).toHaveTextContent(/^Licence: CC0$/)
    expect(section.getByText('Arabic text and counts')).toBeInTheDocument()
  })

  it('credits the prayer-time library and the typefaces', () => {
    render(<AzkarSourcesSection />)
    expect(screen.getByRole('link', { name: /^adhan/ })).toHaveAttribute('rel', 'noreferrer')
    expect(credit(/^adhan/)).toHaveTextContent('Prayer-time calculation')
    expect(credit(/^adhan/)).toHaveTextContent('Licence: MIT')
    expect(credit(/^Amiri/)).toHaveTextContent('Licence: SIL Open Font License 1.1')
    expect(credit(/^IBM Plex Sans Arabic/)).toHaveTextContent('Licence: SIL Open Font License 1.1')
  })

  it('credits the framework, the offline support and the icons, each under its licence', () => {
    render(<AzkarSourcesSection />)
    for (const name of [/^React \(/, /^React Router/, /^zustand/, /^Workbox/]) {
      expect(credit(name)).toHaveTextContent('Licence: MIT')
    }
    expect(credit(/^Lucide/)).toHaveTextContent('Icons')
    expect(credit(/^Lucide/)).toHaveTextContent('Licence: ISC')
  })

  it('links to the full licence texts shipped with the app', () => {
    render(<AzkarSourcesSection />)
    const link = screen.getByRole('link', { name: /^Open-source licences/ })
    // Relative, so it resolves beside index.html wherever the app is hosted.
    expect(link).toHaveAttribute('href', './licenses.txt')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAccessibleName('Open-source licences (opens in a new tab)')
  })

  it('still makes sense while the dataset lists no sources', () => {
    azkarData.sources = []
    render(<AzkarSourcesSection />)
    expect(screen.getByRole('region', { name: 'Sources and credits' })).toBeInTheDocument()
    // Eight libraries, icons and typefaces, and the licence texts. (Three before the libraries were credited.)
    expect(screen.getAllByRole('link')).toHaveLength(9)
  })

  it('does not turn anything but a web address into a link', () => {
    azkarData.sources = [{ name: 'Odd Source', url: 'javascript:alert(1)', license: '', usedFor: '' }]
    render(<AzkarSourcesSection />)
    expect(screen.getByText('Odd Source')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Odd Source/ })).not.toBeInTheDocument()
    // No licence, so no licence line: the entry is the name and nothing else.
    expect(screen.getByText('Odd Source').closest('div')).toHaveTextContent(/^Odd Source$/)
  })

  it('is titled in Arabic in the Arabic interface', () => {
    resetStores('ar')
    render(<AzkarSourcesSection />)
    expect(screen.getByRole('region', { name: 'المصادر والتراخيص' })).toBeInTheDocument()
    expect(screen.getByText('حساب مواقيت الصلاة')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^تراخيص البرمجيات المفتوحة المصدر/ })).toHaveAttribute('href', './licenses.txt')
  })
})

describe('in the Arabic interface', () => {
  beforeEach(() => {
    resetStores('ar')
  })

  it('says in Arabic what a dataset source was used for, whatever revision its link is pinned to', () => {
    azkarData.sources = [
      TANZIL,
      { ...TANZIL, name: 'asellam/HisnElMuslim', url: 'https://github.com/asellam/HisnElMuslim/blob/0123abc/hisn.json' },
    ]
    render(<AzkarSourcesSection />)
    expect(screen.queryByText(TANZIL.usedFor)).not.toBeInTheDocument()
    const usedFor = screen.getByText(/^جميع النصوص القرآنية/)
    // Arabic prose in an Arabic page: no language or direction override.
    expect(usedFor).not.toHaveAttribute('lang')
    expect(usedFor).not.toHaveAttribute('dir')
    expect(screen.getByText(/^النص العربي المشكول لجميع الأذكار/)).toBeInTheDocument()
  })

  it('writes the numbers of that Arabic text with the chosen digits', () => {
    azkarData.sources = [TANZIL]
    const { unmount } = render(<AzkarSourcesSection />)
    expect(screen.getByText(/^جميع النصوص القرآنية/)).toHaveTextContent('آية الكرسي (البقرة: ٢٥٥)، والسور من ١١٢ إلى ١١٤')
    unmount()

    useSettings.setState({ arabicDigits: false })
    render(<AzkarSourcesSection />)
    expect(screen.getByText(/^جميع النصوص القرآنية/)).toHaveTextContent('آية الكرسي (البقرة: 255)، والسور من 112 إلى 114')
  })

  it('keeps a source it has no Arabic for in English, marked as English', () => {
    render(<AzkarSourcesSection />)
    const usedFor = screen.getByText('Arabic text and counts')
    expect(usedFor).toHaveAttribute('lang', 'en')
    expect(usedFor).toHaveAttribute('dir', 'ltr')
  })

  it('marks names and licence wording as English, and leaves the Arabic label outside', () => {
    render(<AzkarSourcesSection />)
    for (const english of ['Test Source', 'CC0', 'adhan', 'SIL Open Font License 1.1']) {
      for (const element of screen.getAllByText(english)) {
        expect(element).toHaveAttribute('lang', 'en')
        expect(element).toHaveAttribute('dir', 'ltr')
      }
    }
    const line = screen.getByText('CC0').parentElement
    expect(line).toHaveTextContent(/^الترخيص: CC0$/)
    expect(line?.closest('[lang]')).toBeNull()
  })

  it('mirrors the external-link arrow', () => {
    render(<AzkarSourcesSection />)
    expect(icon(screen.getByRole('link', { name: /^adhan/ }))).toMatch(/mirrored/)
    expect(icon(screen.getByRole('link', { name: /^تراخيص/ }))).toMatch(/mirrored/)
  })
})

describe('in the English interface', () => {
  it('shows the dataset’s own wording and the arrow as drawn', () => {
    azkarData.sources = [TANZIL]
    render(<AzkarSourcesSection />)
    expect(screen.getByText(TANZIL.usedFor)).toBeInTheDocument()
    expect(icon(screen.getByRole('link', { name: /^adhan/ }))).not.toMatch(/mirrored/)
  })
})
