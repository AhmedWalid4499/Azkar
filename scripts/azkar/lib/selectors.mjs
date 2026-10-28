// Selectors: how a mapping file points at a pinned source record without containing any of its
// text. build.mjs follows them (record() for recited text, footnotePiece() for references, virtues
// and notes); verify.mjs names them with witnessKey().
//
// Recited text and witnesses
//   A(chapter, index)        asellam/HisnElMuslim, entry `index` of a chapter (lib/raw.mjs)
//   S(order)                 Seen-Arabic adhkar DB, the row with that `order`
//   B(entry, chapter)        the book's own text of an entry; the morning and evening chapter
//                            when no chapter is named
//   H(edition, file)         one hadith of fawazahmed0/hadith-api, isnad included
//   MUSLIM_2723              Sahih Muslim 2723, the quoted passages of the hadith joined in order
//   words(of, first, last)   whole words `first` to `last` (counted from 0, both included) of
//                            another selector, without the punctuation at either end. The count
//                            of the record is not carried over.
//
// References, virtues and notes
//   note(page, n, options)   footnote n under page `page` of a book chapter (options.chapter,
//                            default the morning and evening chapter; options.occurrence when
//                            the digital text prints two footnotes with the same number)
//   annotation(entry, index, chapter) / remark(entry, chapter)
//                            the bracketed remarks the book prints after an entry
//   bookText(entry, chapter) the text of an entry of the book, as a virtue that is the hadith
//   asellamLine(chapter, index, line, options)
//                            one line of an asellam entry (an action described around a recitation)
//   asellamNote(chapter, index, options)
//                            asellam's copy of the book's footnote of an entry
//   seenSource(order, options), list(...pieces), surahName(n)   as in mapping.mjs
//
// Every footnote-like piece takes the narrowing options of build.mjs: sentence, after, words
// (whole words `[first, last]` by position), segments, unquote, volumeSlash, amend, citeAs,
// commaAfter, label.

export const A = (chapter, index) => ({ from: 'asellam', chapter, index })
export const S = (order) => ({ from: 'seen', order })
export const B = (entry, chapter) => (chapter ? { from: 'book', chapter, entry } : { from: 'book', entry })
export const H = (edition, file) => ({ from: 'hadith', edition, file: String(file) })
export const MUSLIM_2723 = { from: 'muslim-2723', quotes: [0, 1] }
export const words = (of, first, last) => ({ from: 'excerpt', of, first, last })

export const note = (page, number, options = {}) => ({ from: 'book-footnote', page, number, ...options })
export const seenSource = (order, options = {}) => ({ from: 'seen-source', order, ...options })
export const annotation = (entry, index, chapter) => ({ from: 'book-annotation', entry, index, chapter })
export const remark = (entry, chapter) => ({ from: 'book-remark', entry, chapter })
export const bookText = (entry, chapter) => ({ from: 'book-text', entry, chapter })
export const asellamLine = (chapter, index, line, options = {}) => ({ from: 'asellam-line', chapter, index, line, ...options })
export const asellamNote = (chapter, index, options = {}) => ({ from: 'asellam-reference', chapter, index, ...options })
export const list = (...pieces) => ({ from: 'list', pieces })
export const surahName = (surah) => ({ from: 'surah-name', surah })

// Single-word replacements, checked by build.mjs before they are applied (see its header).
export const fill = (word, from, fromWord = word) => ({ kind: 'marks', word, from, fromWord })
export const revowel = (word, from, confirmedBy, fromWord = word) => ({ kind: 'vowel', word, from, fromWord, confirmedBy })
export const respell = (word, from, fromWord) => ({ kind: 'spelling', word, from, fromWord })
/** Words `word` and `word + 1` put in the order of words `fromWord` and `fromWord + 1` of `from`. */
export const reorder = (word, from, fromWord, confirmedBy) => ({ kind: 'order', word, from, fromWord, confirmedBy })

/** A short stable name for a witness, used by mapping files to declare known differences. */
export function witnessKey(selector) {
  if (selector.from === 'excerpt') return `${witnessKey(selector.of)}[${selector.first}-${selector.last}]`
  if (selector.from === 'hadith') return `hadith:${selector.edition}:${selector.file}`
  return [selector.from, selector.chapter, selector.index ?? selector.order ?? selector.entry]
    .filter((part) => part !== undefined)
    .join(':')
}
