/** SOURCE OF TRUTH: Shopify discount type tests — buy X get Y, minimum quantity, customer eligibility, free shipping limits and combinations */
import { describe, expect, it } from 'vitest'
import { bxgyAmount } from './bxgy'
import { combinable, combineDiscounts } from './combine'
import {
  applyDiscount,
  type DiscountCart,
  type DiscountContext,
  type DiscountOutcome,
  type DiscountRule,
  discountType,
  evaluateDiscount,
} from './evaluate'
import { DiscountInputSchema } from './schemas'

type Applied = Extract<DiscountOutcome, { ok: true }>

const rule = (over: Partial<DiscountRule>): DiscountRule => ({
  id: 'd1',
  title: 'Offer',
  kind: 'automatic',
  code: null,
  method: 'percent',
  value: 1000,
  minSubtotalPaise: null,
  appliesTo: 'all',
  appliesToIds: [],
  usageLimit: null,
  usagePerCustomer: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  status: 'active',
  ...over,
})

const P1 = '00000000-0000-4000-8000-000000000001'
const P2 = '00000000-0000-4000-8000-000000000002'
const SEG = '00000000-0000-4000-8000-0000000000a1'
const CUST = '00000000-0000-4000-8000-0000000000c1'

const cart: DiscountCart = {
  lines: [
    { productId: P1, quantity: 3, unitPricePaise: 100_000 },
    { productId: P2, quantity: 1, unitPricePaise: 40_000 },
  ],
  shippingPaise: 9_900,
}
const now = new Date('2026-10-23T10:00:00Z')

const bogo = {
  buys: {
    kind: 'quantity' as const,
    quantity: 2,
    amountPaise: 0,
    appliesTo: 'products' as const,
    ids: [P1],
  },
  gets: { quantity: 1, appliesTo: 'products' as const, ids: [P1, P2] },
  maxUsesPerOrder: null,
}

describe('discountType', () => {
  it('derives a type for rows written before types existed', () => {
    expect(discountType({ method: 'free_shipping', appliesTo: 'all' })).toBe('shipping')
    expect(discountType({ method: 'percent', appliesTo: 'products' })).toBe('products')
    expect(discountType({ method: 'fixed', appliesTo: 'all' })).toBe('order')
    expect(discountType({ type: 'bxgy', method: 'percent', appliesTo: 'all' })).toBe('bxgy')
  })
})

describe('buy X get Y', () => {
  it('buy 2 get 1 free gives the cheapest qualifying item', () => {
    // Three P1 at ₹1,000 and one P2 at ₹400: P2 is free, two P1 pay for it.
    expect(bxgyAmount(cart.lines, 'percent', 10_000, bogo)).toBe(40_000)
  })

  it('runs as many rounds as the cart allows, up to the per-order cap', () => {
    const lines = [{ productId: P1, quantity: 6, unitPricePaise: 100_000 }]
    expect(bxgyAmount(lines, 'percent', 10_000, bogo)).toBe(200_000)
    expect(bxgyAmount(lines, 'percent', 10_000, { ...bogo, maxUsesPerOrder: 1 })).toBe(100_000)
  })

  it('gets a percentage or an amount off instead of free', () => {
    expect(bxgyAmount(cart.lines, 'percent', 5_000, bogo)).toBe(20_000)
    expect(bxgyAmount(cart.lines, 'fixed', 10_000, bogo)).toBe(10_000)
  })

  it('an amount spent earns a round per multiple', () => {
    const spend = { ...bogo, buys: { ...bogo.buys, kind: 'amount' as const, amountPaise: 150_000 } }
    // ₹3,000 on P1 earns two rounds: P2 and one P1 free.
    expect(bxgyAmount(cart.lines, 'percent', 10_000, spend)).toBe(140_000)
  })

  it('is not applicable when the cart falls short', () => {
    const d = rule({ type: 'bxgy', value: 10_000, bxgy: bogo })
    const short = { lines: [{ productId: P1, quantity: 2, unitPricePaise: 100_000 }] }
    expect(evaluateDiscount(short, d, { now })).toMatchObject({
      ok: false,
      reason: 'no_eligible_items',
    })
    expect(evaluateDiscount(cart, d, { now })).toMatchObject({ ok: true, amountPaise: 40_000 })
  })
})

describe('minimum quantity', () => {
  it('counts items, eligible items only for a products discount', () => {
    const order = rule({ minQuantity: 4 })
    expect(evaluateDiscount(cart, order, { now }).ok).toBe(true)
    const products = rule({
      type: 'products',
      appliesTo: 'products',
      appliesToIds: [P2],
      minQuantity: 2,
    })
    expect(evaluateDiscount(cart, products, { now })).toMatchObject({
      ok: false,
      reason: 'min_quantity',
    })
  })
})

