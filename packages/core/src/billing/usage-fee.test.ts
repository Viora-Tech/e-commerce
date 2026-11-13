/** SOURCE OF TRUTH: per-order fee tests — WHAT: which orders carry the fee and how much / WHY: a bill must never charge an order the store didn't really get */
import { describe, expect, it } from 'vitest'
import {
  billable,
  type FeeOrder,
  feeBillChargePaise,
  feeOrderRows,
  monthFee,
  type PaidPeriod,
  withFeeGst,
} from './usage-fee'

const oct = (day: number, hour = 10) => new Date(Date.UTC(2026, 9, day, hour))
const month: PaidPeriod[] = [
  { plan: 'starter', start: oct(1, 0), end: new Date(Date.UTC(2026, 10, 1)) },
]

/** `n` orders of `paise` each, one minute apart from 2 Oct. */
function orders(n: number, paise: number, from = oct(2)): FeeOrder[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `o${i + 1}`,
    placedAt: new Date(from.getTime() + i * 60_000),
    totalPaise: paise,
  }))
}

describe('monthFee', () => {
  it('skips orders outside paid periods (trial, grace, paused)', () => {
    expect(monthFee(orders(400, 1_00_000), [])).toEqual({
      ordersCounted: 0,
      feeOrders: 0,
      lines: [],
      feePaise: 0,
    })
  })

  it('charges 1% on Starter after 50', () => {
    const fee = monthFee(orders(60, 1_00_000), month)
    expect(fee.ordersCounted).toBe(60)
    expect(fee.feeOrders).toBe(10)
    expect(fee.feePaise).toBe(10 * 1_000)
    expect(fee.lines).toEqual([{ plan: 'starter', basisPoints: 100, orders: 10, feePaise: 10_000 }])
  })

  it('rounds per order', () => {
    const list = [...orders(50, 1_00_000), { id: 'odd', placedAt: oct(20), totalPaise: 33_333 }]
    expect(monthFee(list, month).feePaise).toBe(333)
  })

  it('takes orders in the order they were placed, whatever order they arrive in', () => {
    const list = orders(51, 1_00_000)
    list[50] = { ...list[50], totalPaise: 5_00_000 } as FeeOrder
    expect(monthFee([...list].reverse(), month).feePaise).toBe(5_000)
  })

  it('upgrade mid-month uses the new included count from that moment', () => {
    const list = orders(250, 1_00_000)
    const switchAt = new Date((list[59] as FeeOrder).placedAt.getTime() + 30_000)
    const periods: PaidPeriod[] = [
      { plan: 'starter', start: oct(1, 0), end: new Date(Date.UTC(2026, 10, 1)) },
      { plan: 'growth', start: switchAt, end: new Date(Date.UTC(2026, 10, 20)) },
    ]
    const fee = monthFee(list, periods)
    expect(fee.lines).toEqual([
      { plan: 'starter', basisPoints: 100, orders: 10, feePaise: 10_000 },
      { plan: 'growth', basisPoints: 75, orders: 50, feePaise: 37_500 },
    ])
    expect(fee.feeOrders).toBe(60)
    expect(fee.feePaise).toBe(47_500)
  })

  it('scale never charges', () => {
    const periods: PaidPeriod[] = [
      { plan: 'scale', start: oct(1, 0), end: new Date(Date.UTC(2026, 10, 1)) },
    ]
    expect(monthFee(orders(3000, 1_00_000, oct(1, 1)), periods)).toEqual({
      ordersCounted: 3000,
      feeOrders: 0,
      lines: [],
      feePaise: 0,
    })
  })
})

describe('billable', () => {
  it('carries under ₹100', () => {
    expect(billable(4_000, 5_000)).toEqual({ bill: false, totalPaise: 9_000 })
    expect(billable(4_000, 6_000)).toEqual({ bill: true, totalPaise: 10_000 })
    expect(billable(0, 6_000)).toEqual({ bill: false, totalPaise: 6_000 })
  })
})

describe('feeOrderRows', () => {
  it('lists each order that carried a fee, with its plan and fee', () => {
    const list = orders(52, 1_00_000)
    expect(feeOrderRows(list, month)).toEqual([
      { ...list[50], plan: 'starter', feePaise: 1_000 },
      { ...list[51], plan: 'starter', feePaise: 1_000 },
    ])
  })
})

describe('fee bill charge', () => {
  it('adds 18% GST on top of each line and the carried amount', () => {
    expect(withFeeGst(20_000)).toBe(23_600)
    const lines = [{ feePaise: 20_000 }, { feePaise: 1_234 }]
    expect(feeBillChargePaise({ lines, carriedInPaise: 5_000, totalPaise: 26_234 })).toBe(
      23_600 + 1_456 + 5_900,
    )
  })

  it('charges nothing extra when nothing was carried in', () => {
    expect(
      feeBillChargePaise({ lines: [{ feePaise: 10_000 }], carriedInPaise: 0, totalPaise: 10_000 }),
    ).toBe(11_800)
  })

  it('charges a bill without plan lines as one line of its total', () => {
    expect(feeBillChargePaise({ lines: [], carriedInPaise: 0, totalPaise: 20_000 })).toBe(23_600)
  })
})
