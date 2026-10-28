import { ChevronLeft, ChevronRight, Redo2, RotateCcw, Target, Undo2 } from 'lucide-react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { haptic } from '../../../native'
import { useI18n } from '../../../shared/i18n'
import { Button, IconButton, Sheet } from '../../../shared/ui'
import { cx } from '../cx'
import { getTasbihPresets } from '../data'
import { useAzkarProgress } from '../progressStore'
import { useAzkarSettings, useReaderPrefs } from '../settingsStore'
import { tasbihRecordOf } from '../tasbihCounts'
import type { TasbihSlot } from '../tasbihCounts'
import { useTasbihDateKey } from '../useTasbih'
import { useWakeLock } from '../useWakeLock'
import { chosenPreset } from './choice'
import { PresetSheet } from './PresetSheet'
import { TargetSheet } from './TargetSheet'
import styles from './TasbihPage.module.css'

/** A held-down key must not run up the count. */
function ignoreKeyRepeat(event: ReactKeyboardEvent<HTMLButtonElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
}

/** The latest count on the counter, read outside React right after writing one. */
function currentCount(dateKey: string, slot: TasbihSlot): number {
  return tasbihRecordOf(useAzkarProgress.getState().tasbih.days[dateKey], slot)?.current ?? 0
}

