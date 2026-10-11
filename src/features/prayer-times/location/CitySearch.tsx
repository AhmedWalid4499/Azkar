import { MapPin, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Button, Notice } from '../../../shared/ui'
import { LookupError, MIN_QUERY_LENGTH, searchCities } from './geocoding'
import type { CityResult, LookupErrorCode } from './geocoding'
import styles from './location.module.css'

const DEBOUNCE_MS = 300

interface Outcome {
  /** The query these results answer. */
  term: string
  results: CityResult[]
  error: LookupErrorCode | null
}

interface CitySearchProps {
  onSelect: (city: CityResult) => void
}

/** Type-ahead city lookup. Nothing is sent until the user has typed two characters and paused. */
export function CitySearch({ onSelect }: CitySearchProps) {
  const { t, tp, lang } = useI18n()
  const inputId = useId()
  const statusId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [attempt, setAttempt] = useState(0)

  const term = query.trim()
  const ready = term.length >= MIN_QUERY_LENGTH
  const settled = ready && outcome?.term === term
  const results = ready && outcome ? outcome.results : []
  const error = settled ? (outcome?.error ?? null) : null

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchCities(term, lang, controller.signal).then(
        (found) => {
          if (!controller.signal.aborted) setOutcome({ term, results: found, error: null })
        },
        (reason: unknown) => {
          if (controller.signal.aborted) return
          setOutcome({ term, results: [], error: reason instanceof LookupError ? reason.code : 'failed' })
        },
      )
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, ready, lang, attempt])

  const retry = () => {
    setOutcome(null)
    setAttempt((count) => count + 1)
  }

  const focusResult = (index: number) => {
    const target = listRef.current?.querySelectorAll('button')[index]
    if (target) target.focus()
    return target !== undefined
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && focusResult(0)) event.preventDefault()
  }

  const onResultKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusResult(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index === 0) inputRef.current?.focus()
      else focusResult(index - 1)
    }
  }

  let status = ''
  if (!ready) status = t('times.search.hint', { count: MIN_QUERY_LENGTH })
  else if (!settled) status = t('times.search.searching')
  else if (error) status = ''
  else if (results.length === 0) status = t('times.search.none', { query: term })
  else status = tp('times.search.results', results.length)

  return (
    <div className={styles.search}>
      <label htmlFor={inputId} className="visually-hidden">
        {t('times.search.label')}
      </label>
      <div className={styles.field}>
        <Search aria-hidden className={styles.fieldIcon} size={18} />
        <input
          ref={(node) => {
            inputRef.current = node
            // <dialog>.showModal() focuses the element carrying this attribute; React's autoFocus runs too early for it.
            node?.setAttribute('autofocus', '')
          }}
          id={inputId}
          className={styles.input}
          type="search"
          dir="auto"
          value={query}
          placeholder={t('times.search.placeholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-describedby={statusId}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
        />
      </div>

      <p id={statusId} className={styles.status} role="status">
        {status}
      </p>

      {error && (
        <Notice tone="danger" alert>
          <span className={styles.noticeRow}>
            <span>{t(`times.search.error.${error}`)}</span>
            <Button onClick={retry}>
              {t('action.retry')}
            </Button>
          </span>
        </Notice>
      )}

      {results.length > 0 && (
        <ul ref={listRef} className={styles.results} aria-label={t('times.search.listLabel')}>
          {results.map((city, index) => (
            <li key={city.id}>
              <button
                type="button"
                className={styles.result}
                onClick={() => onSelect(city)}
                onKeyDown={(event) => onResultKeyDown(event, index)}
              >
                <MapPin aria-hidden className={styles.resultIcon} size={18} />
                <span className={styles.resultText}>
                  <span className={styles.resultName} dir="auto">
                    {city.name}
                  </span>
                  <span className={styles.resultDetail} dir="auto">
                    {[city.region, city.country].filter((part) => part !== '').join(t('times.listSeparator'))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.attribution}>
        {t('times.search.attribution')}{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        {t('times.listSeparator')}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>
      </p>
    </div>
  )
}
