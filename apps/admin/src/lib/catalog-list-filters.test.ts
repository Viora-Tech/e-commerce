import { describe, expect, it } from 'vitest'
import { DATE_CUSTOM } from '@/components/table/filter-panel'
import { collectionMatcher } from '@/lib/collection-list-filters'
import { NO_DATE_FILTER } from '@/lib/date-filter'
import { giftCardFilterInput } from '@/lib/gift-card-list-filters'
import {
  hasProductFilters,
  NO_PRODUCT_FILTERS,
  productFilterInput,
} from '@/lib/product-list-filters'

const NOW = new Date('2026-10-28T12:00:00Z')

describe('productFilterInput', () => {
  it('sends nothing with no filters', () => {
    expect(productFilterInput(NO_PRODUCT_FILTERS, NOW)).toEqual({})
    expect(hasProductFilters(NO_PRODUCT_FILTERS)).toBe(false)
  })

  it('sends multi picks, price in paise and the created window', () => {
    const input = productFilterInput(
      {
        ...NO_PRODUCT_FILTERS,
        vendor: ['Acme', 'Bolt'],
        tag: ['sale'],
        collection: ['c1'],
        priceMin: '499.5',
        priceMax: 'abc',
        created: { preset: '7d', from: '', to: '' },
      },
      NOW,
    )
    expect(input).toEqual({
      vendors: ['Acme', 'Bolt'],
      tags: ['sale'],
      collectionIds: ['c1'],
      priceMinPaise: 49_950,
      createdFrom: new Date(NOW.getTime() - 7 * 86_400_000).toISOString(),
    })
  })

  it('sends the Missing filter that Store health links to', () => {
    const f = { ...NO_PRODUCT_FILTERS, missing: 'weight' as const }
    expect(productFilterInput(f, NOW)).toEqual({ missing: 'weight' })
    expect(hasProductFilters(f)).toBe(true)
  })
})

describe('collectionMatcher', () => {
  const row = {
    status: 'active',
    imageUrl: null,
    productCount: 3,
    updatedAt: '2026-10-27T10:00:00Z',
  }
  const none = {
    visibility: [],
    image: null,
    minProducts: '',
    maxProducts: '',
    updated: NO_DATE_FILTER,
  }

  it('keeps every row with no filters', () => {
    expect(collectionMatcher(none, NOW)(row)).toBe(true)
  })

  it('filters by visibility, image, product count and updated date', () => {
    expect(collectionMatcher({ ...none, visibility: ['draft'] }, NOW)(row)).toBe(false)
    expect(collectionMatcher({ ...none, image: 'yes' }, NOW)(row)).toBe(false)
    expect(collectionMatcher({ ...none, image: 'no' }, NOW)(row)).toBe(true)
    expect(collectionMatcher({ ...none, minProducts: '4' }, NOW)(row)).toBe(false)
    expect(collectionMatcher({ ...none, maxProducts: '3' }, NOW)(row)).toBe(true)
    const updated = { preset: '7d', from: '', to: '' }
    expect(collectionMatcher({ ...none, updated }, NOW)(row)).toBe(true)
    expect(
      collectionMatcher({ ...none, updated }, NOW)({ ...row, updatedAt: '2026-01-01T00:00:00Z' }),
    ).toBe(false)
  })
})

describe('giftCardFilterInput', () => {
  it('sends source, balance and expiry days as typed', () => {
    expect(
      giftCardFilterInput(
        {
          source: ['purchase'],
          minBalance: '100',
          maxBalance: '',
          issued: NO_DATE_FILTER,
          expires: { preset: DATE_CUSTOM, from: '2026-11-01', to: '2026-11-30' },
        },
        NOW,
      ),
    ).toEqual({
      source: ['purchase'],
      minBalancePaise: 10_000,
      expiresFrom: '2026-11-01',
      expiresTo: '2026-11-30',
    })
  })
})
