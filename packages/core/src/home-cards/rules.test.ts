/** SOURCE OF TRUTH: Home smart card rule tests — one block per rule, plus ranking and the limit */
import { describe, expect, it } from 'vitest'
import {
  buildHomeCards,
  HOME_CARD_LIMIT,
  type HomeCardFacts,
  parseHomeCard,
  staleCollectionReason,
} from './rules'

const OCT_2026 = { month: 10, year: 2026 }

const facts = (over: Partial<HomeCardFacts> = {}): HomeCardFacts => ({
  productPages: [],
  collections: [],
  repeatBuyers: 0,
  hasRepeatSegment: false,
  bestSellers: [],
  lowStockThreshold: 5,
  unfulfilled: { orders: 0, oldestDays: 0 },
  abandoned: { carts: 0, valuePaise: 0 },
  productSales: [],
  ...over,
})

const product = (id: string, title = `Product ${id}`) => ({
  productId: id,
  title,
  imageUrl: null,
})

const kinds = (f: HomeCardFacts) => buildHomeCards(f, OCT_2026).map((c) => c.kind)

describe('weak product page', () => {
  it('flags a busy page that nobody adds to cart', () => {
    const cards = buildHomeCards(
      facts({
        productPages: [{ ...product('p1', 'Demon1 glasspad'), sessions: 645, addToCarts: 1 }],
      }),
      OCT_2026,
    )
    expect(cards).toEqual([
      expect.objectContaining({
        kind: 'weak_product_page',
        key: 'weak_product_page:p1',
        sessions: 645,
        addToCarts: 1,
      }),
    ])
  })

  it('ignores quiet pages and pages that convert', () => {
    expect(
      kinds(
        facts({
          productPages: [
            { ...product('a'), sessions: 40, addToCarts: 0 },
            { ...product('b'), sessions: 500, addToCarts: 20 },
          ],
        }),
      ),
    ).toEqual([])
  })

  it('keeps the two busiest', () => {
    const cards = buildHomeCards(
      facts({
        productPages: [
          { ...product('a'), sessions: 200, addToCarts: 0 },
          { ...product('b'), sessions: 900, addToCarts: 1 },
          { ...product('c'), sessions: 400, addToCarts: 0 },
        ],
      }),
      OCT_2026,
    )
    expect(cards.map((c) => c.key)).toEqual(['weak_product_page:b', 'weak_product_page:c'])
  })
})

describe('stale collection', () => {
  it('names a festival out of its months', () => {
    expect(staleCollectionReason('Raksha Bandhan specials', 10, 2026)).toBe('season')
    expect(staleCollectionReason('Rakhi gifts', 8, 2026)).toBeNull()
  })

  it('keeps Diwali live through October', () => {
    expect(staleCollectionReason('Diwali sale', 10, 2026)).toBeNull()
    expect(staleCollectionReason('Diwali sale', 1, 2027)).toBe('season')
  })

  it('wraps the year for New Year', () => {
    expect(staleCollectionReason('New Year drops', 1, 2027)).toBeNull()
    expect(staleCollectionReason('New Year drops', 6, 2027)).toBe('season')
  })

  it('flags an old year in the name', () => {
    expect(staleCollectionReason('Best of 2025', 10, 2026)).toBe('year')
    expect(staleCollectionReason('Best of 2026', 10, 2026)).toBeNull()
  })

  it('matches whole words only', () => {
    expect(staleCollectionReason('Holiday edit', 6, 2026)).toBeNull()
    expect(staleCollectionReason('Mousepads', 6, 2026)).toBeNull()
  })

  it('makes a card per stale live collection', () => {
    const cards = buildHomeCards(
      facts({
        collections: [
          { id: 'c1', title: 'Raksha Bandhan', imageUrl: null },
          { id: 'c2', title: 'Glasspads', imageUrl: null },
        ],
      }),
      OCT_2026,
    )
    expect(cards).toEqual([
      expect.objectContaining({ kind: 'stale_collection', collectionId: 'c1', reason: 'season' }),
    ])
  })
})

