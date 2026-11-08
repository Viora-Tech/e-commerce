import type { CartView } from '@commerce/core'
import { defaultCheckoutSettings } from '@commerce/core/checkout-settings'
import { describe, expect, it } from 'vitest'
import type { CheckoutMethod } from '@/lib/payments'
import {
  checkoutTotals,
  methodView,
  offeredMethods,
  processorNames,
  recommendedMethodId,
  storeCreditOffered,
  takesUpi,
  trustMethodNames,
} from './checkout-preview'

const line = (over: Partial<CartView['lines'][number]> = {}): CartView['lines'][number] => ({
  id: 'l1',
  variantId: 'v1',
  productHandle: 'mouse',
  productTitle: 'Mouse',
  variantTitle: 'Black',
  quantity: 1,
  unitPricePaise: 499_900,
  linePaise: 499_900,
  available: 10,
  imageUrl: null,
  giftCard: false,
  preorder: false,
  ...over,
})
const cart = (lines = [line()]): CartView => ({
  id: 'c',
  status: 'open',
  lines,
  itemCount: lines.length,
  subtotalPaise: lines.reduce((s, l) => s + l.linePaise, 0),
  discountCode: null,
})

const cod = { id: 'cod', label: 'Cash on delivery' }
const decentro = { id: 'decentro', label: 'UPI (Decentro)' }
const razorpay = { id: 'razorpay', label: 'Razorpay', methods: ['card', 'upi'] as const }
const manual = { id: 'manual', label: 'UPI or bank transfer to the shop' }

describe('offeredMethods', () => {
  it('puts UPI first and cash on delivery last, whatever the saved order', () => {
    const ids = offeredMethods(cart(), [
      cod,
      manual,
      { ...razorpay, methods: [...razorpay.methods] },
      decentro,
    ]).map((m) => m.id)
    expect(ids).toEqual(['decentro', 'razorpay', 'manual', 'cod'])
  })

  it('never offers cash on delivery for a basket of gift cards', () => {
    const ids = offeredMethods(cart([line({ giftCard: true })]), [decentro, cod]).map((m) => m.id)
    expect(ids).toEqual(['decentro'])
  })
})

describe('method names', () => {
  it('titles a gateway by its brand, with what it takes as the hint', () => {
    expect(methodView(decentro).title).toBe('UPI')
    expect(methodView(cod).title).toBe('Cash on delivery')
    const view = methodView({ ...razorpay, methods: [...razorpay.methods] })
    expect(view.title).toBe('Razorpay')
    expect(view.hint).toBe('Cards · UPI')
    expect(methodView({ id: 'cashfree', label: 'Cashfree PG' }).title).toBe('Cashfree')
    expect(methodView({ id: 'cashfree', label: 'Cashfree PG' }).hint).toBe('UPI, cards and more')
    expect(takesUpi({ id: 'cashfree', label: 'Cashfree', methods: ['card'] })).toBe(false)
    expect(trustMethodNames([decentro, cod])).toEqual(['UPI', 'Cash on delivery'])
  })

  it('names the gateways that process the money, once each, and nothing else', () => {
    const cashfree = { id: 'cashfree', label: 'Cashfree' }
    expect(
      processorNames([
        decentro,
        { ...razorpay, methods: [...razorpay.methods] },
        cashfree,
        cod,
        manual,
      ]),
    ).toEqual(['Razorpay', 'Cashfree'])
    expect(processorNames([decentro, cod])).toEqual([])
  })
})

describe('checkoutTotals', () => {
  const base = {
    cart: cart(),
    methods: [decentro, cod],
    settings: defaultCheckoutSettings,
    discountPaise: 0,
    shipping: null,
    rate: undefined,
    giftCards: [],
    picked: 'decentro',
    pincode: '110001',
    laterPaise: 0,
  }

  it('charges the goods when nothing else applies', () => {
    const t = checkoutTotals(base)
    expect(t.totalPaise).toBe(499_900)
    expect(t.payNowPaise).toBe(499_900)
    expect(t.codBlocked).toBe(false)
  })

  it('takes a pre-order balance off what is paid today', () => {
    expect(checkoutTotals({ ...base, laterPaise: 300_000 }).payNowPaise).toBe(199_900)
  })

  it('moves a blocked cash on delivery pick to the first online way to pay', () => {
    const settings = {
      ...defaultCheckoutSettings,
      cod: { ...defaultCheckoutSettings.cod, maxOrderPaise: 100_000 },
    }
    const t = checkoutTotals({ ...base, settings, picked: 'cod' })
    expect(t.codBlocked).toBe(true)
    expect(t.payment).toBe('decentro')
    expect(t.codNote).toContain('₹1,000')
  })

  it('hides a way to pay a payment rule hides, and moves the pick off it (#150)', () => {
    const methodRules = [
      {
        id: 'r1',
        name: 'No COD in 110001',
        enabled: true,
        methods: ['cod'],
        match: 'any' as const,
        totalAbovePaise: null,
        totalBelowPaise: null,
        pincodes: ['110001'],
        productIds: [],
      },
    ]
    const t = checkoutTotals({ ...base, methodRules, picked: 'cod' })
    expect(t.offered.map((m) => m.id)).toEqual(['decentro'])
    expect(t.payment).toBe('decentro')
    const elsewhere = checkoutTotals({ ...base, methodRules, pincode: '560001', picked: 'cod' })
    expect(elsewhere.offered.map((m) => m.id)).toContain('cod')
    expect(elsewhere.payment).toBe('cod')
  })

  it('treats an order covered by gift cards as paid', () => {
    const t = checkoutTotals({
      ...base,
      giftCards: [{ code: 'G', lastCharacters: 'ABCD', balancePaise: 600_000 }],
    })
    expect(t.coveredByCards).toBe(true)
    expect(t.payNowPaise).toBe(0)
  })
})

