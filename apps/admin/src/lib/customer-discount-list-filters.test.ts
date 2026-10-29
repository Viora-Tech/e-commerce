import { describe, expect, it } from 'vitest'
import { DATE_CUSTOM } from '@/components/table/filter-panel'
import {
  customerFilterInput,
  hasCustomerFilters,
  NO_CUSTOMER_FILTERS,
  segmentRulesFromFilters,
} from '@/lib/customer-list-filters'
import {
  discountFilterInput,
  hasDiscountFilters,
  NO_DISCOUNT_FILTERS,
} from '@/lib/discount-list-filters'

const NOW = new Date('2026-10-28T12:00:00Z')
const DAY = 86_400_000

describe('customerFilterInput', () => {
  it('sends nothing with no filters', () => {
    expect(customerFilterInput(NO_CUSTOMER_FILTERS, NOW)).toEqual({})
    expect(hasCustomerFilters(NO_CUSTOMER_FILTERS)).toBe(false)
  })

  it('sends multi picks, paise, order counts, dates and consent', () => {
    const f = {
      ...NO_CUSTOMER_FILTERS,
      state: ['MH', 'KA'],
      tag: ['vip'],
      spendMin: '499.5',
      spendMax: 'abc',
      ordersMin: '2',
      ordersMax: '-3',
      created: { preset: '30d', from: '', to: '' },
      lastOrder: { preset: DATE_CUSTOM, from: '', to: '2026-10-01' },
      email: 'yes' as const,
      sms: 'no' as const,
      business: 'no' as const,
    }
    expect(hasCustomerFilters(f)).toBe(true)
    const input = customerFilterInput(f, NOW)
    expect(input).toMatchObject({
      stateCodes: ['MH', 'KA'],
      tags: ['vip'],
      minSpentPaise: 49_950,
      minOrders: 2,
      maxOrders: 0,
      createdFrom: new Date(NOW.getTime() - 30 * DAY).toISOString(),
      acceptsMarketing: true,
      acceptsSms: false,
      business: false,
    })
    expect(input).not.toHaveProperty('maxSpentPaise')
    expect(input).not.toHaveProperty('acceptsWhatsapp')
    expect(input).not.toHaveProperty('lastOrderFrom')
    expect(input.lastOrderTo).toBe(new Date(2026, 9, 2).toISOString())
  })

  it('reads an empty custom range as no filter', () => {
    const f = { ...NO_CUSTOMER_FILTERS, created: { preset: DATE_CUSTOM, from: '', to: '' } }
    expect(hasCustomerFilters(f)).toBe(false)
    expect(customerFilterInput(f, NOW)).toEqual({})
  })
})

describe('segmentRulesFromFilters', () => {
  it('keeps what a segment can express and drops multi picks it cannot', () => {
    const rules = segmentRulesFromFilters(
      {
        ...NO_CUSTOMER_FILTERS,
        state: ['MH', 'KA'],
        tag: ['vip'],
        spendMin: '100',
        ordersMax: '5',
        lastOrder: { preset: '30d', from: '', to: '' },
        business: 'yes',
      },
      'subscribed',
    )
    expect(rules.conditions).toEqual([
      { field: 'spend', op: 'gte', value: '10000' },
      { field: 'orders', op: 'lte', value: '5' },
      { field: 'last_order_days', op: 'lte', value: '30' },
      { field: 'marketing', op: 'eq', value: 'true' },
      { field: 'business', op: 'eq', value: 'true' },
      { field: 'tag', op: 'contains', value: 'vip' },
    ])
  })
})

describe('discountFilterInput', () => {
  it('sends nothing with no filters', () => {
    expect(discountFilterInput(NO_DISCOUNT_FILTERS, NOW)).toEqual({})
    expect(hasDiscountFilters(NO_DISCOUNT_FILTERS)).toBe(false)
  })

  it('sends status, type, method, the active window and usage', () => {
    const f = {
      ...NO_DISCOUNT_FILTERS,
      lifecycle: ['active' as const, 'expired' as const],
      type: ['shipping' as const],
      kind: ['code' as const],
      active: { preset: '7d', from: '', to: '' },
      usedMin: '1',
      usedMax: 'x',
      limitReached: 'no' as const,
    }
    expect(hasDiscountFilters(f)).toBe(true)
    expect(discountFilterInput(f, NOW)).toEqual({
      lifecycles: ['active', 'expired'],
      types: ['shipping'],
      kinds: ['code'],
      activeFrom: new Date(NOW.getTime() - 7 * DAY).toISOString(),
      usedMin: 1,
      limitReached: false,
    })
  })
})
