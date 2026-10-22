import { describe, expect, it } from 'vitest'
import {
  LOW_STOCK_THRESHOLD,
  STOCK_FILTER_PARAM,
  STOCK_FILTERS,
  stockFilterState,
  stockStateOf,
} from './stock-state'

describe('stockStateOf', () => {
  it('reads untracked stock as unlimited, whatever the count', () => {
    expect(stockStateOf({ trackInventory: false, available: 0 })).toBe('unlimited')
  })

  it('splits tracked stock at the low threshold', () => {
    expect(stockStateOf({ trackInventory: true, available: 0 })).toBe('out')
    expect(stockStateOf({ trackInventory: true, available: -2 })).toBe('out')
    expect(stockStateOf({ trackInventory: true, available: LOW_STOCK_THRESHOLD })).toBe('low')
    expect(stockStateOf({ trackInventory: true, available: LOW_STOCK_THRESHOLD + 1 })).toBe(
      'in_stock',
    )
  })

  it("uses the store's own threshold when given", () => {
    expect(stockStateOf({ trackInventory: true, available: 8 }, 10)).toBe('low')
  })
})

describe('stock filters', () => {
  it('keeps the short ?stock= values old links use', () => {
    expect([...STOCK_FILTERS].sort()).toEqual(Object.values(STOCK_FILTER_PARAM).sort())
    expect(stockFilterState('in')).toBe('in_stock')
    expect(stockFilterState('low')).toBe('low')
    expect(stockFilterState('out')).toBe('out')
  })
})
