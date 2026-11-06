// Assembles the duas the companion can show: whole chapters of Hisn al-Muslim on worry, fear,
// distress and the like, copied from asellam/HisnElMuslim (MIT), the source azkar.json already
// takes its vocalised text from.
//
//   node scripts/azkar/build-comfort.mjs
//
// Writes apple/AzkarKit/Sources/AzkarContent/Resources/comfort-duas.json. Every Arabic string is an
// entry or a chapter title of the pinned file, passed through tidy() and nothing else; no Arabic
// is typed here. The English topic titles are this app's own headings, not translations of the text.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AZKAR_SCRIPTS, readRaw } from './lib/raw.mjs'
import { tidy } from './lib/arabic.mjs'

const SOURCE = 'raw/asellam-hisn-el-muslim/hisn.json'
const OUTPUT = join(AZKAR_SCRIPTS, '..', '..', 'apple', 'AzkarKit', 'Sources', 'AzkarContent', 'Resources', 'comfort-duas.json')

/** Each topic is one chapter of the file, by its position (1-based), with the app's English heading. */
const TOPICS = [
  { id: 'worry_and_grief', chapter: 35, en: 'Worry and grief' },
  { id: 'distress', chapter: 36, en: 'Distress' },
  { id: 'fear_in_sleep', chapter: 31, en: 'Fear and loneliness at night' },
  { id: 'sudden_fright', chapter: 127, en: 'A sudden fright' },
  { id: 'fear_of_people', chapter: 40, en: 'Fear of people' },
  { id: 'facing_an_enemy_or_authority', chapter: 37, en: 'Facing an enemy or someone in power' },
  { id: 'fear_of_injustice', chapter: 38, en: 'Fear of injustice from those in power' },
  { id: 'difficulty', chapter: 44, en: 'When something is hard' },
  { id: 'something_unwanted', chapter: 47, en: 'When something you didn’t want happens' },
  { id: 'calamity', chapter: 54, en: 'A loss or calamity' },
  { id: 'news', chapter: 107, en: 'Good or bad news' },
  { id: 'debt', chapter: 42, en: 'Debt' },
  { id: 'doubt_in_faith', chapter: 41, en: 'Doubts in faith' },
  { id: 'whispers_in_prayer', chapter: 43, en: 'Whispers during prayer and recitation' },
  { id: 'devil_whispers', chapter: 46, en: 'Driving away the devil’s whispers' },
  { id: 'after_a_sin', chapter: 45, en: 'After a sin' },
  { id: 'seeking_forgiveness', chapter: 130, en: 'Seeking forgiveness and repentance' },
  { id: 'fear_of_shirk', chapter: 93, en: 'Fear of associating partners with Allah' },
  { id: 'anger', chapter: 83, en: 'Anger' },
  { id: 'bodily_pain', chapter: 125, en: 'Pain in the body' },
  { id: 'visiting_the_sick', chapter: 50, en: 'For someone who is ill' },
  { id: 'istikhara', chapter: 26, en: 'Istikhara: asking Allah to guide a decision' },
]

const book = JSON.parse(readRaw(SOURCE).replace(/^﻿/, ''))
const chapters = Object.keys(book)

const topics = TOPICS.map(({ id, chapter, en }) => {
  const title = chapters[chapter - 1]
  if (!title) throw new Error(`chapter ${chapter} is not in ${SOURCE}`)
  const items = book[title].Adhkar.map((entry, index) => ({
    id: `${id}-${index + 1}`,
    text: tidy(entry.Text),
    count: Number.isInteger(entry.Count) && entry.Count > 0 ? entry.Count : 1,
    reference: tidy(entry.Reference ?? ''),
  }))
  if (items.some((item) => !item.text)) throw new Error(`chapter ${chapter} has an empty entry`)
  return { id, titleAr: tidy(title), titleEn: en, items }
})

const output = {
  source: {
    name: 'asellam/HisnElMuslim, from Hisn al-Muslim by Sa’id ibn Ali ibn Wahf al-Qahtani',
    url: 'https://github.com/asellam/HisnElMuslim/blob/872764ca013116c905f7fc9c3dc972c27cd37d4a/hisn.json',
    license: 'MIT License — Copyright (c) 2021 Abdellah SELLAM. The book belongs to its author and publisher; these are the supplications of chapters it gathers, with their citations.',
  },
  topics,
}
writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n')
console.log(`comfort-duas.json: ${topics.length} topics, ${topics.reduce((n, t) => n + t.items.length, 0)} entries`)
