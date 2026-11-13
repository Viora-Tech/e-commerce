/** SOURCE OF TRUTH: parcel availability rules — WHAT: shelf units, waiting pre-orders and why a parcel waits / WHY: Create shipment's ticks and chips, To book's "Waiting · pre-order 22 Oct" */
import { describe, expect, it } from 'vitest'
import { availabilityOf, waitingFor } from './parcel-availability'

describe('availabilityOf', () => {
  it('clamps the shelf to the units the line holds, never below nothing', () => {
    const base = { quantity: 2, preorder: false, arrivesOn: null, restockOn: '2026-10-20' }
    expect(availabilityOf({ ...base, onHand: 9 })).toEqual({
      inStock: 2,
      preorder: null,
      restockOn: null,
    })
    expect(availabilityOf({ ...base, onHand: 1 })).toEqual({
      inStock: 1,
      preorder: null,
      restockOn: '2026-10-20',
    })
    expect(availabilityOf({ ...base, onHand: -4 }).inStock).toBe(0)
  })

  it('a pre-order waits only while the shelf cannot cover it', () => {
    const pre = { quantity: 1, preorder: true, arrivesOn: '2026-10-22', restockOn: '2026-10-20' }
    expect(availabilityOf({ ...pre, onHand: 0 })).toEqual({
      inStock: 0,
      preorder: { arrivesOn: '2026-10-22' },
      restockOn: null,
    })
    expect(availabilityOf({ ...pre, onHand: 1 }).preorder).toBeNull()
  })
})

describe('waitingFor', () => {
  const ready = { inStock: 1, preorder: null, restockOn: null }
  it('is nothing when every unit is on the shelf', () => {
    expect(waitingFor([ready], [1])).toBeNull()
  })

  it('names a pre-order before a stock shortfall, with the latest date', () => {
    const lines = [
      { inStock: 0, preorder: { arrivesOn: '2026-10-22' }, restockOn: null },
      { inStock: 0, preorder: { arrivesOn: '2026-10-18' }, restockOn: null },
      { inStock: 0, preorder: null, restockOn: '2026-10-30' },
    ]
    expect(waitingFor(lines, [1, 1, 1])).toEqual({ kind: 'preorder', on: '2026-10-22' })
  })

  it('a shortfall with no restock date has no date', () => {
    const lines = [
      { inStock: 1, preorder: null, restockOn: '2026-10-20' },
      { inStock: 0, preorder: null, restockOn: null },
    ]
    expect(waitingFor(lines, [2, 1])).toEqual({ kind: 'stock', on: null })
    expect(waitingFor(lines.slice(0, 1), [2])).toEqual({ kind: 'stock', on: '2026-10-20' })
  })
})
