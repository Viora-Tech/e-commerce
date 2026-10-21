/** SOURCE OF TRUTH: tests for the built-in search's word handling — WHAT: edit distance, typo correction, synonym groups and the search plan / WHY: forgiving search must not "correct" real words or numbers */
import { describe, expect, it } from 'vitest'
import {
  cleanSynonymGroups,
  correctTerm,
  editDistance,
  maxEdits,
  planSearch,
  synonymsOf,
  type VocabularyWord,
} from './search-text'

const vocab = (...words: string[]): VocabularyWord[] => words.map((word) => ({ word, count: 1 }))

describe('editDistance', () => {
  it('counts edits, with a swap of neighbours as one', () => {
    expect(editDistance('keyboard', 'keyboard', 2)).toBe(0)
    expect(editDistance('keybord', 'keyboard', 2)).toBe(1)
    expect(editDistance('keybaord', 'keyboard', 2)).toBe(1)
    expect(editDistance('mecanical', 'mechanical', 2)).toBe(1)
  })

  it('stops at max + 1', () => {
    expect(editDistance('mouse', 'keyboard', 2)).toBe(3)
    expect(editDistance('a', 'abcdef', 1)).toBe(2)
  })
})

describe('maxEdits', () => {
  it('leaves short words alone and allows two edits from eight letters', () => {
    expect(maxEdits(3)).toBe(0)
    expect(maxEdits(4)).toBe(1)
    expect(maxEdits(7)).toBe(1)
    expect(maxEdits(8)).toBe(2)
  })
})

describe('correctTerm', () => {
  const words = vocab('keyboard', 'logitech', 'mousepad', 'wireless', 'mouse')

  it('fixes a misspelt word to the nearest catalogue word', () => {
    expect(correctTerm('keybord', words)).toBe('keyboard')
    expect(correctTerm('logitch', words)).toBe('logitech')
    expect(correctTerm('wirless', words)).toBe('wireless')
  })

  it('keeps words the catalogue contains, even inside a longer word', () => {
    expect(correctTerm('mouse', words)).toBeNull()
    expect(correctTerm('logi', words)).toBeNull()
  })

  it('leaves numbers, SKUs, short words and far-off words alone', () => {
    expect(correctTerm('g502', words)).toBeNull()
    expect(correctTerm('mat', words)).toBeNull()
    expect(correctTerm('banana', words)).toBeNull()
  })

  it('prefers the commoner word on a tie', () => {
    const tie = [
      { word: 'cable', count: 1 },
      { word: 'table', count: 9 },
    ]
    expect(correctTerm('xable', tie)).toBe('table')
  })
})

describe('synonyms', () => {
  it('cleans groups: lower case, no repeats, at least two words', () => {
    expect(cleanSynonymGroups([[' KB ', 'Keyboard', 'kb'], ['solo'], []])).toEqual([
      ['kb', 'keyboard'],
    ])
  })

  it('lists a word with every synonym from every group', () => {
    const groups = [
      ['kb', 'keyboard'],
      ['keyboard', 'keeb'],
    ]
    expect(synonymsOf('keyboard', groups)).toEqual(['keyboard', 'kb', 'keeb'])
    expect(synonymsOf('mouse', groups)).toEqual(['mouse'])
  })
})

describe('planSearch', () => {
  const words = vocab('keyboard', 'wireless', 'mouse')

  it('corrects misspellings and reports the corrected query', () => {
    expect(planSearch(['wirless', 'mouse'], words, [])).toEqual({
      terms: ['wireless', 'mouse'],
      groups: [['wireless'], ['mouse']],
      corrected: 'wireless mouse',
    })
  })

  it('expands synonyms and never "corrects" a word that has some', () => {
    const plan = planSearch(['kb'], words, [['kb', 'keyboard']])
    expect(plan).toEqual({ terms: ['kb'], groups: [['kb', 'keyboard']], corrected: null })
  })

  it('leaves a clean query as it is', () => {
    expect(planSearch(['mouse'], words, []).corrected).toBeNull()
  })
})
