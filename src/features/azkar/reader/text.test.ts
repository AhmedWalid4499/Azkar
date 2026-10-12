import { describe, expect, it } from 'vitest'
import { createI18n } from '../../../shared/i18n'
import { azkarData } from '../data'
import { isShortPassage, localized, localizedProse, snippet, toArabicIndicDigits, writesArabicIndicDigits } from './text'

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

describe('writesArabicIndicDigits', () => {
  it('is true only for the Arabic interface with Arabic-Indic digits switched on', () => {
    expect(writesArabicIndicDigits(createI18n('ar', true).n)).toBe(true)
    expect(writesArabicIndicDigits(createI18n('ar', false).n)).toBe(false)
    expect(writesArabicIndicDigits(createI18n('en', true).n)).toBe(false)
  })
})

describe('toArabicIndicDigits', () => {
  it('rewrites Western digits and nothing else', () => {
    expect(toArabicIndicDigits('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩')
    expect(toArabicIndicDigits('مسلم، 4/2088، برقم 2723')).toBe('مسلم، ٤/٢٠٨٨، برقم ٢٧٢٣')
    expect(toArabicIndicDigits('سورة البقرة، الآية: 255.')).toBe('سورة البقرة، الآية: ٢٥٥.')
    expect(toArabicIndicDigits('لا أرقام هنا')).toBe('لا أرقام هنا')
  })
})

describe('localizedProse', () => {
  const reference = { en: 'Muslim 4/2088, no. 2723', ar: 'مسلم، 4/2088، برقم 2723' }

  it('writes the Arabic side with Arabic-Indic digits when they are on', () => {
    expect(localizedProse(reference, 'ar', true)).toBe('مسلم، ٤/٢٠٨٨، برقم ٢٧٢٣')
  })

  it('leaves the digits alone when they are off, and in English', () => {
    expect(localizedProse(reference, 'ar', false)).toBe(reference.ar)
    expect(localizedProse(reference, 'en', false)).toBe(reference.en)
    expect(localizedProse(reference, 'en', true)).toBe(reference.en)
  })

  it('keeps the digits of an English text shown for want of an Arabic one', () => {
    expect(localizedProse({ en: reference.en, ar: '  ' }, 'ar', true)).toBe(reference.en)
  })
})

// The real dataset: converting digits must not change the order anything is drawn in.
describe('the dataset’s Arabic prose', () => {
  it('puts every number after an Arabic letter, where both kinds of digit are laid out alike', () => {
    const items = Object.values(azkarData.items)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      for (const field of [item.reference, item.virtue, item.note]) {
        const arabic = field?.ar ?? ''
        // After an Arabic letter, Western digits are already laid out as Arabic-Indic ones are. A number
        // that opens the text or follows Latin letters is not: there, the two ends of "33-34" would swap.
        expect(arabic, item.id).not.toMatch(/^[^\u0621-\u064A]*[0-9]/)
        expect(arabic, item.id).not.toMatch(/[A-Za-z]/)
      }
    }
  })
})
