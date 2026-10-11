import { describe, expect, it } from 'vitest'
import { isShortPassage, localized, snippet } from './text'

describe('isShortPassage', () => {
  it('counts letters, not the harakat on them', () => {
    // 27 letters and spaces, but 50+ code points once vocalised.
    expect(isShortPassage('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ سُبْحَانَ اللَّهِ الْعَظِيمِ')).toBe(true)
  })

  it('treats long or multi-line passages as long', () => {
    expect(isShortPassage('اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ')).toBe(false)
    expect(isShortPassage('قُلْ هُوَ اللَّهُ أَحَدٌ\nاللَّهُ الصَّمَدُ')).toBe(false)
  })
})

describe('snippet', () => {
  it('keeps short azkar whole', () => {
    expect(snippet('  سُبْحَانَ اللَّهِ  ')).toBe('سُبْحَانَ اللَّهِ')
  })

  it('cuts long ones at a word boundary', () => {
    expect(snippet('one two three four five six seven eight')).toBe('one two three four five six …')
  })
})

describe('localized', () => {
  it('picks the interface language', () => {
    expect(localized({ en: 'English', ar: 'عربي' }, 'en')).toBe('English')
    expect(localized({ en: 'English', ar: 'عربي' }, 'ar')).toBe('عربي')
  })

  it('falls back to the other language when one side is empty', () => {
    expect(localized({ en: 'English', ar: '  ' }, 'ar')).toBe('English')
    expect(localized({ en: '', ar: 'عربي' }, 'en')).toBe('عربي')
    expect(localized({ en: '', ar: '' }, 'en')).toBe('')
  })
})