describe('repeat buyers', () => {
  it('suggests a segment once there are enough', () => {
    expect(kinds(facts({ repeatBuyers: 62 }))).toEqual(['repeat_buyers'])
    expect(kinds(facts({ repeatBuyers: 4 }))).toEqual([])
  })

  it('stays quiet when the segment exists', () => {
    expect(kinds(facts({ repeatBuyers: 62, hasRepeatSegment: true }))).toEqual([])
  })
})

describe('restock best seller', () => {
  it('warns when a best seller is low, with days left', () => {
    const cards = buildHomeCards(
      facts({ bestSellers: [{ ...product('p1'), unitsSold: 30, available: 3 }] }),
      OCT_2026,
    )
    expect(cards).toEqual([
      expect.objectContaining({ kind: 'restock_bestseller', available: 3, daysLeft: 3 }),
    ])
  })

  it('skips untracked stock, slow sellers and full shelves', () => {
    expect(
      kinds(
        facts({
          bestSellers: [
            { ...product('a'), unitsSold: 30, available: null },
            { ...product('b'), unitsSold: 2, available: 1 },
            { ...product('c'), unitsSold: 30, available: 50 },
          ],
        }),
      ),
    ).toEqual([])
  })
})

describe('old unfulfilled orders', () => {
  it('fires once the oldest has waited past the limit', () => {
    expect(kinds(facts({ unfulfilled: { orders: 4, oldestDays: 6 } }))).toEqual(['old_unfulfilled'])
    expect(kinds(facts({ unfulfilled: { orders: 4, oldestDays: 1 } }))).toEqual([])
  })
})

describe('abandoned checkouts', () => {
  it('needs a few carts', () => {
    expect(kinds(facts({ abandoned: { carts: 5, valuePaise: 900_000 } }))).toEqual([
      'abandoned_checkouts',
    ])
    expect(kinds(facts({ abandoned: { carts: 1, valuePaise: 900_000 } }))).toEqual([])
  })
})

describe('product trending', () => {
  it('reports the biggest jump as a percentage', () => {
    const cards = buildHomeCards(
      facts({
        productSales: [
          {
            ...product('t', 'TenZ 2.0'),
            units: 15,
            revenuePaise: 750_000,
            previousRevenuePaise: 100_000,
          },
          { ...product('u'), units: 5, revenuePaise: 300_000, previousRevenuePaise: 100_000 },
        ],
      }),
      OCT_2026,
    )
    expect(cards).toEqual([
      expect.objectContaining({ kind: 'product_trending', productId: 't', percent: 650 }),
    ])
  })

  it('needs sales last month, enough units and at least double', () => {
    expect(
      kinds(
        facts({
          productSales: [
            { ...product('a'), units: 10, revenuePaise: 500_000, previousRevenuePaise: 0 },
            { ...product('b'), units: 1, revenuePaise: 500_000, previousRevenuePaise: 10_000 },
            { ...product('c'), units: 10, revenuePaise: 150_000, previousRevenuePaise: 100_000 },
          ],
        }),
      ),
    ).toEqual([])
  })
})

describe('buildHomeCards', () => {
  it('ranks urgent work first and stops at the limit', () => {
    const cards = buildHomeCards(
      facts({
        repeatBuyers: 62,
        unfulfilled: { orders: 2, oldestDays: 5 },
        abandoned: { carts: 4, valuePaise: 100 },
        productPages: [
          { ...product('a'), sessions: 300, addToCarts: 0 },
          { ...product('b'), sessions: 200, addToCarts: 0 },
        ],
        collections: [
          { id: 'c1', title: 'Holi colours', imageUrl: null },
          { id: 'c2', title: 'Summer 2024', imageUrl: null },
        ],
      }),
      OCT_2026,
    )
    expect(cards).toHaveLength(HOME_CARD_LIMIT)
    expect(cards[0]?.kind).toBe('old_unfulfilled')
    expect(cards.map((c) => c.kind)).not.toContain('repeat_buyers')
  })
})

describe('parseHomeCard', () => {
  it('drops unknown shapes', () => {
    expect(parseHomeCard({ key: 'x', kind: 'gone' })).toBeNull()
    expect(parseHomeCard(null)).toBeNull()
    expect(
      parseHomeCard({ key: 'repeat_buyers', kind: 'repeat_buyers', customers: 3 }),
    ).not.toBeNull()
  })
})
