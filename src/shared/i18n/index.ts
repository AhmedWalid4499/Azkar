import { useMemo } from 'react'
import { strings as azkar } from '../../features/azkar/strings'
import { strings as prayerLog } from '../../features/prayer-log/strings'
import { strings as prayerTimes } from '../../features/prayer-times/strings'
import { strings as settings } from '../../features/settings/strings'
import { strings as today } from '../../features/today/strings'
import { strings as pwa } from '../../pwa/strings'
import { useSettings } from '../settings'
import type { Lang } from '../types'
import { common } from './common'

export { defineStrings } from './define'

const dictionaries = {
  en: { ...common.en, ...today.en, ...azkar.en, ...prayerTimes.en, ...prayerLog.en, ...settings.en, ...pwa.en },
  ar: { ...common.ar, ...today.ar, ...azkar.ar, ...prayerTimes.ar, ...prayerLog.ar, ...settings.ar, ...pwa.ar },
}

export type StringKey = keyof typeof dictionaries.en
export type StringParams = Record<string, string | number>

export interface I18n {
  lang: Lang
  dir: 'ltr' | 'rtl'
  /** BCP 47 tag for Intl formatters; carries the digit preference. */
  locale: string
  t: (key: StringKey, params?: StringParams) => string
  /**
   * Plural-aware lookup. Picks `${base}.${category}` for `count` (CLDR
   * categories: zero, one, two, few, many, other), falling back to `.other`.
   * `{count}` is filled in automatically.
   */
  tp: (base: string, count: number, params?: StringParams) => string
  /** Formats a number with the active digits. */
  n: (value: number) => string
}

/**
 * Wraps text that carries its own direction (a person's or a place's name) in
 * Unicode isolates, so an Arabic name in an English sentence, or the other way
 * round, cannot reorder the words around it.
 */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`
}

export function detectSystemLang(): Lang {
  const preferred = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  const first = preferred[0]?.toLowerCase() ?? 'en'
  return first.startsWith('ar') ? 'ar' : 'en'
}

export function resolveLang(setting: 'system' | Lang): Lang {
  return setting === 'system' ? detectSystemLang() : setting
}

export function createI18n(lang: Lang, arabicDigits: boolean): I18n {
  const locale = lang === 'ar' ? (arabicDigits ? 'ar-u-nu-arab' : 'ar-u-nu-latn') : 'en'
  const numberFormat = new Intl.NumberFormat(locale, { useGrouping: false })
  const pluralRules = new Intl.PluralRules(lang)
  const active = dictionaries[lang] as Record<string, string>
  const fallback = dictionaries.en as Record<string, string>

  const n = (value: number) => numberFormat.format(value)

  const fill = (template: string, params?: StringParams) =>
    params
      ? template.replace(/\{(\w+)\}/g, (match, name: string) => {
          const value = params[name]
          if (value === undefined) return match
          return typeof value === 'number' ? n(value) : value
        })
      : template

  const lookup = (key: string) => active[key] ?? fallback[key]

  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    locale,
    n,
    t: (key, params) => fill(lookup(key) ?? key, params),
    tp: (base, count, params) => {
      const template = lookup(`${base}.${pluralRules.select(count)}`) ?? lookup(`${base}.other`) ?? base
      return fill(template, { count, ...params })
    },
  }
}

export function useI18n(): I18n {
  const language = useSettings((state) => state.language)
  const arabicDigits = useSettings((state) => state.arabicDigits)
  const lang = resolveLang(language)
  return useMemo(() => createI18n(lang, arabicDigits), [lang, arabicDigits])
}