describe('customer eligibility', () => {
  const seg = rule({ customerEligibility: 'segments', eligibleIds: [SEG] })
  const people = rule({ customerEligibility: 'customers', eligibleIds: [CUST] })

  it('waits for checkout when the shopper is unknown', () => {
    expect(evaluateDiscount(cart, seg, { now }).ok).toBe(true)
  })

  it('needs the shopper in a picked segment or list', () => {
    const outsider: DiscountContext = { now, customer: { id: null, segmentIds: [] } }
    expect(evaluateDiscount(cart, seg, outsider)).toMatchObject({ reason: 'customer_not_eligible' })
    expect(evaluateDiscount(cart, seg, { now, customer: { id: CUST, segmentIds: [SEG] } }).ok).toBe(
      true,
    )
    expect(evaluateDiscount(cart, people, outsider).ok).toBe(false)
    expect(evaluateDiscount(cart, people, { now, customer: { id: CUST, segmentIds: [] } }).ok).toBe(
      true,
    )
  })
})

describe('free shipping limits', () => {
  const ship = rule({
    type: 'shipping',
    method: 'free_shipping',
    value: 0,
    shippingStates: ['KA', 'MH'],
    maxShippingPaise: 10_000,
  })

  it('only ships free to the picked states once the address is known', () => {
    expect(evaluateDiscount(cart, ship, { now, stateCode: 'DL' })).toMatchObject({
      reason: 'region',
    })
    expect(evaluateDiscount(cart, ship, { now, stateCode: 'KA' }).ok).toBe(true)
    expect(evaluateDiscount(cart, ship, { now }).ok).toBe(true)
  })

  it('charges rates over the cap in full', () => {
    const r = evaluateDiscount(cart, ship, { now }) as Applied
    expect(applyDiscount(340_000, 9_900, r).shippingPaise).toBe(0)
    expect(applyDiscount(340_000, 25_000, r).shippingPaise).toBe(25_000)
  })
})

describe('combinations', () => {
  const productOff = rule({
    id: 'prod',
    type: 'products',
    appliesTo: 'products',
    appliesToIds: [P1],
    combinesWith: { products: false, order: true, shipping: true },
  })
  const orderOff = rule({
    id: 'order',
    combinesWith: { products: true, order: false, shipping: true },
  })
  const freeShip = rule({
    id: 'ship',
    type: 'shipping',
    method: 'free_shipping',
    value: 0,
    combinesWith: { products: true, order: true, shipping: false },
  })
  const ok = (d: DiscountRule) => evaluateDiscount(cart, d, { now }) as Applied
  const contexts = new Map<string, DiscountContext>([
    ['prod', { now }],
    ['order', { now }],
    ['ship', { now }],
  ])

  it('needs both sides to allow the other class', () => {
    expect(combinable(productOff, orderOff)).toBe(true)
    expect(combinable(productOff, { ...orderOff, combinesWith: undefined })).toBe(false)
  })

  it('stacks product, order and shipping discounts, the order one on what is left', () => {
    const r = combineDiscounts(cart, null, [ok(orderOff), ok(productOff), ok(freeShip)], contexts)
    // 10% of ₹3,000 on P1 = ₹300; then 10% of the remaining ₹3,100 = ₹310.
    expect(r?.parts?.map((p) => p.discount.id).sort()).toEqual(['order', 'prod', 'ship'])
    expect(r).toMatchObject({ amountPaise: 61_000, freeShipping: true })
  })

  it('keeps the shopper code and drops what will not stack with it', () => {
    const code = { ...ok(orderOff), discount: { ...orderOff, id: 'code', combinesWith: undefined } }
    const r = combineDiscounts(cart, code, [ok(productOff), ok(freeShip)], contexts)
    expect(r?.discount.id).toBe('code')
    expect(r?.parts).toBeUndefined()
  })

  it('without combinations picks the single most valuable discount, as before', () => {
    const plain = [
      ok({ ...orderOff, combinesWith: undefined }),
      ok({ ...productOff, combinesWith: undefined }),
    ]
    expect(combineDiscounts(cart, null, plain, contexts)?.amountPaise).toBe(34_000)
  })
})

describe('DiscountInputSchema types', () => {
  const base = { title: 'X', kind: 'automatic' as const, method: 'percent' as const, value: 1000 }

  it('keeps older inputs valid with the new defaults', () => {
    const r = DiscountInputSchema.parse(base)
    expect(r).toMatchObject({ customerEligibility: 'all', eligibleIds: [], shippingStates: [] })
    expect(r.combinesWith).toEqual({ products: false, order: false, shipping: false })
  })

  it('checks each type', () => {
    expect(DiscountInputSchema.safeParse({ ...base, type: 'shipping' }).success).toBe(false)
    expect(DiscountInputSchema.safeParse({ ...base, type: 'bxgy' }).success).toBe(false)
    expect(DiscountInputSchema.safeParse({ ...base, type: 'bxgy', bxgy: bogo }).success).toBe(true)
    expect(
      DiscountInputSchema.safeParse({ ...base, customerEligibility: 'segments' }).success,
    ).toBe(false)
    expect(
      DiscountInputSchema.safeParse({ ...base, minSubtotalPaise: 100, minQuantity: 2 }).success,
    ).toBe(false)
  })
})
