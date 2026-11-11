import { describe, expect, it } from 'vitest'
import { batchPosition } from './bulk-edit-state'

const orders = [
  { orderId: 'a', pickedKey: 'k1' },
  { orderId: 'b', pickedKey: null },
]

describe('batchPosition', () => {
  it('finds the open order and its index', () => {
    expect(batchPosition(orders, 'b')).toEqual({ index: 1, order: orders[1] })
  })

  it('is -1 and undefined when nothing is open', () => {
    expect(batchPosition(orders, null)).toEqual({ index: -1, order: undefined })
    expect(batchPosition(orders, 'zz')).toEqual({ index: -1, order: undefined })
  })
})
