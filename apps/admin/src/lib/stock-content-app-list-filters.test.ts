import { describe, expect, it } from 'vitest'
import { DATE_CUSTOM } from '@/components/table/filter-panel'
import {
  affiliateFilterInput,
  commissionFilterInput,
  hasAffiliateFilters,
  hasCommissionFilters,
  NO_AFFILIATE_FILTERS,
  NO_COMMISSION_FILTERS,
} from '@/lib/affiliate-list-filters'
import {
  blogPostFilterInput,
  hasBlogPostFilters,
  NO_BLOG_POST_FILTERS,
} from '@/lib/blog-post-list-filters'
import {
  hasInboundShipmentFilters,
  inboundShipmentFilterInput,
  NO_INBOUND_SHIPMENT_FILTERS,
} from '@/lib/inbound-shipment-list-filters'
import { paiseBound, windowInput, yesNoInput } from '@/lib/list-filter-parts'
import {
  hasPurchaseOrderFilters,
  NO_PURCHASE_ORDER_FILTERS,
  purchaseOrderFilterInput,
} from '@/lib/purchase-order-list-filters'
import {
  hasReviewFilters,
  NO_REVIEW_FILTERS,
  REVIEW_FILTER_PARAMS,
  reviewFilterInput,
} from '@/lib/review-list-filters'
import {
  hasSupplierFilters,
  NO_SUPPLIER_FILTERS,
  supplierFilterInput,
} from '@/lib/supplier-list-filters'
import {
  hasTransferFilters,
  NO_TRANSFER_FILTERS,
  transferFilterInput,
} from '@/lib/transfer-list-filters'

