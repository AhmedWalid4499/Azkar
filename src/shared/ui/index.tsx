import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import './ui.css'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ---------- Card ---------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Drop the default padding, e.g. when the card holds a list of rows. */
  flush?: boolean
}

export function Card({ flush, className, ...rest }: CardProps) {
  return <div className={cx('ui-card', flush && 'ui-card--flush', className)} {...rest} />
}

/* ---------- Buttons ---------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'm' | 's'
  block?: boolean
}

export function Button({ variant = 'secondary', size = 'm', block, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('ui-button', `ui-button--${variant}`, `ui-button--${size}`, block && 'ui-button--block', className)}
      {...rest}
    />
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; icon-only buttons have no visible text. */
  label: string
}

/**
 * Pass `aria-disabled` rather than `disabled` where the button can run out of
 * steps while it has focus (a stepper at its limit, "next" on the last page):
 * a disabled button drops keyboard focus, an aria-disabled one keeps it and
 * simply ignores being pressed.
 */
export function IconButton({ label, className, type = 'button', children, onClick, ...rest }: IconButtonProps) {
  const unavailable = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true'
  return (
    <button
      type={type}
      className={cx('ui-icon-button', className)}
      aria-label={label}
      title={label}
      {...rest}
      onClick={unavailable ? undefined : onClick}
    >
      {children}
    </button>
  )
}

/* ---------- Page header ---------- */

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Route to go back to; renders a back button when set. */
  backTo?: string
  trailing?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, trailing }: PageHeaderProps) {
  const { t, dir } = useI18n()
  const Back = dir === 'rtl' ? ChevronRight : ChevronLeft
  return (
    <header className="ui-page-header">
      {backTo !== undefined && (
        <Link to={backTo} className="ui-icon-button" aria-label={t('action.back')}>
          <Back aria-hidden size={22} />
        </Link>
      )}
      <div className="ui-page-header__text">
        <h1 className="ui-page-header__title">{title}</h1>
        {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
      </div>
      {trailing && <div className="ui-page-header__trailing">{trailing}</div>}
    </header>
  )
}

/* ---------- Settings-style section and rows ---------- */

interface SectionProps {
  title?: string
  /** Explanatory text under the group. */
  footer?: ReactNode
  children: ReactNode
}

export function Section({ title, footer, children }: SectionProps) {
  const headingId = useId()
  return (
    <section className="ui-section" aria-labelledby={title ? headingId : undefined}>
      {title && (
        <h2 id={headingId} className="ui-section__title">
          {title}
        </h2>
      )}
      <Card flush className="ui-section__body">
        {children}
      </Card>
      {footer && <p className="ui-section__footer">{footer}</p>}
    </section>
  )
}

interface RowProps {
  label: ReactNode
  description?: ReactNode
  /** Control shown at the end of the row. */
  control?: ReactNode
  /** Associates the label with a form control's id. */
  htmlFor?: string
  /** Stack the control under the label instead of beside it. */
  stacked?: boolean
}

export function Row({ label, description, control, htmlFor, stacked }: RowProps) {
  const Label = htmlFor ? 'label' : 'div'
  return (
    <div className={cx('ui-row', stacked && 'ui-row--stacked')}>
      <div className="ui-row__text">
        <Label className="ui-row__label" {...(htmlFor ? { htmlFor } : {})}>
          {label}
        </Label>
        {description && <div className="ui-row__description">{description}</div>}
      </div>
      {control && <div className="ui-row__control">{control}</div>}
    </div>
  )
}

/* ---------- Form controls ---------- */

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  /** Accessible name for the group. */
  label: string
  block?: boolean
}

export function Segmented<T extends string>({ value, onChange, options, label, block }: SegmentedProps<T>) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cx('ui-segmented', block && 'ui-segmented--block')}>
      {options.map((option) => (
        <label key={option.value} className="ui-segmented__option">
          <input
            type="radio"
            className="visually-hidden"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="ui-segmented__label">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

interface SwitchProps {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name when the switch is not tied to a visible label via `id`. */
  label?: string
  disabled?: boolean
}

export function Switch({ id, checked, onChange, label, disabled }: SwitchProps) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      className="ui-switch"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('ui-select', className)} {...rest}>
      {children}
    </select>
  )
}

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Accessible name for the value being adjusted. */
  label: string
  format?: (value: number) => string
}

export function Stepper({ value, onChange, min, max, step = 1, label, format }: StepperProps) {
  const { t, n } = useI18n()
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  return (
    <div className="ui-stepper" role="group" aria-label={label}>
      {/* aria-disabled, not disabled: the button being pressed is the one that reaches the limit. */}
      <IconButton
        label={t('action.decrease')}
        aria-disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus aria-hidden size={18} />
      </IconButton>
      <output className="ui-stepper__value tabular" aria-live="polite">
        {format ? format(value) : n(value)}
      </output>
      <IconButton
        label={t('action.increase')}
        aria-disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus aria-hidden size={18} />
      </IconButton>
    </div>
  )
}

/* ---------- Feedback ---------- */

interface NoticeProps {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  /** Announce to assistive tech as soon as it appears (use for errors). */
  alert?: boolean
  children: ReactNode
}

export function Notice({ tone = 'info', alert, children }: NoticeProps) {
  return (
    <div className={cx('ui-notice', `ui-notice--${tone}`)} role={alert ? 'alert' : undefined}>
      {children}
    </div>
  )
}

interface ProgressRingProps {
  /** 0 to 1. */
  value: number
  size?: number
  thickness?: number
  /** Accessible description, e.g. "3 of 24 done". Omit when the ring is decorative. */
  label?: string
  children?: ReactNode
}

export function ProgressRing({ value, size = 56, thickness = 5, label, children }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, value))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div
      className="ui-ring"
      style={{ width: size, height: size }}
      {...(label
        ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(clamped * 100) }
        : { 'aria-hidden': true })}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ui-ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={thickness} />
        <circle
          className="ui-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>
      {children !== undefined && <div className="ui-ring__content">{children}</div>}
    </div>
  )
}

interface ProgressBarProps {
  /** 0 to 1. */
  value: number
  label: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      className="ui-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className="ui-bar__value" style={{ '--ui-bar-value': clamped } as CSSProperties} />
    </div>
  )
}

/* ---------- Bottom sheet ---------- */

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Modal bottom sheet on a native <dialog>, so focus trapping and Esc come for free. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="ui-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="ui-sheet__panel">
          <div className="ui-sheet__header">
            <h2 id={titleId} className="ui-sheet__title">
              {title}
            </h2>
            <IconButton label={t('action.close')} onClick={onClose}>
              <X aria-hidden size={20} />
            </IconButton>
          </div>
          <div className="ui-sheet__body">{children}</div>
        </div>
      )}
    </dialog>
  )
}
