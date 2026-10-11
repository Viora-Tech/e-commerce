/** SOURCE OF TRUTH: order profit maths tests — WHAT: pure profit calculation cases / WHY: guards the money maths */
import { describe, expect, it } from 'vitest'
import {
  allocateProfit,
  computeOrderProfit,
  defaultProfitCosts,
  feeOn,
  type ProfitInput,
  parseProfitCosts,
  withProfitCosts,
} from './profit'

/** ₹1,180 incl. 18% GST (₹180), one unit that cost ₹500, paid online by Razorpay. */
const base = (over: Partial<ProfitInput> = {}): ProfitInput => ({
  totalPaise: 118_000,
  taxPaise: 18_000,
  refundedPaise: 0,
  collectedPaise: null,
  lines: [
    {
      quantity: 1,
      restockedQuantity: 0,
      costAtSalePaise: 50_000,
      costEstimated: false,
      giftCard: false,
    },
  ],
  shipments: [{ courierChargePaise: 6_500 }],
  payments: [{ provider: 'razorpay', amountPaise: 118_000, feePaise: null }],
  rtoPaise: 0,
  costs: { gatewayFees: { razorpay: { percentBps: 236, fixedPaise: 0 } }, codFee: null },
  ...over,
})

describe('computeOrderProfit', () => {
  it('net sales without GST, less goods, courier and the gateway rate', () => {
    const p = computeOrderProfit(base())
    expect(p).toMatchObject({
      netSalesPaise: 100_000,
      goodsPaise: 50_000,
      courierPaise: 6_500,
      // 2.36% of ₹1,180 = ₹27.848 → 2,785 paise
      feesPaise: 2_785,
      rtoPaise: 0,
      profitPaise: 100_000 - 50_000 - 6_500 - 2_785,
    })
    expect(p.marginBps).toBe(4072)
    expect(p.flags).toEqual({
      costEstimated: false,
      costMissing: false,
      courierMissing: false,
      feeFromRate: true,
      feeMissing: false,
    })
  })

  it('a fee the gateway reported wins over the store rate', () => {
    const p = computeOrderProfit(
      base({ payments: [{ provider: 'razorpay', amountPaise: 118_000, feePaise: 2_000 }] }),
    )
    expect(p.feesPaise).toBe(2_000)
    expect(p.flags.feeFromRate).toBe(false)
  })

  it('a method with no rate and no reported fee is flagged, not guessed', () => {
    const p = computeOrderProfit(base({ costs: defaultProfitCosts }))
    expect(p.feesPaise).toBe(0)
    expect(p.flags.feeMissing).toBe(true)
  })

  it('store credit and direct transfers take no fee', () => {
    const p = computeOrderProfit(
      base({
        payments: [
          { provider: 'gift_card', amountPaise: 18_000, feePaise: null },
          { provider: 'manual', amountPaise: 100_000, feePaise: null },
        ],
      }),
    )
    expect(p.feesPaise).toBe(0)
    expect(p.flags.feeMissing).toBe(false)
  })

  it('cash on delivery pays the courier’s COD fee on the cash collected', () => {
    const p = computeOrderProfit(
      base({
        payments: [{ provider: 'cod', amountPaise: 118_000, feePaise: null }],
        costs: { gatewayFees: {}, codFee: { percentBps: 200, fixedPaise: 3_000 } },
      }),
    )
    // 2% of ₹1,180 = 2,360 paise + ₹30
    expect(p.feesPaise).toBe(5_360)
  })

  it('a refund comes off net sales in proportion, GST share included', () => {
    const p = computeOrderProfit(base({ refundedPaise: 59_000 }))
    expect(p.netSalesPaise).toBe(50_000)
  })

  it('units returned to stock are not a cost; unknown costs are flagged', () => {
    const p = computeOrderProfit(
      base({
        lines: [
          {
            quantity: 3,
            restockedQuantity: 1,
            costAtSalePaise: 20_000,
            costEstimated: true,
            giftCard: false,
          },
          {
            quantity: 1,
            restockedQuantity: 0,
            costAtSalePaise: null,
            costEstimated: false,
            giftCard: false,
          },
          {
            quantity: 1,
            restockedQuantity: 0,
            costAtSalePaise: null,
            costEstimated: false,
            giftCard: true,
          },
        ],
      }),
    )
    expect(p.goodsPaise).toBe(40_000)
    expect(p.flags.costEstimated).toBe(true)
    expect(p.flags.costMissing).toBe(true)
  })

  it('a consignment with no known charge is flagged', () => {
    const p = computeOrderProfit(
      base({ shipments: [{ courierChargePaise: 5_000 }, { courierChargePaise: null }] }),
    )
    expect(p.courierPaise).toBe(5_000)
    expect(p.flags.courierMissing).toBe(true)
  })

  it('an RTO counts only what was collected and its return charge', () => {
    const p = computeOrderProfit(
      base({
        collectedPaise: 0,
        payments: [],
        lines: [
          {
            quantity: 1,
            restockedQuantity: 1,
            costAtSalePaise: 50_000,
            costEstimated: false,
            giftCard: false,
          },
        ],
        rtoPaise: 7_000,
      }),
    )
    expect(p).toMatchObject({ netSalesPaise: 0, goodsPaise: 0, profitPaise: -13_500 })
    expect(p.marginBps).toBeNull()
  })
})

describe('feeOn', () => {
  it('rounds half up and adds the fixed part; nothing on nothing', () => {
    expect(feeOn(1_000, { percentBps: 250, fixedPaise: 0 })).toBe(25)
    expect(feeOn(10, { percentBps: 250, fixedPaise: 100 })).toBe(100)
    expect(feeOn(0, { percentBps: 250, fixedPaise: 100 })).toBe(0)
  })
})

describe('allocateProfit', () => {
  it('shares net sales and overheads by line value, adding back exactly', () => {
    const shares = allocateProfit(
      { netSalesPaise: 100_001, courierPaise: 6_500, feesPaise: 2_785, rtoPaise: 0 },
      [
        { grossPaise: 2, goodsPaise: 30_000 },
        { grossPaise: 1, goodsPaise: 20_000 },
      ],
    )
    expect(shares.reduce((n, s) => n + s.netSalesPaise, 0)).toBe(100_001)
    expect(shares.map((s) => s.netSalesPaise)).toEqual([66_667, 33_334])
    const overhead = 6_500 + 2_785
    expect(shares.reduce((n, s) => n + s.profitPaise, 0)).toBe(100_001 - 50_000 - overhead)
  })
})

describe('profit cost settings', () => {
  it('round-trips through store.apps and keeps every other entry', () => {
    const apps = {
      installed: ['gst-invoices'],
      settings: { core: { tax: { composition: true } }, emi: { on: true } },
    }
    const costs = { gatewayFees: { razorpay: { percentBps: 200, fixedPaise: 0 } }, codFee: null }
    const next = withProfitCosts(apps, costs)
    expect(parseProfitCosts(next)).toEqual(costs)
    expect(next.installed).toEqual(['gst-invoices'])
    expect(next.settings?.emi).toEqual({ on: true })
    expect((next.settings?.core as { tax?: unknown } | undefined)?.tax).toEqual({
      composition: true,
    })
  })

  it('reads nothing set from a blank or broken blob', () => {
    expect(parseProfitCosts(null)).toEqual(defaultProfitCosts)
    expect(parseProfitCosts({ settings: { core: { profit: { codFee: 'x' } } } })).toEqual(
      defaultProfitCosts,
    )
  })
})
