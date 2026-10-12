import { describe, expect, it } from 'vitest'
import { azkarData } from './data'
import { arabicUsedFor } from './sources'
import { sourceUsedForAr } from './strings'

// The real dataset, not the fixture: these guard the credits the app actually shows.

const ARABIC_LETTER = /[ء-ي]/
const LATIN_LETTER = /[A-Za-z]/

describe('arabicUsedFor', () => {
  it('has Arabic wording for every source of the dataset', () => {
    expect(azkarData.sources.length).toBeGreaterThan(0)
    for (const source of azkarData.sources) {
      const arabic = arabicUsedFor(source.url)
      expect(arabic, source.name).toMatch(ARABIC_LETTER)
      expect(arabic, source.name).not.toMatch(LATIN_LETTER)
    }
  })

  it('gives each source its own wording, and has none left over', () => {
    const used = azkarData.sources.map((source) => arabicUsedFor(source.url))
    expect(new Set(used).size).toBe(azkarData.sources.length)
    expect(Object.values(sourceUsedForAr).sort()).toEqual([...used].sort())
  })

  it('cites verses by surah name, since a bare 2:255 reads backwards in a right-to-left line', () => {
    for (const arabic of Object.values(sourceUsedForAr)) {
      // Two numbers joined by a colon or a dash keep or swap their order by rules the reader cannot see.
      expect(arabic).not.toMatch(/[0-9]\s*[-–—:]\s*[0-9]/)
    }
    expect(sourceUsedForAr['tanzil.net']).toContain('(البقرة: 255)')
  })

  it('goes by the source’s address, not by the revision or file its link is pinned to', () => {
    const repository = 'https://github.com/asellam/HisnElMuslim'
    const expected = sourceUsedForAr['github.com/asellam/HisnElMuslim']
    expect(expected).toBeDefined()
    expect(arabicUsedFor(repository)).toBe(expected)
    expect(arabicUsedFor(`${repository}/`)).toBe(expected)
    expect(arabicUsedFor(`${repository}/blob/0000000/another-file.json`)).toBe(expected)
    expect(arabicUsedFor('https://tanzil.net')).toBe(sourceUsedForAr['tanzil.net'])
  })

  it('has nothing for an address it does not know, or for something that is not an address', () => {
    expect(arabicUsedFor('https://github.com/asellam/HisnElMuslim-fork/blob/1/hisn.json')).toBeUndefined()
    expect(arabicUsedFor('https://example.org/tanzil.net')).toBeUndefined()
    expect(arabicUsedFor('javascript:alert(1)')).toBeUndefined()
    expect(arabicUsedFor('')).toBeUndefined()
    expect(arabicUsedFor(undefined)).toBeUndefined()
  })
})

describe('the dataset’s English credits', () => {
  it('use the app’s own word, azkar, outside the names of other projects', () => {
    for (const source of azkarData.sources) {
      expect(source.usedFor).not.toMatch(/adhkar/i)
      expect(source.license).not.toMatch(/adhkar/i)
    }
  })
})
