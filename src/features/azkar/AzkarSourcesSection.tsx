import { ExternalLink } from 'lucide-react'
import { useI18n } from '../../shared/i18n'
import type { StringKey } from '../../shared/i18n'
import { Section } from '../../shared/ui'
import styles from './AzkarSourcesSection.module.css'
import { cx } from './cx'
import { azkarData } from './data'
import { toArabicIndicDigits, writesArabicIndicDigits } from './reader/text'
import { arabicUsedFor } from './sources'

interface Credit {
  name: string
  url: string
  license: string
  usedFor: string
  /** `usedFor` is the dataset's English wording rather than interface text. */
  usedForInEnglish?: boolean
}

/** Libraries, icons and typefaces shipped with the app, whatever the dataset credits. */
const STATIC_CREDITS: ReadonlyArray<Omit<Credit, 'usedFor' | 'usedForInEnglish'> & { usedFor: StringKey }> = [
  { name: 'adhan', url: 'https://github.com/batoulapps/adhan-js', license: 'MIT', usedFor: 'azkar.sources.adhan' },
  { name: 'React', url: 'https://github.com/facebook/react', license: 'MIT', usedFor: 'azkar.sources.react' },
  {
    name: 'React Router',
    url: 'https://github.com/remix-run/react-router',
    license: 'MIT',
    usedFor: 'azkar.sources.reactRouter',
  },
  { name: 'zustand', url: 'https://github.com/pmndrs/zustand', license: 'MIT', usedFor: 'azkar.sources.zustand' },
  { name: 'Workbox', url: 'https://github.com/GoogleChrome/workbox', license: 'MIT', usedFor: 'azkar.sources.workbox' },
  { name: 'Lucide', url: 'https://github.com/lucide-icons/lucide', license: 'ISC', usedFor: 'azkar.sources.lucide' },
  {
    name: 'Amiri',
    url: 'https://github.com/aliftype/amiri',
    license: 'SIL Open Font License 1.1',
    usedFor: 'azkar.sources.amiri',
  },
  {
    name: 'IBM Plex Sans Arabic',
    url: 'https://github.com/IBM/plex',
    license: 'SIL Open Font License 1.1',
    usedFor: 'azkar.sources.plex',
  },
]

/**
 * The licence and copyright notices of everything bundled into the app, written
 * beside index.html by the production build. Nothing is served here in development.
 */
const LICENSES_URL = './licenses.txt'

/**
 * Names and licence wording stay in English in both interfaces. Marked as such,
 * a screen reader does not read them with the Arabic voice, and their punctuation
 * keeps its place in a right-to-left line.
 */
const ENGLISH = { lang: 'en', dir: 'ltr' } as const

function isWebUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

/** The "leaves the app" arrow of a link, with its meaning spelled out for screen readers. */
function NewTabMark() {
  const { t, dir } = useI18n()
  return (
    <>
      {/* The arrow points out of the line's end, so it is mirrored where the line runs right to left. */}
      <ExternalLink aria-hidden size={14} className={cx(dir === 'rtl' && styles.mirrored)} />
      {/* A space for screen readers, between the name and the note; flex layout does not render it. */}
      {' '}
      <span className="visually-hidden">({t('azkar.sources.newTab')})</span>
    </>
  )
}

function CreditItem({ name, url, license, usedFor, usedForInEnglish }: Credit) {
  const { t } = useI18n()
  return (
    <div className={styles.item}>
      <span className={styles.name}>
        {isWebUrl(url) ? (
          <a className={styles.link} href={url} target="_blank" rel="noreferrer">
            <span {...ENGLISH}>{name}</span>
            <NewTabMark />
          </a>
        ) : (
          <span {...ENGLISH}>{name}</span>
        )}
      </span>
      {usedFor && (
        <span className={styles.detail} {...(usedForInEnglish ? ENGLISH : {})}>
          {usedFor}
        </span>
      )}
      {license && (
        <span className={styles.detail}>
          {t('azkar.sources.license')} <span {...ENGLISH}>{license}</span>
        </span>
      )}
    </div>
  )
}

/** A `<Section>` crediting the dataset sources, the libraries, the icons and the typefaces. */
export function AzkarSourcesSection() {
  const { t, lang, n } = useI18n()
  const sources = Array.isArray(azkarData.sources) ? azkarData.sources : []
  const arabicDigits = writesArabicIndicDigits(n)

  return (
    <Section title={t('azkar.sources.title')} footer={t('azkar.sources.footer')}>
      {sources.map((source) => {
        // The dataset words its credits in English; the Arabic interface has its own wording for each.
        const arabic = lang === 'ar' ? arabicUsedFor(source.url) : undefined
        return (
          <CreditItem
            key={`${source.name}:${source.url}`}
            {...source}
            usedFor={arabic === undefined ? source.usedFor : arabicDigits ? toArabicIndicDigits(arabic) : arabic}
            usedForInEnglish={arabic === undefined}
          />
        )
      })}
      {STATIC_CREDITS.map((credit) => (
        <CreditItem key={credit.name} {...credit} usedFor={t(credit.usedFor)} />
      ))}
      <div className={styles.item}>
        <span className={styles.name}>
          <a className={styles.link} href={LICENSES_URL} hrefLang="en" target="_blank" rel="noreferrer">
            <span>{t('azkar.sources.licenses')}</span>
            <NewTabMark />
          </a>
        </span>
        <span className={styles.detail}>{t('azkar.sources.licenses.detail')}</span>
      </div>
    </Section>
  )
}
