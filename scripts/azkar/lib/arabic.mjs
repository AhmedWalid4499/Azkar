// String helpers for Arabic copied from the source files.
//
// Nothing here rewrites a letter or a vowel mark. `tidy` is the only transformation applied to a
// whole recited text, and it touches invisible formatting characters and whitespace alone. Unicode
// normalisation (NFC) is deliberately NOT applied: the Tanzil Qur'an text stores shadda before the
// vowel, NFC would reorder those marks, and Tanzil's terms require the text to stay unchanged.
//
// `stripMarks` is used for metadata only (a surah name shown in a reference), never for recited text.

/** Zero-width and bidirectional controls, and the byte-order mark. They carry no text. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g

/** Remove invisible formatting characters, collapse runs of whitespace to one space, and trim. */
export function tidy(text) {
  return text.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
}

const LETTERS = '\u0621-\u063A\u0641-\u064A'
/** Tanwin, fatha, damma, kasra, shadda, sukun, and the superscript alef. */
const VOWEL_MARKS = '\u064B-\u0652\u0670'
/** Small high pause marks printed in the Qur'an text (sala, qala, jim, la, mim, three dots, sin). */
const PAUSE_MARKS = '\u06D6-\u06DC'
/** Arabic comma, full stop and colon: the only punctuation the recited texts use. */
const PUNCTUATION = '\u060C.:'

/** A single space between words, a line break between the lines of a Qur'anic item. */
const SPACING = ' \n'

const ALLOWED = `${LETTERS}${VOWEL_MARKS}${PAUSE_MARKS}${PUNCTUATION}${SPACING}`

const EDGE_PUNCTUATION = new RegExp(`^([${PUNCTUATION}]*)(.*?)([${PUNCTUATION}]*)$`, 's')

/** One whitespace-separated token as `{ lead, core, trail }`: the word and the punctuation around it. */
export function splitToken(token) {
  const [, lead, core, trail] = EDGE_PUNCTUATION.exec(token)
  return { lead, core, trail }
}

/**
 * `text` without whatever stands before its first letter or after its last letter or mark:
 * punctuation, brackets, quotation marks. Used to cut an excerpt out of a longer record.
 */
export function trimEdges(text) {
  return text.replace(/^[^\u0621-\u063A\u0641-\u064A\u0671]+/, '').replace(/[^\u0621-\u063A\u0641-\u064A\u0671\u064B-\u0652\u0670]+$/, '')
}

/** Remove every vowel, recitation and pause mark and the tatweel. For metadata, not for recited text. */
export function stripMarks(text) {
  return text.replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, '')
}

/** Everything a recited text may contain. Latin letters, digits, tatweel and ligatures are not in it. */
export const RECITED_TEXT = new RegExp(`^[${ALLOWED}]+$`)

