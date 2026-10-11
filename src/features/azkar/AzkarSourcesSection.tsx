import { ExternalLink } from 'lucide-react'
import { useI18n } from '../../shared/i18n'
import type { StringKey } from '../../shared/i18n'
import { Section } from '../../shared/ui'
import styles from './AzkarSourcesSection.module.css'
import { azkarData } from './data'

interface Credit {
  name: string
  url: string
  license: string
  usedFor: string
}

/** Libraries and typefaces shipped with the app, whatever the dataset credits. */
const STATIC_CREDITS: ReadonlyArray<Omit<Credit, 'usedFor'> & { usedFor: StringKey }> = [
  { name: 'adhan', url: 'https://github.com/batoulapps/adhan-js', license: 'MIT', usedFor: 'azkar.sources.adhan' },
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

function isWebUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

function CreditItem({ name, url, license, usedFor }: Credit) {
  const { t } = useI18n()
  return (
    <div className={styles.item}>
      <span className={styles.name}>
        {isWebUrl(url) ? (
          <a className={styles.link} href={url} target="_blank" rel="noreferrer">
            <span dir="auto">{name}</span>
            <ExternalLink aria-hidden size={14} />
            {/* A space for screen readers, between the name and the note; flex layout does not render it. */}
            {' '}
            <span className="visually-hidden">({t('azkar.sources.newTab')})</span>
          </a>
        ) : (
          <span dir="auto">{name}</span>
        )}
      </span>
      {usedFor && (
        <span className={styles.detail} dir="auto">
          {usedFor}
        </span>
      )}
      {license && <span className={styles.detail}>{t('azkar.sources.license', { license })}</span>}
    </div>
  )
}

/** A `<Section>` crediting the dataset sources, the prayer-time library and the typefaces. */
export function AzkarSourcesSection() {
  const { t } = useI18n()
  const sources = Array.isArray(azkarData.sources) ? azkarData.sources : []

  return (
    <Section title={t('azkar.sources.title')} footer={t('azkar.sources.footer')}>
      {sources.map((source) => (
        <CreditItem key={`${source.name}:${source.url}`} {...source} />
      ))}
      {STATIC_CREDITS.map((credit) => (
        <CreditItem key={credit.name} {...credit} usedFor={t(credit.usedFor)} />
      ))}
    </Section>
  )
}
