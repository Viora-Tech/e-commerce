import { describe, expect, it } from 'vitest'
import { appliedFromGroups, clearGroups } from '@/components/table/filter-panel'
import { filterPanelContent } from '@/data/filter-panel'
import { ordersContent } from '@/data/orders'
import {
  hasOrderFilters,
  NO_FILTERS,
  type OrderFilters,
  orderFilterGroups,
  orderFilterInput,
} from './order-list-filters'

const NOW = new Date('2026-10-28T12:00:00.000Z')

describe('order list filters (#884)', () => {
  it('sends the Product filter with the other filters, trimmed', () => {
    const f: OrderFilters = {
      ...NO_FILTERS,
      product: '  pd170 ',
      fulfilment: ['unfulfilled'],
      method: ['cod'],
    }
    expect(hasOrderFilters(f)).toBe(true)
    expect(orderFilterInput(f, NOW)).toEqual({
      product: 'pd170',
      fulfillmentStatus: ['unfulfilled', 'partially_fulfilled'],
      paymentMethod: 'cod',
    })
  })

  it('sends a custom date range as placedFrom and placedTo', () => {
    const f: OrderFilters = {
      ...NO_FILTERS,
      date: { preset: 'custom', from: '2026-10-01', to: '2026-10-28' },
    }
    expect(hasOrderFilters(f)).toBe(true)
    const input = orderFilterInput(f, NOW)
    expect(input.placedFrom).toBeDefined()
    expect(input.placedTo).toBeDefined()
    expect(new Date(input.placedTo as string).getTime()).toBeGreaterThan(
      new Date(input.placedFrom as string).getTime(),
    )
    // A preset still sends only its start.
    const week = orderFilterInput({ ...NO_FILTERS, date: { preset: '7d', from: '', to: '' } }, NOW)
    expect(week).toEqual({ placedFrom: '2026-10-21T12:00:00.000Z' })
  })

  it('treats a Product filter of only spaces as no filter', () => {
    const f: OrderFilters = { ...NO_FILTERS, product: '   ' }
    expect(hasOrderFilters(f)).toBe(false)
    expect(orderFilterInput(f, NOW)).toEqual({})
  })

  it('shows one chip per filter in use, and Clear all empties the Product filter too', () => {
    const patches: Partial<OrderFilters>[] = []
    const f: OrderFilters = { ...NO_FILTERS, product: 'pd170', fulfilment: ['unfulfilled'] }
    const groups = orderFilterGroups(f, ordersContent.filters, (p) => patches.push(p))
    const chips = appliedFromGroups(groups, filterPanelContent)
    expect(chips.map((c) => [c.field, c.label])).toEqual([
      ['Product', 'pd170'],
      ['Fulfilment', 'Unfulfilled'],
    ])
    chips[0]?.onRemove()
    expect(patches).toEqual([{ product: null }])
    patches.length = 0
    clearGroups(groups)
    expect(patches).toContainEqual({ product: null })
    expect(patches).toContainEqual({ fulfilment: [] })
  })
})
