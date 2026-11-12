/** SOURCE OF TRUTH: search vocabulary cache tests — WHAT: the "did you mean" words are cached per store and market catalog, read from the products the search can find, and capped / WHY: one market must never be offered another market's product words */
import type { StoreTx } from '@commerce/db'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSearchVocabularies, searchVocabulary, VOCABULARY_MAX_ENTRIES } from './search-words'

const dialect = new PgDialect()

/**
 * A transaction whose `app.catalog_id` is `catalog` ('' for none), and whose products' words
 * depend on that catalog, as the database's `soldInRequestCatalog` filter would make them.
 */
function fakeTx(wordsByCatalog: Record<string, string[]>) {
  const state = { catalog: '', vocabularyReads: [] as string[], sql: [] as string[] }
  const tx = {
    execute: async (query: SQL) => {
      const text = dialect.sqlToQuery(query).sql
      state.sql.push(text)
      if (text.includes('as catalog')) return [{ catalog: state.catalog || null }]
      state.vocabularyReads.push(state.catalog)
      return (wordsByCatalog[state.catalog] ?? []).map((word) => ({ word, count: 1 }))
    },
  } as unknown as StoreTx
  return { tx, state }
}

const words = (list: { word: string }[]) => list.map((w) => w.word)

beforeEach(() => clearSearchVocabularies())

describe('searchVocabulary', () => {
  it('keeps one vocabulary per store and catalog', async () => {
    const { tx, state } = fakeTx({ '': ['kurta', 'saree'], 'cat-uae': ['abaya'] })
    expect(words(await searchVocabulary(tx, 'store-1', 0))).toEqual(['kurta', 'saree'])
    state.catalog = 'cat-uae'
    // Before the fix the India words came back here, from the store-only key.
    expect(words(await searchVocabulary(tx, 'store-1', 1))).toEqual(['abaya'])
    state.catalog = ''
    expect(words(await searchVocabulary(tx, 'store-1', 2))).toEqual(['kurta', 'saree'])
    expect(state.vocabularyReads).toEqual(['', 'cat-uae'])
  })

  it('reads only products the search can find: sold in the catalog, not the test product', async () => {
    const { tx, state } = fakeTx({ '': ['kurta'] })
    await searchVocabulary(tx, 'store-1', 0)
    const read = state.sql.find((s) => s.includes('regexp_split_to_table')) ?? ''
    expect(read).toContain('app.catalog_id')
    expect(read).toContain('not p.is_system_test')
  })

  it('reads again after a minute', async () => {
    const { tx, state } = fakeTx({ '': ['kurta'] })
    await searchVocabulary(tx, 'store-1', 0)
    await searchVocabulary(tx, 'store-1', 59_999)
    await searchVocabulary(tx, 'store-1', 60_000)
    expect(state.vocabularyReads).toHaveLength(2)
  })

  it('keeps at most VOCABULARY_MAX_ENTRIES, dropping the oldest read', async () => {
    const { tx, state } = fakeTx({ '': ['kurta'] })
    for (let i = 0; i <= VOCABULARY_MAX_ENTRIES; i++) await searchVocabulary(tx, `store-${i}`, 0)
    expect(state.vocabularyReads).toHaveLength(VOCABULARY_MAX_ENTRIES + 1)
    // The newest stays cached; the first one was evicted and is read again.
    await searchVocabulary(tx, `store-${VOCABULARY_MAX_ENTRIES}`, 1)
    expect(state.vocabularyReads).toHaveLength(VOCABULARY_MAX_ENTRIES + 1)
    await searchVocabulary(tx, 'store-0', 1)
    expect(state.vocabularyReads).toHaveLength(VOCABULARY_MAX_ENTRIES + 2)
  })

  it('reads fresh without a store id', async () => {
    const { tx, state } = fakeTx({ '': ['kurta'] })
    await searchVocabulary(tx, undefined, 0)
    await searchVocabulary(tx, undefined, 0)
    expect(state.vocabularyReads).toHaveLength(2)
  })
})
