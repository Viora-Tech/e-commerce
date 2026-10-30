import { describe, expect, it } from 'vitest'
import {
  discoveryChange,
  discoveryRate,
  loggableQuery,
  MAX_QUERY_LENGTH,
  normaliseSearchQuery,
  type SearchQueryStat,
  splitSearchLists,
} from './query'

describe('normaliseSearchQuery', () => {
  it('lower-cases, joins spaces and trims punctuation around the words', () => {
    expect(normaliseSearchQuery('  Wireless   KEYBOARD? ')).toBe('wireless keyboard')
    expect(normaliseSearchQuery('"mouse pad"')).toBe('mouse pad')
    expect(normaliseSearchQuery('“Glass Pad”!!')).toBe('glass pad')
  })

  it('keeps punctuation inside the words', () => {
    expect(normaliseSearchQuery('T-Shirt XL/2XL')).toBe('t-shirt xl/2xl')
  })

  it('drops control characters and folds full-width letters', () => {
    expect(normaliseSearchQuery('key\tboard\u0000')).toBe('key board')
    expect(normaliseSearchQuery('ＫＢ')).toBe('kb')
  })

  it('cuts long searches', () => {
    expect(normaliseSearchQuery('a'.repeat(300))).toHaveLength(MAX_QUERY_LENGTH)
  })

  it('keeps Hindi as typed', () => {
    expect(normaliseSearchQuery('  कुर्ता   लाल ')).toBe('कुर्ता लाल')
  })
})

describe('loggableQuery', () => {
  it('keeps an ordinary search, normalised', () => {
    expect(loggableQuery(' Keyboard ')).toBe('keyboard')
  })

  it('never keeps an email or a phone number', () => {
    expect(loggableQuery('riya@example.com')).toBeNull()
    expect(loggableQuery('order for 98765 43210')).toBeNull()
    expect(loggableQuery('+91-98765-43210')).toBeNull()
  })

  it('keeps short numbers such as SKUs and sizes', () => {
    expect(loggableQuery('sku 4521')).toBe('sku 4521')
  })

  it('drops empty searches', () => {
    expect(loggableQuery('   ?? ')).toBeNull()
  })
})

describe('rates', () => {
  it('divides safely', () => {
    expect(discoveryRate(1, 4)).toBe(0.25)
    expect(discoveryRate(3, 0)).toBe(0)
  })

  it('compares with the period before', () => {
    expect(discoveryChange(15, 10)).toBe(50)
    expect(discoveryChange(5, 0)).toBeNull()
  })
})

describe('splitSearchLists', () => {
  const stat = (query: string, results: number, clickedSessions: number): SearchQueryStat => ({
    query,
    searches: 10,
    sessions: 5,
    results,
    clickedSessions,
  })

  it('splits one ranked pass into top, no results and no clicks', () => {
    const stats = [stat('keyboard', 12, 3), stat('ghost', 0, 0), stat('mat', 4, 0)]
    const lists = splitSearchLists(stats)
    expect(lists.topSearches.map((s) => s.query)).toEqual(['keyboard', 'ghost', 'mat'])
    expect(lists.noResults.map((s) => s.query)).toEqual(['ghost'])
    expect(lists.noClicks.map((s) => s.query)).toEqual(['mat'])
  })

  it('caps each list', () => {
    const stats = Array.from({ length: 30 }, (_, i) => stat(`q${i}`, 0, 0))
    const lists = splitSearchLists(stats, 5)
    expect(lists.topSearches).toHaveLength(5)
    expect(lists.noResults).toHaveLength(5)
  })
})