/** `/azkar/tasbih`: a large counter for a preset dhikr or a free count, with a target, undo and reset. */
export function TasbihPage() {
  const { t, tp, n, dir, locale } = useI18n()
  const prefs = useReaderPrefs()
  const presets = useMemo(() => getTasbihPresets(), [])
  const chosenId = useAzkarSettings((state) => state.tasbihPreset)
  const free = useAzkarSettings((state) => state.tasbihFree)
  const target = useAzkarSettings((state) => state.tasbihTarget)
  const preset = chosenPreset(presets, chosenId, free)
  const slot: TasbihSlot = preset?.id ?? null

  const dateKey = useTasbihDateKey()
  const record = useAzkarProgress((state) => tasbihRecordOf(state.tasbih.days[dateKey], slot))
  const lifetime = useAzkarProgress((state) =>
    slot === null ? state.tasbih.free : Object.hasOwn(state.tasbih.totals, slot) ? (state.tasbih.totals[slot] ?? 0) : 0,
  )
  const current = record?.current ?? 0

  const [sheet, setSheet] = useState<'preset' | 'target' | 'reset' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // Bumped each time the target is reached, to play the glow once more.
  const [glow, setGlow] = useState(0)
  const counter = useRef<HTMLButtonElement>(null)

  useWakeLock(prefs.keepAwake)

  // Large totals are grouped the locale's way.
  const group = useMemo(() => new Intl.NumberFormat(locale).format, [locale])
  const reached = target !== null && current > 0 && current % target === 0
  const rounds = target === null ? 0 : Math.floor(current / target)

  const count = () => {
    const before = currentCount(dateKey, slot)
    useAzkarProgress.getState().countTasbih(dateKey, slot)
    const after = currentCount(dateKey, slot)
    if (after === before) return
    if (target !== null && after % target === 0) {
      if (prefs.haptics) haptic('done')
      setAnnouncement(t('azkar.tasbih.reached', { target }))
      setGlow((value) => value + 1)
    } else {
      if (prefs.haptics) haptic('tick')
      setAnnouncement('')
    }
  }

  const undo = () => {
    if (currentCount(dateKey, slot) === 0) return
    useAzkarProgress.getState().undoTasbih(dateKey, slot)
    if (prefs.haptics) haptic('tick')
    setAnnouncement('')
  }

  const reset = () => {
    useAzkarProgress.getState().resetTasbih(dateKey, slot)
    setAnnouncement('')
    setSheet(null)
    counter.current?.focus()
  }

  const choose = (next: TasbihSlot) => {
    const { update } = useAzkarSettings.getState()
    update(next === null ? { tasbihFree: true } : { tasbihFree: false, tasbihPreset: next })
    setAnnouncement('')
    setSheet(null)
  }

  // Space or Enter counts from anywhere on the page that is not itself a control.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (sheet !== null || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key !== ' ' && event.key !== 'Enter') return
    const origin = event.target instanceof Element ? event.target : null
    if (origin?.closest('button, a, summary, dialog, input, select, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    if (!event.repeat) count()
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const Back = dir === 'rtl' ? ChevronRight : ChevronLeft
  // Undo points back the way the text came from. Lucide's redo arrow is its undo arrow mirrored.
  const Undo = dir === 'rtl' ? Redo2 : Undo2
  const transliteration = preset && prefs.showTransliteration ? preset.transliteration?.trim() : undefined
  const translation = preset && prefs.showTranslation ? preset.translation.trim() : undefined
  // Past the first round, the count goes on and the ring shows how far into the next one it is.
  const round = target === null ? 0 : current % target
  const label =
    target === null
      ? t('azkar.tasbih.count', { count: current })
      : current <= target
        ? t('azkar.tasbih.countOf', { count: current, target })
        : t('azkar.tasbih.countInRound', { count: current, round, target })
  const caption =
    target === null
      ? t('azkar.tasbih.hint')
      : reached
        ? t('azkar.tasbih.reached', { target })
        : current < target
          ? t('azkar.tasbih.ofTarget', { target })
          : t('azkar.tasbih.inRound', { round, target })

  return (
    <div className={styles.page}>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <header className={styles.header}>
        <Link to="/azkar" className="ui-icon-button" aria-label={t('action.back')}>
          <Back aria-hidden size={22} />
        </Link>
        <h1 className={styles.title}>{t('azkar.tasbih.title')}</h1>
      </header>

      <div className={styles.chosen}>
        <div className={styles.chosenText}>
          {preset ? (
            <>
              <p
                className={cx('recitation', styles.arabic)}
                lang="ar"
                dir="rtl"
                style={{ fontSize: prefs.arabicFontSize }}
              >
                {preset.arabic}
              </p>
              {transliteration && (
                <p className={styles.transliteration} lang="en" dir="ltr">
                  {transliteration}
                </p>
              )}
              {translation && (
                <p className={styles.translation} lang="en" dir="ltr">
                  {translation}
                </p>
              )}
            </>
          ) : (
            <>
              <p className={styles.freeTitle}>{t('azkar.tasbih.free')}</p>
              <p className={styles.translation}>{t('azkar.tasbih.free.description')}</p>
            </>
          )}
        </div>
        {presets.length > 0 && (
          <Button size="s" aria-label={t('azkar.tasbih.change.label')} onClick={() => setSheet('preset')}>
            {t('azkar.tasbih.change')}
          </Button>
        )}
      </div>

      <dl className={cx(styles.stats, 'tabular')}>
        <div className={styles.stat}>
          <dt>{t('azkar.tasbih.stats.today')}</dt>
          <dd>{group(record?.count ?? 0)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{t('azkar.tasbih.stats.lifetime')}</dt>
          <dd>{group(lifetime)}</dd>
        </div>
      </dl>

      <button
        ref={counter}
        type="button"
        className={cx(styles.counter, reached && styles.reached)}
        aria-label={label}
        onClick={count}
        onKeyDown={ignoreKeyRepeat}
      >
        <span key={glow} className={cx(styles.glow, glow > 0 && styles.glowing)} aria-hidden />
        <span className={styles.dial} aria-hidden>
          {target !== null && (
            <svg className={styles.ring} viewBox="0 0 100 100">
              <circle className={styles.ringTrack} cx="50" cy="50" r="46" />
              <circle
                className={styles.ringValue}
                cx="50"
                cy="50"
                r="46"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - (reached ? 1 : round / target)}
              />
            </svg>
          )}
          <span className={styles.dialText}>
            <span className={cx(styles.value, 'tabular')}>{n(current)}</span>
            <span className={styles.caption}>{caption}</span>
            {rounds > 0 && <span className={styles.rounds}>{tp('azkar.tasbih.rounds', rounds)}</span>}
          </span>
        </span>
      </button>

      {/* aria-disabled rather than disabled: Undo can run out under the finger, and a disabled button drops focus. */}
      <div className={styles.tools}>
        <IconButton label={t('azkar.counter.undo')} aria-disabled={current === 0} onClick={undo}>
          <Undo aria-hidden size={20} />
        </IconButton>
        <button type="button" className={styles.tool} onClick={() => setSheet('target')}>
          <Target aria-hidden size={18} />
          <span className="tabular">
            {target === null ? t('azkar.tasbih.target.none') : t('azkar.tasbih.target.value', { target })}
          </span>
        </button>
        <IconButton label={t('azkar.tasbih.reset')} aria-disabled={current === 0} onClick={() => setSheet('reset')}>
          <RotateCcw aria-hidden size={20} />
        </IconButton>
      </div>

      <PresetSheet
        open={sheet === 'preset'}
        onClose={() => setSheet(null)}
        presets={presets}
        chosen={slot}
        onChoose={choose}
        prefs={prefs}
      />
      <TargetSheet
        open={sheet === 'target'}
        onClose={() => setSheet(null)}
        target={target}
        onChange={(next) => useAzkarSettings.getState().update({ tasbihTarget: next })}
      />
      <Sheet open={sheet === 'reset'} onClose={() => setSheet(null)} title={t('azkar.tasbih.reset.title')}>
        <p className={styles.confirmBody}>{t('azkar.tasbih.reset.body', { count: group(record?.count ?? 0) })}</p>
        <div className={styles.sheetActions}>
          <Button block variant="danger" onClick={reset}>
            {t('azkar.tasbih.reset')}
          </Button>
          <Button block variant="ghost" onClick={() => setSheet(null)}>
            {t('action.cancel')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
