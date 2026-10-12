import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettings } from '../../../shared/settings'
import type { Dhikr } from '../data'
import type { ReaderPrefs } from '../settingsStore'
import { resetStores } from '../testing/harness'
import { DhikrBody } from './DhikrBody'

const prefs: ReaderPrefs = {
  arabicFontSize: '1.75rem',
  showTransliteration: false,
  showTranslation: false,
  haptics: false,
  keepAwake: false,
  autoAdvance: true,
}

// Real recitation text never holds a digit; this one does, to show that it would be left alone.
const dhikr: Dhikr = {
  id: 'numbered',
  arabic: 'سُبْحَانَ اللَّهِ 33',
  translation: 'Glory be to Allah',
  repeat: 100,
  note: { en: '100 times during the day', ar: '100 مرة في اليوم' },
  virtue: { en: 'Narrated by Muslim, 4/2071', ar: 'رواه مسلم، 4/2071' },
  reference: { en: 'Al-Baqarah 255. Al-Hakim 1/562', ar: 'سورة البقرة، الآية: 255. أخرجه الحاكم، 1/562' },
}

function renderBody(item: Dhikr = dhikr) {
  return render(<DhikrBody dhikr={item} position={1} total={23} prefs={prefs} />)
}

describe('digits in the prose around a dhikr', () => {
  beforeEach(() => {
    resetStores('ar')
  })

  it('follow the Arabic-Indic digits setting, like the counter and the heading beside them', () => {
    renderBody()
    expect(screen.getByRole('heading', { name: 'الذِّكر ١ من ٢٣' })).toBeInTheDocument()
    expect(screen.getByText('سورة البقرة، الآية: ٢٥٥. أخرجه الحاكم، ١/٥٦٢')).toBeInTheDocument()
    expect(screen.getByText('رواه مسلم، ٤/٢٠٧١')).toBeInTheDocument()
    expect(screen.getByText('١٠٠ مرة في اليوم')).toBeInTheDocument()
    expect(screen.queryByText(/[0-9]/, { ignore: '[lang="ar"]' })).not.toBeInTheDocument()
  })

  it('never reach into the recitation text', () => {
    renderBody()
    const recitation = screen.getByText(dhikr.arabic)
    expect(recitation).toHaveAttribute('lang', 'ar')
    expect(recitation).toHaveClass('recitation')
  })

  it('stay Western when Arabic-Indic digits are switched off', () => {
    useSettings.setState({ arabicDigits: false })
    renderBody()
    expect(screen.getByText(dhikr.reference.ar)).toBeInTheDocument()
    expect(screen.getByText('رواه مسلم، 4/2071')).toBeInTheDocument()
    expect(screen.getByText('100 مرة في اليوم')).toBeInTheDocument()
  })

  it('stay Western in an English reference shown for want of an Arabic one', () => {
    renderBody({ ...dhikr, reference: { en: dhikr.reference.en, ar: '' } })
    expect(screen.getByText('Al-Baqarah 255. Al-Hakim 1/562')).toBeInTheDocument()
  })

  it('stay Western in the English interface', () => {
    resetStores('en')
    renderBody()
    expect(screen.getByText('Al-Baqarah 255. Al-Hakim 1/562')).toBeInTheDocument()
    expect(screen.getByText('Narrated by Muslim, 4/2071')).toBeInTheDocument()
    expect(screen.getByText('100 times during the day')).toBeInTheDocument()
  })
})
