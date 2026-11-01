import { describe, expect, it } from 'vitest'
import { orderEditContent } from '@/data/order-edit'
import type { OrderDetail } from '../order-detail-types'
import { editInput, isDirty, localChanges, localTotals, startState } from './edit-state'

const money = (paise: number) => `₹${paise / 100}`

/** The fields the editor reads: 2 × Glasspad at ₹1,000, one of them packed. */
const order = {
  id: '00000000-0000-4000-8000-000000000001',
  subtotalPaise: 200000,
  totalPaise: 200000,
  shippingPaise: 0,
  discountPaise: 0,
  shippingRateName: null,
  discountLabel: null,
  lines: [
    {
      id: '00000000-0000-4000-8000-0000000000a1',
      title: 'Glasspad',
      variantTitle: 'Black',
      quantity: 2,
      fulfilledQuantity: 1,
      unitPricePaise: 100000,
      giftCard: false,
    },
  ],
} as unknown as OrderDetail

const lineId = '00000000-0000-4000-8000-0000000000a1'

describe('order edit state (#1014)', () => {
  it('has no changes until something is edited, so Update order stays off', () => {
    const state = startState(order)
    expect(isDirty(order, state)).toBe(false)
    expect(localChanges(order, state, orderEditContent.changes, money)).toEqual([])
  })

  it('a reduced line restocks unless unticked, and says so', () => {
    const state = {
      ...startState(order),
      quantities: { [lineId]: 1 },
      restock: { [lineId]: false },
    }
    expect(isDirty(order, state)).toBe(true)
    expect(editInput(order, state).lines).toEqual([
      { lineId, quantity: 1, unitPricePaise: 100000, restock: false },
    ])
    expect(localChanges(order, state, orderEditContent.changes, money)).toEqual([
      'Glasspad / Black: 2 → 1 (not restocked)',
    ])
    const ticked = { ...state, restock: {} }
    expect(editInput(order, ticked).lines?.[0]?.restock).toBe(true)
  })

  it('a custom item counts as a change, moves the total and goes to the server', () => {
    const state = {
      ...startState(order),
      custom: [
        {
          key: 'custom:1',
          title: 'Gift wrap',
          quantity: 2,
          unitPricePaise: 5000,
          taxable: false,
          hsCode: '',
        },
      ],
    }
    expect(isDirty(order, state)).toBe(true)
    expect(localTotals(order, state).totalPaise).toBe(210000)
    expect(editInput(order, state).custom).toEqual([
      { title: 'Gift wrap', quantity: 2, unitPricePaise: 5000, taxable: false, hsCode: null },
    ])
    expect(localChanges(order, state, orderEditContent.changes, money)).toEqual([
      'Add 2 × Gift wrap',
    ])
  })
})
