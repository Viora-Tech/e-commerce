/** SOURCE OF TRUTH: order profit maths tests — WHAT: pure profit calculation cases / WHY: guards the money maths */
import { describe, expect, it } from 'vitest'
import {
  allocateProfit,
  computeOrderProfit,
  defaultProfitCosts,
  feeOn,
  methodRateIdOf,
  type ParcelCost,
  type PaymentMethodDetail,
  type ProfitInput,
  type ProfitPayment,
  parseProfitCosts,
  paymentFee,
  STANDARD_METHOD_FEES,
  withProfitCosts,
} from './profit'

/** A captured payment with no fee reported and no method known, unless given. */
const paid = (
  provider: string,
  amountPaise: number,
  over: Partial<ProfitPayment> = {},
): ProfitPayment => ({
  provider,
  amountPaise,
  feePaise: null,
  feeTaxPaise: null,
  method: null,
  ...over,
})

/** A parcel with real costs, unless given. */
const parcel = (over: Partial<ParcelCost> = {}): ParcelCost => ({
  packingPaise: 0,
  packingEstimated: false,
  packingMissing: false,
  courierPaise: 0,
  courierEstimated: false,
  ...over,
})

/**
 * ₹1,180 incl. 18% GST (₹180), one unit that cost ₹500, paid online by Razorpay. The store is
 * GST-registered, so the GST on fees is claimed back and left out.
 */
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
  parcels: [parcel({ courierPaise: 6_500 })],
  payments: [paid('razorpay', 118_000)],
  rtoPaise: 0,
  costs: {
    methodFees: {},
    gatewayFees: { razorpay: { percentBps: 236, fixedPaise: 0 } },
    codFee: null,
    defaultDeliveryPaise: 10_000,
  },
  feeGstClaimable: true,
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
    expect(p.feeSource).toBe('estimated')
    expect(p.flags).toEqual({
      costEstimated: false,
      costMissing: false,
      courierMissing: false,
      courierEstimated: false,
      packingEstimated: false,
      packingMissing: false,
      feeFromRate: true,
      feeMissing: false,
    })
  })

  it('a fee the gateway reported wins over the store rate', () => {
    const p = computeOrderProfit(
      base({ payments: [paid('razorpay', 118_000, { feePaise: 2_000 })] }),
    )
    expect(p.feesPaise).toBe(2_000)
    expect(p.flags.feeFromRate).toBe(false)
    expect(p.feeSource).toBe('actual')
  })

  it('a method with no rate and no reported fee is flagged, not guessed', () => {
    const p = computeOrderProfit(base({ costs: defaultProfitCosts }))
    expect(p.feesPaise).toBe(0)
    expect(p.flags.feeMissing).toBe(true)
    expect(p.feeSource).toBe('estimated')
  })

  it('store credit and direct transfers take no fee', () => {
    const p = computeOrderProfit(
      base({ payments: [paid('gift_card', 18_000), paid('manual', 100_000)] }),
    )
    expect(p.feesPaise).toBe(0)
    expect(p.flags.feeMissing).toBe(false)
    expect(p.feeSource).toBeNull()
  })

  it('cash on delivery pays the courier’s COD fee on the cash collected', () => {
    const p = computeOrderProfit(
      base({
        payments: [paid('cod', 118_000)],
        costs: {
          methodFees: {},
          gatewayFees: {},
          codFee: { percentBps: 200, fixedPaise: 3_000 },
          defaultDeliveryPaise: 10_000,
        },
      }),
    )
    // 2% of ₹1,180 = 2,360 paise + ₹30
    expect(p.feesPaise).toBe(5_360)
  })

  it('a store that cannot claim GST back pays 18% on top of each rate', () => {
    const p = computeOrderProfit(
      base({
        payments: [paid('cod', 118_000)],
        costs: {
          methodFees: {},
          gatewayFees: {},
          codFee: { percentBps: 200, fixedPaise: 3_000 },
          defaultDeliveryPaise: 10_000,
        },
        feeGstClaimable: false,
      }),
    )
    // 5,360 + 18% (964.8 → 965)
    expect(p.feesPaise).toBe(6_325)
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

  it('packing and estimated delivery come off, and an estimate makes the profit a floor', () => {
    const p = computeOrderProfit(
      base({
        parcels: [
          parcel({ packingPaise: 800, courierPaise: 5_000 }),
          parcel({
            packingPaise: 2_500,
            packingEstimated: true,
            courierPaise: 10_000,
            courierEstimated: true,
          }),
        ],
      }),
    )
    expect(p.packingPaise).toBe(3_300)
    expect(p.courierPaise).toBe(15_000)
    expect(p.profitPaise).toBe(100_000 - 50_000 - 3_300 - 15_000 - 2_785)
    expect(p.flags).toMatchObject({
      courierEstimated: true,
      packingEstimated: true,
      packingMissing: false,
    })
    expect(p.estimated).toBe(true)
  })

  it('a box with no cost counts nothing and is flagged; real costs are not estimated', () => {
    const p = computeOrderProfit(
      base({ parcels: [parcel({ packingMissing: true, courierPaise: 6_500 })], payments: [] }),
    )
    expect(p.packingPaise).toBe(0)
    expect(p.flags.packingMissing).toBe(true)
    expect(p.estimated).toBe(false)
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
      {
        netSalesPaise: 100_001,
        packingPaise: 800,
        courierPaise: 6_500,
        feesPaise: 2_785,
        rtoPaise: 0,
      },
      [
        { grossPaise: 2, goodsPaise: 30_000 },
        { grossPaise: 1, goodsPaise: 20_000 },
      ],
    )
    expect(shares.reduce((n, s) => n + s.netSalesPaise, 0)).toBe(100_001)
    expect(shares.map((s) => s.netSalesPaise)).toEqual([66_667, 33_334])
    const overhead = 800 + 6_500 + 2_785
    expect(shares.reduce((n, s) => n + s.profitPaise, 0)).toBe(100_001 - 50_000 - overhead)
  })
})

