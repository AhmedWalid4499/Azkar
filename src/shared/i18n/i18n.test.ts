import { describe, expect, it } from 'vitest'
import { createI18n } from './index'

describe('createI18n', () => {
  it('translates and sets direction', () => {
    expect(createI18n('en', true)).toMatchObject({ dir: 'ltr', locale: 'en' })
    expect(createI18n('en', true).t('prayer.fajr')).toBe('Fajr')
    expect(createI18n('ar', true).dir).toBe('rtl')
    expect(createI18n('ar', true).t('prayer.fajr')).toBe('الفجر')
  })

  it('formats numbers with the chosen digits', () => {
    expect(createI18n('en', true).n(2026)).toBe('2026')
    expect(createI18n('ar', true).n(123)).toBe('١٢٣')
    expect(createI18n('ar', false).n(123)).toBe('123')
  })

  it('interpolates parameters, localising numeric ones', () => {
    const ar = createI18n('ar', true)
    expect(ar.t('settings.import.confirmBody', { date: 'X' })).toContain('X')
    expect(ar.t('settings.import.confirmBody')).toContain('{date}')
  })

  it('falls back to the key for unknown plural bases', () => {
    expect(createI18n('en', true).tp('missing.base', 3)).toBe('missing.base')
  })
})
