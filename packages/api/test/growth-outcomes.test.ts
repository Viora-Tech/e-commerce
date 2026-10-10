import { describe, expect, it } from 'vitest'
import { isEarned, type OutcomeOrder, outcomeTotals } from '../src/services/growth-outcomes.service'

const o = (totalPaise: number, ids: Partial<OutcomeOrder> = {}): OutcomeOrder => ({
  totalPaise,
  campaignId: null,
  automationId: null,
  linkId: null,
  discountKey: null,
  ...ids,
})

describe('growth outcomes', () => {
  it('credits each kind, and counts an order once in what marketing earned', () => {
    const orders = [
      o(100000, { campaignId: 'c1', discountKey: 'DIWALI10' }),
      o(50000, { campaignId: 'c1' }),
      o(30000, { campaignId: 'c2' }),
      o(20000, { automationId: 'a1' }),
      o(40000, { linkId: 'l1' }),
      o(70000),
    ]
    const t = outcomeTotals(orders)
    expect(t.earnedPaise).toBe(240000)
    expect(t.earnedOrders).toBe(5)
    expect(t.perKind.get('campaigns')).toMatchObject({ orders: 3, revenuePaise: 180000 })
    expect(t.perKind.get('campaigns')?.items.get('c1')).toBe(150000)
    expect(t.perKind.get('discounts')).toMatchObject({ orders: 1, revenuePaise: 100000 })
    expect(t.perKind.get('automations')).toMatchObject({ orders: 1, revenuePaise: 20000 })
    expect(t.perKind.get('links')).toMatchObject({ orders: 1, revenuePaise: 40000 })
  })

  it('does not credit an order nothing of ours touched', () => {
    expect(isEarned(o(1000))).toBe(false)
    expect(isEarned(o(1000, { discountKey: 'WELCOME' }))).toBe(true)
  })
})
