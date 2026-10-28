import { describe, expect, it } from 'vitest'
import { createI18n } from '../../shared/i18n'
import { strings } from './strings'

const PLURAL_BASES = ['fasting.days', 'fasting.fasts', 'fasting.months', 'fasting.duration.hours', 'fasting.duration.minutes']
const ARABIC_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other']

describe('fasting strings', () => {
  it('keep to the feature’s prefix', () => {
    for (const key of [...Object.keys(strings.en), ...Object.keys(strings.ar)]) expect(key).toMatch(/^fasting\./)
  })

  it('are all written in Arabic, and Arabic adds nothing but plural forms', () => {
    for (const [key, text] of Object.entries(strings.ar)) {
      expect(text.trim(), key).not.toBe('')
      // A template of nothing but placeholders ("{kind}: {status}") has no words to translate.
      if (text.replace(/\{\w+\}/g, '').trim().length > 1) expect(text, key).toMatch(/[؀-ۿ]/)
    }
    const extra = Object.keys(strings.ar).filter((key) => !(key in strings.en))
    for (const key of extra) expect(key).toMatch(new RegExp(`\\.(${ARABIC_FORMS.join('|')})$`))
  })

  it('carry every plural form each language needs', () => {
    for (const base of PLURAL_BASES) {
      for (const form of ['one', 'other']) expect(strings.en).toHaveProperty([`${base}.${form}`])
      for (const form of ARABIC_FORMS) expect(strings.ar).toHaveProperty([`${base}.${form}`])
    }
  })

  it('pick the right Arabic form for each count', () => {
    const { tp } = createI18n('ar', false)
    expect([0, 1, 2, 3, 11, 100].map((count) => tp('fasting.days', count))).toEqual([
      '0 يوم',
      'يوم واحد',
      'يومان',
      '3 أيام',
      '11 يومًا',
      '100 يوم',
    ])
    expect(tp('fasting.months', 2)).toBe('شهران')
  })

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
    for (const [key, text] of Object.entries(strings.en)) {
      // A plural form may spell its number out ("يوم واحد", "يومان") instead of using {count}.
      if (PLURAL_BASES.some((base) => key.startsWith(`${base}.`))) continue
      const arabic = (strings.ar as Record<string, string>)[key]!
      expect(placeholders(arabic), key).toEqual(placeholders(text))
    }
  })
})