describe('checkoutTotals with store credit', () => {
  const base = {
    cart: cart(),
    methods: [decentro, cod],
    settings: defaultCheckoutSettings,
    discountPaise: 0,
    shipping: null,
    rate: undefined,
    giftCards: [],
    picked: 'cod',
    pincode: '110001',
    laterPaise: 0,
  }

  it('pays part of the order and leaves the rest to an online way to pay', () => {
    const t = checkoutTotals({ ...base, storeCreditPaise: 100_000 })
    expect(t.storeCreditUsedPaise).toBe(100_000)
    expect(t.payNowPaise).toBe(399_900)
    // A payment, not a discount: the total stays.
    expect(t.totalPaise).toBe(499_900)
    expect(t.coveredByCards).toBe(false)
    // Cash on delivery cannot collect what store credit leaves.
    expect(t.codBlocked).toBe(true)
    expect(t.payment).toBe('decentro')
    expect(t.codNote).toBe('Not available with store credit for part of the order')
  })

  it('covers the whole order, never more than is due', () => {
    const t = checkoutTotals({ ...base, picked: 'decentro', storeCreditPaise: 900_000 })
    expect(t.storeCreditUsedPaise).toBe(499_900)
    expect(t.payNowPaise).toBe(0)
    expect(t.coveredByCards).toBe(true)
    expect(t.codBlocked).toBe(false)
  })

  it('spends after gift cards and leaves a pre-order balance for later', () => {
    const t = checkoutTotals({
      ...base,
      picked: 'decentro',
      giftCards: [{ code: 'G', lastCharacters: 'ABCD', balancePaise: 99_900 }],
      laterPaise: 300_000,
      storeCreditPaise: 500_000,
    })
    expect(t.storeCreditUsedPaise).toBe(100_000)
    expect(t.payNowPaise).toBe(0)
  })

  it('is never used on a basket of gift cards', () => {
    const t = checkoutTotals({
      ...base,
      picked: 'decentro',
      cart: cart([line({ giftCard: true })]),
      storeCreditPaise: 900_000,
    })
    expect(t.storeCreditUsedPaise).toBe(0)
  })

  it('shows a guest nothing, whatever balance was passed', () => {
    expect(storeCreditOffered(false, 100_000)).toBe(0)
    expect(storeCreditOffered(true, 100_000)).toBe(100_000)
    expect(storeCreditOffered(true, -5)).toBe(0)
    const t = checkoutTotals({ ...base, storeCreditPaise: storeCreditOffered(false, 100_000) })
    expect(t.storeCreditUsedPaise).toBe(0)
    expect(t.payNowPaise).toBe(499_900)
  })
})

describe('checkoutTotals with the Delivery options app', () => {
  const base = {
    cart: cart(),
    methods: [decentro, cod],
    settings: defaultCheckoutSettings,
    discountPaise: 0,
    shipping: null,
    giftCards: [],
    pincode: '110001',
    laterPaise: 0,
  }
  const card = (over: Record<string, unknown> = {}) => ({
    id: 'opt',
    name: 'Standard · DTDC',
    pricePaise: 6000,
    dateRange: null,
    codSurchargePaise: null,
    arrives: null,
    fastest: false,
    delivery: {
      codAllowed: true,
      codPricePaise: 9000,
      codCarrier: 'Delhivery',
      listPricePaise: 6000,
      choices: [],
      optionName: 'Standard',
      ...over,
    },
  })

  it('Express is prepaid only: cash on delivery is greyed out with the reason', () => {
    const rate = card({ codAllowed: false, codPricePaise: null, optionName: 'Express' })
    const t = checkoutTotals({ ...base, rate, picked: 'cod' })
    expect(t.codBlocked).toBe(true)
    expect(t.payment).toBe('decentro')
    expect(t.codNote).toBe('Not available with Express delivery')
  })

  it("paying on delivery charges Standard's COD route and says so", () => {
    const t = checkoutTotals({ ...base, rate: card(), picked: 'cod' })
    expect(t.codBlocked).toBe(false)
    expect(t.totalPaise).toBe(499_900 + 9000)
    expect(t.codNote).toBe('Cash on delivery: +₹30, ships with Delhivery')
    expect(checkoutTotals({ ...base, rate: card(), picked: 'decentro' }).totalPaise).toBe(
      499_900 + 6000,
    )
  })
})

describe('recommendedMethodId', () => {
  const method = (id: string) => ({ id }) as CheckoutMethod

  it('uses the store choice when it is on offer', () => {
    expect(recommendedMethodId([method('razorpay'), method('manual')], 'manual')).toBe('manual')
  })

  it('falls back to the first way to pay', () => {
    expect(recommendedMethodId([method('razorpay'), method('manual')], '')).toBe('razorpay')
    expect(recommendedMethodId([method('razorpay'), method('manual')], 'cashfree')).toBe('razorpay')
  })

  it('never picks cash on delivery by itself, and needs a choice to make', () => {
    expect(recommendedMethodId([method('cod'), method('manual')], '')).toBeNull()
    expect(recommendedMethodId([method('manual')], 'manual')).toBeNull()
  })
})
