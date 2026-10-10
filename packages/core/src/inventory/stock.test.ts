import { describe, expect, it } from 'vitest'
import {
  availableOf,
  clampReceipt,
  deltaToReach,
  NegativeStockError,
  nextOnHand,
  purchaseOrderStatus,
  purchaseOrderTotals,
  remainingOf,
  stockState,
} from './stock'

describe('stock maths', () => {
  it('available is on hand minus committed', () => {
    expect(availableOf({ onHand: 10, reserved: 3 })).toBe(7)
    expect(availableOf({ onHand: 2, reserved: 5 })).toBe(-3)
  })

  it('refuses to take a tracked variant below zero', () => {
    expect(nextOnHand(5, -5, false)).toBe(0)
    expect(() => nextOnHand(5, -6, false)).toThrow(NegativeStockError)
  })

  it('lets an untracked variant go negative', () => {
    expect(nextOnHand(1, -4, true)).toBe(-3)
  })

  it('computes the delta for a set-to edit', () => {
    expect(deltaToReach(7, 12)).toBe(5)
    expect(deltaToReach(7, 0)).toBe(-7)
  })

  it('clamps receipts to what is outstanding', () => {
    const line = { quantity: 10, received: 4 }
    expect(remainingOf(line)).toBe(6)
    expect(clampReceipt(line, 3)).toBe(3)
    expect(clampReceipt(line, 50)).toBe(6)
    expect(clampReceipt(line, -2)).toBe(0)
    expect(clampReceipt(line, 2.9)).toBe(2)
  })

  it('derives purchase order status from receipts', () => {
    const none = [{ quantity: 5, received: 0 }]
    const part = [
      { quantity: 5, received: 5 },
      { quantity: 3, received: 0 },
    ]
    const all = [
      { quantity: 5, received: 5 },
      { quantity: 3, received: 3 },
    ]
    expect(purchaseOrderStatus(none, 'ordered')).toBe('ordered')
    expect(purchaseOrderStatus(part, 'ordered')).toBe('partially_received')
    expect(purchaseOrderStatus(all, 'partially_received')).toBe('received')
    expect(purchaseOrderStatus(all, 'draft')).toBe('draft')
    expect(purchaseOrderStatus(none, 'closed')).toBe('closed')
  })

  it('counts rejected units as arrived, not outstanding', () => {
    const line = { quantity: 10, received: 4, rejected: 2 }
    expect(remainingOf(line)).toBe(4)
    expect(clampReceipt(line, 9)).toBe(4)
    expect(purchaseOrderStatus([{ quantity: 5, received: 3, rejected: 2 }], 'ordered')).toBe(
      'received',
    )
    expect(purchaseOrderStatus([{ quantity: 5, received: 0 }], 'cancelled')).toBe('cancelled')
  })

  it('totals a purchase order from goods and its charges', () => {
    const totals = purchaseOrderTotals(
      [
        { quantity: 4, received: 1, goodsPaise: 100000 },
        { quantity: 2, received: 2, goodsPaise: 20000 },
      ],
      26600,
    )
    expect(totals).toEqual({
      units: 6,
      receivedUnits: 3,
      subtotalPaise: 120000,
      chargesPaise: 26600,
      totalPaise: 146600,
    })
  })

  it('classifies stock against the low threshold', () => {
    expect(stockState(0, 5)).toBe('out')
    expect(stockState(-1, 5)).toBe('out')
    expect(stockState(5, 5)).toBe('low')
    expect(stockState(6, 5)).toBe('in')
  })
})
