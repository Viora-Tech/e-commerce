import { describe, expect, it } from 'vitest'
import { indexSettings, plainText, toDocument } from '../src/documents'

const lexical = {
  root: {
    children: [
      { type: 'paragraph', children: [{ text: 'Soft cotton ' }, { text: 'tee' }] },
      { type: 'paragraph', children: [{ text: 'Machine wash.' }] },
    ],
  },
}

describe('plainText', () => {
  it('reads Lexical text nodes block by block', () => {
    expect(plainText(lexical)).toBe('Soft cotton tee Machine wash.')
  })

  it('reads a Lexical string, a legacy string and HTML', () => {
    expect(plainText(JSON.stringify(lexical))).toBe('Soft cotton tee Machine wash.')
    expect(plainText('  Just words  ')).toBe('Just words')
    expect(plainText('<p>Bold <b>tee</b></p>')).toBe('Bold tee')
    expect(plainText(null)).toBe('')
  })
})

describe('toDocument', () => {
  it('shapes a product for the index', () => {
    const doc = toDocument({
      id: 'p1',
      handle: 'cotton-tee',
      title: 'Cotton tee',
      vendor: ' Waimers ',
      productType: 'T-shirts',
      tags: ['summer', 'summer', ' '],
      description: lexical,
      skus: ['TEE-1', null, 'TEE-1', 'TEE-2'],
      optionValues: ['Black', 'XL'],
      collections: ['new-in'],
      minPricePaise: 49_900,
      maxPricePaise: 59_900,
      available: true,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      image: 'https://cdn.example/tee.jpg',
    })
    expect(doc).toEqual({
      id: 'p1',
      handle: 'cotton-tee',
      title: 'Cotton tee',
      vendor: 'Waimers',
      type: 'T-shirts',
      tags: ['summer'],
      skus: ['TEE-1', 'TEE-2'],
      options: ['Black', 'XL'],
      description: 'Soft cotton tee Machine wash.',
      collections: ['new-in'],
      min_price: 49_900,
      max_price: 59_900,
      available: true,
      created_at: 1_790_812_800,
      image: 'https://cdn.example/tee.jpg',
    })
  })
})

describe('indexSettings', () => {
  it('ranks the title first and the description last', () => {
    const s = indexSettings([])
    expect(s.searchableAttributes[0]).toBe('title')
    expect(s.searchableAttributes.at(-1)).toBe('description')
    expect(s.searchableAttributes.indexOf('vendor')).toBeLessThan(
      s.searchableAttributes.indexOf('skus'),
    )
  })

  it('keeps typos on, except on SKUs, and carries the synonyms', () => {
    const s = indexSettings([['tee', 'tshirt']])
    expect(s.typoTolerance.enabled).toBe(true)
    expect(s.typoTolerance.disableOnAttributes).toContain('skus')
    expect(s.synonyms).toEqual({ tee: ['tshirt'], tshirt: ['tee'] })
    expect(s.filterableAttributes).toEqual(
      expect.arrayContaining(['available', 'min_price', 'vendor', 'type', 'tags', 'collections']),
    )
    expect(s.sortableAttributes).toEqual(['min_price', 'created_at', 'title'])
  })
})
