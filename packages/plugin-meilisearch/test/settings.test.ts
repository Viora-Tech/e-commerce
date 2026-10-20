import { describe, expect, it } from 'vitest'
import {
  meilisearchSettingsView,
  normaliseMeilisearchHost,
  parseMeilisearchSettings,
  parseSynonymLines,
  productsIndex,
  searchReady,
  synonymLines,
  synonymsMap,
} from '../src/settings'

describe('normaliseMeilisearchHost', () => {
  it('keeps the origin and path, drops the trailing slash', () => {
    expect(normaliseMeilisearchHost('https://search.example.com/')).toBe(
      'https://search.example.com',
    )
    expect(normaliseMeilisearchHost('search.example.com/meili/')).toBe(
      'https://search.example.com/meili',
    )
    expect(normaliseMeilisearchHost('http://meilisearch:7700')).toBe('http://meilisearch:7700')
  })

  it('refuses what is not an http(s) address or carries credentials', () => {
    expect(normaliseMeilisearchHost('')).toBeNull()
    expect(normaliseMeilisearchHost('ftp://x.example')).toBeNull()
    expect(normaliseMeilisearchHost('https://user:pw@x.example')).toBeNull()
  })
})

describe('synonyms', () => {
  it('reads one group per line, trimmed, lowercased, without repeats or lone words', () => {
    expect(parseSynonymLines(' Tee, T-shirt , tshirt, tee\nkurta\n\nphone,  Mobile ')).toEqual([
      ['tee', 't-shirt', 'tshirt'],
      ['phone', 'mobile'],
    ])
  })

  it('round-trips through the editor text', () => {
    const groups = [
      ['tee', 'tshirt'],
      ['phone', 'mobile'],
    ]
    expect(parseSynonymLines(synonymLines(groups))).toEqual(groups)
  })

  it('maps every word to the others in its groups', () => {
    expect(
      synonymsMap([
        ['tee', 'tshirt', 't-shirt'],
        ['tee', 'top'],
      ]),
    ).toEqual({
      tee: ['tshirt', 't-shirt', 'top'],
      tshirt: ['tee', 't-shirt'],
      't-shirt': ['tee', 'tshirt'],
      top: ['tee'],
    })
  })
})

describe('settings', () => {
  it('falls back to defaults on a broken entry', () => {
    expect(parseMeilisearchSettings({ host: 42 }).host).toBe('')
    expect(parseMeilisearchSettings(undefined).synonyms).toEqual([])
  })

  it('names the index after the store', () => {
    expect(productsIndex('0b0f6c1e-1d2a-4b8e-9c3f-5a6b7c8d9e0f')).toBe(
      'products_0b0f6c1e-1d2a-4b8e-9c3f-5a6b7c8d9e0f',
    )
  })

  it('searches only once connected with a key and indexed once', () => {
    const base = parseMeilisearchSettings({ host: 'https://s.example', adminKey: 'blob' })
    expect(searchReady(base)).toBe(false)
    expect(searchReady({ ...base, lastSyncAt: '2026-10-20T00:00:00.000Z' })).toBe(true)
    expect(searchReady({ ...base, adminKey: '', lastSyncAt: '2026-10-20T00:00:00.000Z' })).toBe(
      false,
    )
  })

  it('never shows a key to the admin', () => {
    const view = meilisearchSettingsView(
      parseMeilisearchSettings({ host: 'https://s.example', adminKey: 'secret', searchKey: 'x' }),
    )
    expect(view).toMatchObject({ hasAdminKey: true, hasSearchKey: true, live: false })
    expect(JSON.stringify(view)).not.toContain('secret')
  })
})
