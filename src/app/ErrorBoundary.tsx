import { Component, createRef } from 'react'
import type { ReactNode } from 'react'
import { SETTINGS_STORAGE_KEY } from '../shared/settings'
import { clearAllData } from '../shared/storage'
import './app.css'

/**
 * Written out in both languages, and deliberately not through i18n: this screen
 * is what remains when rendering failed, and a damaged language setting is one
 * of the ways that can happen.
 */
const TEXT = {
  title: { en: 'Something went wrong', ar: 'حدث خطأ غير متوقع' },
  body: {
    en: 'Azkar could not show this screen. Your prayer log and progress are still saved on this device.',
    ar: 'تعذّر عرض هذه الشاشة. سجل صلواتك وتقدّمك ما زالا محفوظين على هذا الجهاز.',
  },
  reload: { en: 'Reload', ar: 'إعادة التحميل' },
  resetSettings: { en: 'Reset settings', ar: 'إعادة ضبط الإعدادات' },
  resetSettingsHint: {
    en: 'If reloading does not help, reset the general settings first. Your log, progress and location are kept.',
    ar: 'إن لم تُفِد إعادة التحميل فأعِد ضبط الإعدادات العامة أولًا، وسيبقى سجلك وتقدّمك وموقعك كما هي.',
  },
  erase: { en: 'Erase all data', ar: 'مسح كل البيانات' },
  eraseWarning: {
    en: 'This permanently removes your prayer log, azkar progress, location and settings from this device. It cannot be undone.',
    ar: 'سيُحذف سجل صلواتك وتقدّمك في الأذكار وموقعك وإعداداتك من هذا الجهاز نهائيًا، ولا يمكن التراجع عن ذلك.',
  },
  eraseConfirm: { en: 'Yes, erase everything', ar: 'نعم، امسح كل شيء' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
} as const

function Bilingual({ text }: { text: { en: string; ar: string } }) {
  return (
    <>
      {/* The space is never drawn (every parent here is a flex box); it keeps the two apart in the accessible name. */}
      <span lang="en" dir="ltr">
        {text.en}
      </span>{' '}
      <span lang="ar" dir="rtl">
        {text.ar}
      </span>
    </>
  )
}

function reload() {
  window.location.reload()
}

function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
  } catch {
    // Storage that cannot be reached is not what broke the screen; reloading is all that is left.
  }
  reload()
}

function eraseAll() {
  try {
    clearAllData()
  } catch {
    // As above.
  }
  reload()
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
  confirmingErase: boolean
}

/**
 * Last resort for an error thrown while rendering: instead of a blank page,
 * a way to reload and, if a stored value is what breaks the app, to get rid of
 * it without clearing the browser's site data by hand.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, confirmingErase: false }
  private title = createRef<HTMLHeadingElement>()
  private erase = createRef<HTMLButtonElement>()
  private cancel = createRef<HTMLButtonElement>()

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  // An error in the very first render mounts this screen; a later one updates to it.
  componentDidMount() {
    if (this.state.failed) this.title.current?.focus()
  }

  componentDidUpdate(_props: ErrorBoundaryProps, previous: ErrorBoundaryState) {
    const { failed, confirmingErase } = this.state
    // Whatever had focus is gone with the rest of the page.
    if (failed && !previous.failed) this.title.current?.focus()
    // The button just pressed is replaced; the safe choice gets the focus, not the destructive one.
    else if (confirmingErase !== previous.confirmingErase) (confirmingErase ? this.cancel : this.erase).current?.focus()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-error">
        <h1 ref={this.title} tabIndex={-1} className="app-error__title">
          <Bilingual text={TEXT.title} />
        </h1>
        <p className="app-error__text">
          <Bilingual text={TEXT.body} />
        </p>
        <button type="button" className="ui-button ui-button--primary ui-button--m app-error__action" onClick={reload}>
          <Bilingual text={TEXT.reload} />
        </button>

        <p className="app-error__text">
          <Bilingual text={TEXT.resetSettingsHint} />
        </p>
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--m app-error__action"
          onClick={resetSettings}
        >
          <Bilingual text={TEXT.resetSettings} />
        </button>

        {this.state.confirmingErase ? (
          <>
            <p className="app-error__text" role="alert">
              <Bilingual text={TEXT.eraseWarning} />
            </p>
            <button
              ref={this.cancel}
              type="button"
              className="ui-button ui-button--secondary ui-button--m app-error__action"
              onClick={() => this.setState({ confirmingErase: false })}
            >
              <Bilingual text={TEXT.cancel} />
            </button>
            <button type="button" className="ui-button ui-button--danger ui-button--m app-error__action" onClick={eraseAll}>
              <Bilingual text={TEXT.eraseConfirm} />
            </button>
          </>
        ) : (
          <button
            ref={this.erase}
            type="button"
            className="ui-button ui-button--danger ui-button--m app-error__action"
            onClick={() => this.setState({ confirmingErase: true })}
          >
            <Bilingual text={TEXT.erase} />
          </button>
        )}
      </main>
    )
  }
}
