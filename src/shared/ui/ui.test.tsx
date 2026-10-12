import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, useSettings } from '../settings'
import { parseCss, readStylesheet, styleOf } from '../styles/testing'
import { IconButton, Stepper } from './index'

const rules = parseCss(readStylesheet('src/shared/ui/ui.css'))

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS, language: 'en' })
})

describe('IconButton', () => {
  it('ignores being pressed while aria-disabled, and stays focusable', () => {
    const onClick = vi.fn()
    const { rerender } = render(<IconButton label="Next" aria-disabled onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Next' })
    button.focus()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(button).toBeEnabled()
    expect(button).toHaveFocus()

    rerender(<IconButton label="Next" aria-disabled={false} onClick={onClick} />)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()

    // The attribute's string form counts as well.
    rerender(<IconButton label="Next" aria-disabled="true" onClick={onClick} />)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('looks unavailable while aria-disabled, exactly as when disabled', () => {
    for (const unavailable of ['.ui-icon-button:disabled', ".ui-icon-button[aria-disabled='true']"]) {
      // The icon is what fades. Opacity on the button itself would fade its focus ring as well
      // (to under 2:1 on a card), and an aria-disabled button is one that still holds focus.
      expect(styleOf(rules, unavailable)).toEqual({ cursor: 'not-allowed' })
      expect(styleOf(rules, `${unavailable} > *`)).toEqual({ opacity: '0.4' })
    }
    // No hover highlight on a button that will not respond.
    const hover = ".ui-icon-button:hover:not(:disabled):not([aria-disabled='true'])"
    expect(styleOf(rules, hover)).toHaveProperty('background')
    expect(styleOf(rules, '.ui-icon-button:hover:not(:disabled)')).toEqual({})
  })
})

describe('Stepper', () => {
  function Harness({ onChange }: { onChange: (value: number) => void }) {
    const [value, setValue] = useState(1)
    return (
      <Stepper
        label="Hijri adjustment"
        value={value}
        min={-2}
        max={2}
        onChange={(next) => {
          onChange(next)
          setValue(next)
        }}
      />
    )
  }

  it('keeps keyboard focus on a button that has just reached its limit', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const increase = screen.getByRole('button', { name: 'Increase' })
    expect(increase).toHaveAttribute('aria-disabled', 'false')

    increase.focus()
    fireEvent.click(increase)
    expect(screen.getByRole('status')).toHaveTextContent('2')
    // A disabled button would lose focus here in a browser; aria-disabled keeps the user's place.
    expect(increase).toBeEnabled()
    expect(increase).toHaveAttribute('aria-disabled', 'true')
    expect(increase).toHaveFocus()

    fireEvent.click(increase)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('does the same at the lower limit, and frees the other button again', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const decrease = screen.getByRole('button', { name: 'Decrease' })
    for (let i = 0; i < 5; i++) fireEvent.click(decrease)
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('status')).toHaveTextContent('-2')
    expect(decrease).toBeEnabled()
    expect(decrease).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Increase' })).toHaveAttribute('aria-disabled', 'false')
  })
})

describe('state indicators', () => {
  it('rings the chosen segment, which its tint alone does not set apart', () => {
    const chosen = styleOf(rules, '.ui-segmented__option input:checked + .ui-segmented__label')
    expect(chosen['box-shadow']).toContain('inset 0 0 0 2px var(--primary)')
  })

  it('draws the switch from tokens that contrast in both themes', () => {
    expect(styleOf(rules, '.ui-switch').background).toBe('var(--switch-off)')
    expect(styleOf(rules, '.ui-switch::after').background).toBe('var(--switch-knob)')
    expect(styleOf(rules, '.ui-switch:checked').background).toBe('var(--primary)')
    // White on the dark theme's light green track is 2.5:1; the on-primary ink is not.
    expect(styleOf(rules, '.ui-switch:checked::after').background).toBe('var(--on-primary)')
  })
})