const NOW = new Date('2026-10-28T12:00:00Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()

describe('list filter parts', () => {
  it('reads typed bounds and yes/no', () => {
    expect(paiseBound('499.5')).toBe(49_950)
    expect(paiseBound('-3')).toBeNull()
    expect(paiseBound('abc')).toBeNull()
    expect(paiseBound('')).toBeNull()
    expect(yesNoInput('yes')).toBe(true)
    expect(yesNoInput('no')).toBe(false)
    expect(yesNoInput(null)).toBeUndefined()
    expect(windowInput('created', {})).toEqual({})
    expect(windowInput('created', { from: 'a', to: 'b' })).toEqual({
      createdFrom: 'a',
      createdTo: 'b',
    })
  })
})

describe('stock list filters', () => {
  it('sends nothing with no filters', () => {
    expect(purchaseOrderFilterInput(NO_PURCHASE_ORDER_FILTERS, NOW)).toEqual({})
    expect(hasPurchaseOrderFilters(NO_PURCHASE_ORDER_FILTERS)).toBe(false)
    expect(transferFilterInput(NO_TRANSFER_FILTERS, NOW)).toEqual({})
    expect(hasTransferFilters(NO_TRANSFER_FILTERS)).toBe(false)
    expect(inboundShipmentFilterInput(NO_INBOUND_SHIPMENT_FILTERS, NOW)).toEqual({})
    expect(hasInboundShipmentFilters(NO_INBOUND_SHIPMENT_FILTERS)).toBe(false)
    expect(supplierFilterInput(NO_SUPPLIER_FILTERS)).toEqual({})
    expect(hasSupplierFilters(NO_SUPPLIER_FILTERS)).toBe(false)
  })

  it('sends purchase order statuses, pickers and both date windows', () => {
    const f = {
      ...NO_PURCHASE_ORDER_FILTERS,
      statuses: ['ordered' as const, 'partially_received' as const],
      supplier: ['s1'],
      location: ['l1', 'l2'],
      expected: { preset: DATE_CUSTOM, from: '2026-11-01', to: '' },
      created: { preset: '30d', from: '', to: '' },
    }
    expect(hasPurchaseOrderFilters(f)).toBe(true)
    expect(purchaseOrderFilterInput(f, NOW)).toEqual({
      statuses: ['ordered', 'partially_received'],
      supplierIds: ['s1'],
      locationIds: ['l1', 'l2'],
      expectedFrom: new Date(2026, 10, 1).toISOString(),
      createdFrom: ago(30),
    })
  })

  it('sends transfer routes and the received window', () => {
    const f = {
      ...NO_TRANSFER_FILTERS,
      origin: ['a'],
      destination: ['b'],
      received: { preset: DATE_CUSTOM, from: '', to: '2026-10-01' },
    }
    expect(transferFilterInput(f, NOW)).toEqual({
      fromLocationIds: ['a'],
      toLocationIds: ['b'],
      receivedTo: new Date(2026, 9, 2).toISOString(),
    })
  })

  it('sends inbound statuses and the Bill of Entry yes/no', () => {
    const f = {
      ...NO_INBOUND_SHIPMENT_FILTERS,
      statuses: ['at_port' as const],
      arrived: { preset: '7d', from: '', to: '' },
      billOfEntry: 'no' as const,
    }
    expect(inboundShipmentFilterInput(f, NOW)).toEqual({
      statuses: ['at_port'],
      arrivedFrom: ago(7),
      hasBillOfEntry: false,
    })
  })

  it('reads an empty custom range as no filter', () => {
    const f = { ...NO_TRANSFER_FILTERS, created: { preset: DATE_CUSTOM, from: '', to: '' } }
    expect(hasTransferFilters(f)).toBe(false)
    expect(transferFilterInput(f, NOW)).toEqual({})
  })

  it('sends supplier countries, currencies and yes/no', () => {
    const f = { country: ['CN'], currency: ['USD'], gstin: 'no' as const, orders: 'yes' as const }
    expect(hasSupplierFilters(f)).toBe(true)
    expect(supplierFilterInput(f)).toEqual({
      countries: ['CN'],
      currencies: ['USD'],
      hasGstin: false,
      hasOrders: true,
    })
  })
})

describe('content and app list filters', () => {
  it('sends review ratings (dropping bad stars), products, sources and flags', () => {
    const f = {
      ...NO_REVIEW_FILTERS,
      rating: [5, 9, 1],
      product: ['p1'],
      source: ['judgeme' as const],
      photos: 'yes' as const,
      replied: 'no' as const,
      created: { preset: '90d', from: '', to: '' },
    }
    expect(hasReviewFilters(f)).toBe(true)
    expect(reviewFilterInput(f, NOW)).toEqual({
      ratings: [5, 1],
      productIds: ['p1'],
      sources: ['judgeme'],
      hasPhotos: true,
      replied: false,
      createdFrom: ago(90),
    })
    expect(reviewFilterInput(NO_REVIEW_FILTERS, NOW)).toEqual({})
    expect(hasReviewFilters({ ...NO_REVIEW_FILTERS, rating: [0] })).toBe(false)
  })

  it('reads an older single-value review link as one pick', () => {
    expect(REVIEW_FILTER_PARAMS.rating.parse('5')).toEqual([5])
    expect(REVIEW_FILTER_PARAMS.product.parse('abc')).toEqual(['abc'])
  })

  it('sends blog picks, the published window and has-image', () => {
    const f = {
      ...NO_BLOG_POST_FILTERS,
      blog: ['b1'],
      tag: ['news', 'drops'],
      author: ['Asha'],
      published: { preset: '7d', from: '', to: '' },
      image: 'no' as const,
    }
    expect(hasBlogPostFilters(f)).toBe(true)
    expect(blogPostFilterInput(f, NOW)).toEqual({
      blogIds: ['b1'],
      tags: ['news', 'drops'],
      authors: ['Asha'],
      publishedFrom: ago(7),
      hasImage: false,
    })
    expect(blogPostFilterInput(NO_BLOG_POST_FILTERS, NOW)).toEqual({})
  })

  it('sends affiliate statuses, programs, joined and earned bounds', () => {
    expect(affiliateFilterInput(NO_AFFILIATE_FILTERS, NOW)).toEqual({})
    expect(hasAffiliateFilters(NO_AFFILIATE_FILTERS)).toBe(false)
    const f = {
      ...NO_AFFILIATE_FILTERS,
      status: ['pending' as const],
      program: ['p1'],
      earnedMin: '100',
      earnedMax: 'x',
    }
    expect(hasAffiliateFilters(f)).toBe(true)
    expect(affiliateFilterInput(f, NOW)).toEqual({
      statuses: ['pending'],
      programIds: ['p1'],
      minEarnedPaise: 10_000,
    })
  })

  it('sends commission statuses, sources, affiliates, amounts and flagged', () => {
    expect(commissionFilterInput(NO_COMMISSION_FILTERS, NOW)).toEqual({})
    expect(hasCommissionFilters(NO_COMMISSION_FILTERS)).toBe(false)
    const f = {
      ...NO_COMMISSION_FILTERS,
      status: ['approved' as const, 'paid' as const],
      source: ['coupon' as const],
      affiliate: ['a1'],
      placed: { preset: '30d', from: '', to: '' },
      amountMax: '250',
      flagged: 'yes' as const,
    }
    expect(commissionFilterInput(f, NOW)).toEqual({
      statuses: ['approved', 'paid'],
      sources: ['coupon'],
      affiliateIds: ['a1'],
      placedFrom: ago(30),
      maxCommissionPaise: 25_000,
      flagged: true,
    })
  })
})