describe('profit cost settings', () => {
  it('round-trips through store.apps and keeps every other entry', () => {
    const apps = {
      installed: ['gst-invoices'],
      settings: { core: { tax: { composition: true } }, emi: { on: true } },
    }
    const costs = {
      methodFees: { upi: { percentBps: 0, fixedPaise: 0 } },
      gatewayFees: { razorpay: { percentBps: 200, fixedPaise: 0 } },
      codFee: null,
      defaultDeliveryPaise: 9_000,
    }
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

  it('starts from Razorpay’s standard rates until the store saves its own', () => {
    expect(defaultProfitCosts.methodFees).toEqual(STANDARD_METHOD_FEES)
    // A store that saved before rates by method existed gets them too.
    const old = { settings: { core: { profit: { gatewayFees: {}, codFee: null } } } }
    expect(parseProfitCosts(old).methodFees).toEqual(STANDARD_METHOD_FEES)
    // Rates the merchant cleared stay cleared.
    const cleared = { settings: { core: { profit: { methodFees: {} } } } }
    expect(parseProfitCosts(cleared).methodFees).toEqual({})
  })
})

const card = (over: Partial<PaymentMethodDetail> = {}): PaymentMethodDetail => ({
  kind: 'card',
  ...over,
})

describe('methodRateIdOf', () => {
  it('prices each way of paying, most specific first', () => {
    expect(methodRateIdOf({ kind: 'upi' })).toBe('upi')
    expect(methodRateIdOf(card({ cardType: 'debit', network: 'rupay' }))).toBe('rupay_debit')
    expect(methodRateIdOf(card({ cardType: 'debit', network: 'visa' }))).toBe('debit_card')
    expect(methodRateIdOf(card({ cardType: 'prepaid', network: 'rupay' }))).toBe('debit_card')
    expect(methodRateIdOf(card({ cardType: 'credit', network: 'rupay' }))).toBe('credit_card')
    expect(methodRateIdOf(card({ cardType: 'credit', network: 'amex' }))).toBe('corporate_card')
    expect(methodRateIdOf(card({ cardType: 'credit', network: 'diners' }))).toBe('corporate_card')
    expect(methodRateIdOf(card({ cardType: 'credit', corporate: true }))).toBe('corporate_card')
    expect(methodRateIdOf(card({ cardType: 'debit', network: 'rupay', international: true }))).toBe(
      'international_card',
    )
    expect(methodRateIdOf({ kind: 'netbanking', provider: 'HDFC' })).toBe('netbanking')
    expect(methodRateIdOf({ kind: 'wallet' })).toBe('wallet')
    expect(methodRateIdOf({ kind: 'emi', cardType: 'credit' })).toBe('emi')
    expect(methodRateIdOf({ kind: 'cardless_emi' })).toBe('emi')
    expect(methodRateIdOf({ kind: 'paylater' })).toBe('pay_later')
  })

  it('does not guess when the gateway did not say enough', () => {
    expect(methodRateIdOf(null)).toBeNull()
    expect(methodRateIdOf(card())).toBeNull()
    expect(methodRateIdOf({ kind: 'other' })).toBeNull()
  })
})

describe('paymentFee', () => {
  const costs = {
    methodFees: {
      upi: { percentBps: 0, fixedPaise: 0 },
      credit_card: { percentBps: 200, fixedPaise: 0 },
      corporate_card: { percentBps: 300, fixedPaise: 0 },
    },
    gatewayFees: {
      razorpay: { percentBps: 250, fixedPaise: 0 },
      decentro: { percentBps: 50, fixedPaise: 0 },
    },
    codFee: null,
    defaultDeliveryPaise: 10_000,
  }

  it('uses the gateway’s fee first, without the GST inside it when it can be claimed', () => {
    const p = paid('razorpay', 100_000, {
      feePaise: 2_360,
      feeTaxPaise: 360,
      method: card({ cardType: 'credit' }),
    })
    expect(paymentFee(p, costs, true)).toEqual({ paise: 2_000, source: 'actual' })
    expect(paymentFee(p, costs, false)).toEqual({ paise: 2_360, source: 'actual' })
  })

  it('an actual fee with no GST split counts in full', () => {
    const p = paid('razorpay', 100_000, { feePaise: 1_000 })
    expect(paymentFee(p, costs, true)).toEqual({ paise: 1_000, source: 'actual' })
  })

  it('then the rate for how the shopper paid, adding 18% GST unless claimed back', () => {
    const p = paid('razorpay', 100_000, { method: card({ cardType: 'credit', network: 'visa' }) })
    // 2% of ₹1,000 = ₹20, + 18% GST = ₹23.60
    expect(paymentFee(p, costs, true)).toEqual({ paise: 2_000, source: 'rate' })
    expect(paymentFee(p, costs, false)).toEqual({ paise: 2_360, source: 'rate' })
    const amex = paid('cashfree', 100_000, {
      method: card({ cardType: 'credit', network: 'amex' }),
    })
    expect(paymentFee(amex, costs, true).paise).toBe(3_000)
    const upi = paid('razorpay_upi', 100_000, { method: { kind: 'upi' } })
    expect(paymentFee(upi, costs, false)).toEqual({ paise: 0, source: 'rate' })
  })

  it('then the gateway’s rate: method unknown, method not priced, or another gateway', () => {
    expect(paymentFee(paid('razorpay', 100_000), costs, true).paise).toBe(2_500)
    const wallet = paid('razorpay', 100_000, { method: { kind: 'wallet' } })
    expect(paymentFee(wallet, costs, true).paise).toBe(2_500)
    // Decentro is priced by its own rate even though it records UPI.
    const decentro = paid('decentro', 100_000, { method: { kind: 'upi' } })
    expect(paymentFee(decentro, costs, true).paise).toBe(500)
  })

  it('flags a payment nothing prices, and skips fee-free ones', () => {
    expect(paymentFee(paid('cashfree', 100_000), costs, true)).toEqual({
      paise: 0,
      source: 'missing',
    })
    expect(paymentFee(paid('gift_card', 100_000), costs, true).source).toBe('none')
    expect(paymentFee(paid('razorpay', 0), costs, true).source).toBe('none')
  })

  it('the order shows mixed when some fees are actual and some estimated', () => {
    const p = computeOrderProfit(
      base({
        costs,
        payments: [
          paid('razorpay', 50_000, { feePaise: 1_180, feeTaxPaise: 180 }),
          paid('razorpay', 68_000, { method: card({ cardType: 'credit' }) }),
        ],
      }),
    )
    expect(p.feesPaise).toBe(1_000 + 1_360)
    expect(p.feeSource).toBe('mixed')
  })
})
