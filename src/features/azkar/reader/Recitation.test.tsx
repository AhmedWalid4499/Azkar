import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { azkarData } from '../data'
import { Recitation } from './Recitation'
import styles from './reader.module.css'

const PAUSE = 'ۗ' // a pause mark (qala)
const SAJDAH = '۩'
const RUB_AL_HIZB = '۞'

/** What the Recitation renders: the plain runs as strings, each kept-together group as its parts. */
function parts(text: string) {
  const { container } = render(<p>{Recitation({ text })}</p>)
  const paragraph = container.firstElementChild!
  return [...paragraph.childNodes].map((node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent
    const element = node as HTMLElement
    const mark = element.querySelector(`.${styles.pauseMark}`)
    return { group: element.className, text: element.textContent, mark: mark?.textContent ?? null }
  })
}

describe('Recitation', () => {
  it('keeps each pause mark with its word', () => {
    expect(parts(`one two ${PAUSE} three`)).toEqual([
      'one ',
      { group: styles.pauseGroup, text: `two ${PAUSE}`, mark: ` ${PAUSE}` },
      ' three',
    ])
  })

  it('keeps the sajdah sign with the last word of its ayah, as a sign and not a pause mark', () => {
    expect(parts(`one two ${SAJDAH}`)).toEqual(['one ', { group: styles.signGroup, text: `two ${SAJDAH}`, mark: null }])
  })

  it('leaves the rub al-hizb sign that opens an ayah as plain text', () => {
    expect(parts(`${RUB_AL_HIZB} one two ${PAUSE} three`)).toEqual([
      `${RUB_AL_HIZB} one `,
      { group: styles.pauseGroup, text: `two ${PAUSE}`, mark: ` ${PAUSE}` },
      ' three',
    ])
  })

  it('never makes a word of a sign: a sign after a pause mark stays as it is', () => {
    expect(parts(`one ${PAUSE} ${SAJDAH}`)).toEqual([
      { group: styles.pauseGroup, text: `one ${PAUSE}`, mark: ` ${PAUSE}` },
      ` ${SAJDAH}`,
    ])
  })

  it('renders every recited text character for character', () => {
    for (const item of Object.values(azkarData.items)) {
      const { container, unmount } = render(<p>{Recitation({ text: item.arabic })}</p>)
      expect(container.firstElementChild?.textContent, item.id).toBe(item.arabic)
      unmount()
    }
  })

  it('shows the two signs of Surah as-Sajdah where Tanzil prints them', () => {
    const lines = azkarData.items['surah-as-sajdah']?.arabic.split('\n') ?? []
    const prostration = parts(lines[15] ?? '').at(-1)
    expect(prostration).toMatchObject({ group: styles.signGroup, mark: null })
    expect((prostration as { text: string }).text.endsWith(` ${SAJDAH}`)).toBe(true)
    expect(parts(lines[11] ?? '')[0]).toMatch(new RegExp(`^${RUB_AL_HIZB} `))
  })
})