/** The characters of `text` that a recited text may not contain, as U+XXXX code points. */
export function foreignCharacters(text) {
  const allowed = new RegExp(`[${ALLOWED}]`)
  const found = new Set()
  for (const character of text) {
    if (!allowed.test(character)) {
      found.add(`U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
    }
  }
  return [...found]
}

/**
 * A short fingerprint (FNV-1a, 32 bits, over UTF-16 code units) of a recited text. The build
 * stores one per item so that the test notices any later change to a single letter or mark.
 */
export function fingerprint(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// ---------------------------------------------------------------------------------------------
// Comparison of two vocalised texts, used to cross-check one source against another.
// It never produces text: it only reports where two witnesses disagree.
// ---------------------------------------------------------------------------------------------

const IS_LETTER = new RegExp(`[${LETTERS}\u0671]`)
const IS_MARK = new RegExp(`[${VOWEL_MARKS}\u0653-\u0655${PAUSE_MARKS}]`)

/** Words as lists of `{ base, marks }`, each mark kept on the letter it was typed after. */
function vocalisedWordsAsTyped(text) {
  const words = []
  let word = null
  for (const character of text.replace(/\u0640/g, '')) {
    if (IS_LETTER.test(character)) {
      if (!word) words.push((word = []))
      word.push({ base: character === '\u0671' ? '\u0627' : character, marks: '' })
    } else if (IS_MARK.test(character)) {
      if (word) word.at(-1).marks += character
    } else {
      word = null
    }
  }
  return words
}

/** Words as lists of `{ base, marks }`, with the two common ways of typing a vowel unified. */
export function vocalisedWords(text) {
  const words = vocalisedWordsAsTyped(text)
  for (const letters of words) {
    for (let i = 1; i < letters.length; i += 1) {
      // Older typesetting puts the fatha of "la" and the tanwin of "-an" on the alef.
      const onAlef = letters[i].base === '\u0627' && letters[i].marks !== ''
      const previousBare = letters[i - 1].marks.replace(/\u0651/g, '') === ''
      if (onAlef && (previousBare || letters[i].marks.includes('\u064B'))) {
        letters[i - 1].marks += letters[i].marks
        letters[i].marks = ''
      }
    }
    for (const letter of letters) {
      // Pause marks are not vowels, and a fatha printed beside a tanwin fath adds nothing to it.
      const redundant = letter.marks.includes('\u064B') ? /[\u064E\u06D6-\u06DC]/ : /[\u06D6-\u06DC]/
      letter.marks = [...letter.marks].filter((mark) => !redundant.test(mark)).sort().join('')
    }
  }
  return words
}

const skeleton = (letters) => letters.map((letter) => letter.base).join('')

/** The letters of each word, exactly as typed (no spelling variants unified). */
export const strictSkeleton = (text) => vocalisedWords(text).map(skeleton)

// ---------------------------------------------------------------------------------------------
// Completeness of the vocalisation. The same three rules are repeated in data.test.ts.
// ---------------------------------------------------------------------------------------------

const SHORT_VOWEL = /[\u064B-\u0650]/
/** Letters that may stand without a mark: the long vowels and the alef forms that carry none. */
const MAY_BE_BARE = /[\u0627\u0648\u064A\u0649\u0622]/
/** The article, after any one-letter prefixes: its lam is silent or assimilated and often left bare. */
const ARTICLE = /^[\u0648\u0641\u0628\u0643\u0644]{0,2}\u0627\u0644/
/** The letters the lam of the article is assimilated to; they are doubled after it. */
const SUN_LETTER = /[\u062A\u062B\u062F-\u0638\u0644\u0646]/

/**
 * Words of `text` whose vocalisation is incomplete, as `{ word, reason }`:
 * - a shadda with no vowel beside it;
 * - a consonant with no mark at all, other than a long vowel or the lam of the article;
 * - a bare article lam followed by a sun letter that is not doubled (this also catches the
 *   relative pronouns typed without the shadda of their lam);
 * - an alef maqsura (U+0649) in the middle of a word, where the letter meant is ya (U+064A).
 */
export function incompleteVocalisation(text) {
  const found = []
  for (const letters of vocalisedWordsAsTyped(text)) {
    const word = letters.map((letter) => letter.base + letter.marks).join('')
    const bases = letters.map((letter) => letter.base).join('')
    const articleLam = (ARTICLE.exec(bases)?.[0].length ?? 0) - 1
    letters.forEach((letter, index) => {
      if (letter.marks.includes('\u0651') && !SHORT_VOWEL.test(letter.marks)) {
        found.push({ word, reason: 'shadda without a vowel' })
      } else if (letter.marks === '' && !MAY_BE_BARE.test(letter.base) && index !== articleLam) {
        found.push({ word, reason: `letter ${index + 1} carries no mark` })
      }
      if (letter.base === '\u0649' && index < letters.length - 1) {
        found.push({ word, reason: 'alef maqsura in the middle of the word' })
      }
    })
    const afterArticle = letters[articleLam + 1]
    if (articleLam > 0 && letters[articleLam].marks === '' && afterArticle) {
      if (SUN_LETTER.test(afterArticle.base) && !afterArticle.marks.includes('\u0651')) {
        found.push({ word, reason: 'sun letter after the article is not doubled' })
      }
    }
  }
  return found
}

/** Spelling variants that are not different words: hamza seats, alef maqsura, ta marbuta. */
const loose = (word) =>
  word
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')

export const looseSkeleton = (text) => vocalisedWords(text).map((word) => loose(skeleton(word)))

const render = (letters) => letters.map((letter) => letter.base + letter.marks).join('')

/** Longest-common-subsequence alignment of two word lists. */
function align(a, b, same) {
  const table = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = same(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const pairs = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) pairs.push([i++, j++])
    else if (table[i + 1][j] >= table[i][j + 1]) pairs.push([i++, -1])
    else pairs.push([-1, j++])
  }
  while (i < a.length) pairs.push([i++, -1])
  while (j < b.length) pairs.push([-1, j++])
  return pairs
}

/**
 * Compare two vocalised texts word by word.
 *
 * - `conflicts`  the same letter carries different marks in each text (a real disagreement)
 * - `onlyInA` / `onlyInB`  words present in one text only
 * - `missingInA` / `missingInB`  letters one text leaves unmarked while the other marks them,
 *   as `{ word, skeleton, index }` where `index` is the position of the letter in the word
 */
export function compareVocalised(a, b) {
  const wordsA = vocalisedWords(a)
  const wordsB = vocalisedWords(b)
  const result = { conflicts: [], onlyInA: [], onlyInB: [], missingInA: [], missingInB: [] }
  const same = (x, y) => loose(skeleton(x)) === loose(skeleton(y))
  for (const [i, j] of align(wordsA, wordsB, same)) {
    if (j < 0) result.onlyInA.push(render(wordsA[i]))
    else if (i < 0) result.onlyInB.push(render(wordsB[j]))
    else {
      const x = wordsA[i]
      const y = wordsB[j]
      for (let k = 0; k < Math.min(x.length, y.length); k += 1) {
        if (x[k].marks === y[k].marks) continue
        const extraA = [...x[k].marks].filter((mark) => !y[k].marks.includes(mark))
        const extraB = [...y[k].marks].filter((mark) => !x[k].marks.includes(mark))
        // A sukun written on a long vowel (waw, ya, alef) is a typesetting habit, not information.
        const onLongVowel = /[\u0648\u064A\u0627]/.test(x[k].base)
        if (onLongVowel && [...extraA, ...extraB].join('') === '\u0652') continue
        if (extraA.length > 0 && extraB.length > 0) result.conflicts.push(`${render(x)} / ${render(y)}`)
        else if (extraB.length > 0) result.missingInA.push({ word: render(x), skeleton: skeleton(x), index: k })
        else result.missingInB.push({ word: render(y), skeleton: skeleton(y), index: k })
      }
    }
  }
  return result
}
