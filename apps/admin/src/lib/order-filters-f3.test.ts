import { describe, expect, it } from 'vitest'
import { appliedFromGroups } from '@/components/table/filter-panel'
import { filterPanelContent } from '@/data/filter-panel'
import { ordersContent } from '@/data/orders'
import { abandonedFilterInput, hasAbandonedFilters } from '@/lib/abandoned-list-filters'
import { NO_DATE_FILTER } from '@/lib/date-filter'
import { draftFilterInput, hasDraftFilters } from '@/lib/draft-list-filters'
import {
  FILTER_PARAMS,
  hasOrderFilters,
  NO_FILTERS,
  orderFilterGroups,
  orderFilterInput,
} from '@/lib/order-list-filters'
import { hasReturnFilters, returnFilterInput } from '@/lib/return-list-filters'
import { hasShipmentFilters, shipmentFilterInput } from '@/lib/shipment-list-filters'

const NOW = new Date('2026-10-29T12:00:00.000Z')
const WEEK_AGO = new Date(NOW.getTime() - 7 * 86_400_000).toISOString()

describe('orders filters (F3)', () => {
  it('sends tags, channel, value, discount, return status and collection with the old filters', () => {
    const f = {
      ...NO_FILTERS,
      payment: ['paid' as const],
      tag: ['vip'],
      channel: ['social' as const, 'untracked' as const],
      totalMin: '499.5',
      totalMax: '1000',
      discount: ['DIWALI10'],
      returns: ['none' as const],
      collection: ['c1', 'c2'],
    }
    expect(hasOrderFilters(f)).toBe(true)
    expect(orderFilterInput(f, NOW)).toEqual({
      paymentStatus: ['paid'],
      tags: ['vip'],
      channels: ['social', 'untracked'],
      totalMinPaise: 49_950,
      totalMaxPaise: 100_000,
      discountCodes: ['DIWALI10'],
      returnStatus: ['none'],
      collectionIds: ['c1', 'c2'],
    })
  })

  it('treats a value that is not a number as no bound', () => {
    const f = { ...NO_FILTERS, totalMin: 'abc' }
    expect(hasOrderFilters(f)).toBe(false)
    expect(orderFilterInput(f, NOW)).toEqual({})
  })

  it('reads the new filters from the URL and ignores unknown values', () => {
    expect(FILTER_PARAMS.channel.parse('social,bogus')).toEqual(['social'])
    expect(FILTER_PARAMS.returns.parse('requested,done')).toEqual(['requested', 'done'])
    expect(FILTER_PARAMS.collection.parse('a,b')).toEqual(['a', 'b'])
  })

  it('lists Collection, Tags and Discount code only when the store has some, with chip names', () => {
    const none = orderFilterGroups(NO_FILTERS, ordersContent.filters, () => undefined)
    expect(none.map((g) => g.key)).not.toContain('collection')
    expect(none.map((g) => g.key)).not.toContain('tag')
    const f = { ...NO_FILTERS, collection: ['c1'], returns: ['in_progress' as const] }
    const groups = orderFilterGroups(f, ordersContent.filters, () => undefined, {
      tags: ['vip'],
      discountCodes: ['DIWALI10'],
      couriers: [],
      collections: [{ id: 'c1', title: 'Mousepads' }],
    })
    expect(groups.map((g) => g.key)).toEqual(
      expect.arrayContaining(['collection', 'tag', 'discount', 'channel', 'returns', 'total']),
    )
    const chips = appliedFromGroups(groups, filterPanelContent)
    expect(chips.map((c) => [c.field, c.label])).toEqual([
      ['Collection', 'Mousepads'],
      ['Return status', 'Return on the way'],
    ])
  })
})

describe('drafts, abandoned, returns and shipments filters (F3)', () => {
  it('drafts: created window and total', () => {
    const f = { created: { preset: '7d', from: '', to: '' }, totalMin: '100', totalMax: '' }
    expect(hasDraftFilters(f)).toBe(true)
    expect(draftFilterInput(f, NOW)).toEqual({ createdFrom: WEEK_AGO, totalMinPaise: 10_000 })
    expect(hasDraftFilters({ created: NO_DATE_FILTER, totalMin: '', totalMax: '' })).toBe(false)
  })

  it('abandoned: last active replaces the window, value and contact', () => {
    const f = {
      active: { preset: 'custom', from: '2026-10-01', to: '' },
      valueMin: '',
      valueMax: '2000',
      contact: 'phone' as const,
    }
    expect(hasAbandonedFilters(f)).toBe(true)
    const input = abandonedFilterInput(f, NOW)
    expect(input.activeFrom).toBeDefined()
    expect(input).toMatchObject({ valueMaxPaise: 200_000, contact: 'phone' })
    expect(input).not.toHaveProperty('activeTo')
  })

  it('returns: reasons, outcomes and asked on', () => {
    const f = {
      reason: ['damaged' as const],
      outcome: ['refund' as const, 'exchange' as const],
      requested: { preset: '7d', from: '', to: '' },
    }
    expect(hasReturnFilters(f)).toBe(true)
    expect(returnFilterInput(f, NOW)).toEqual({
      reasons: ['damaged'],
      resolutions: ['refund', 'exchange'],
      requestedFrom: WEEK_AGO,
    })
  })

  it('shipments: courier and delivery problem reach the API (they never did before)', () => {
    const f = {
      courier: 'delhivery',
      ndr: ['pending' as const],
      booked: NO_DATE_FILTER,
      method: ['cod' as const, 'prepaid' as const],
    }
    expect(hasShipmentFilters(f)).toBe(true)
    // Both payment methods ticked is no method filter.
    expect(shipmentFilterInput(f, NOW)).toEqual({ provider: 'delhivery', ndrStatus: ['pending'] })
  })
})
