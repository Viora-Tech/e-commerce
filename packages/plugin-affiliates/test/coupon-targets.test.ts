import { evaluateDiscount } from '@commerce/core'
import { createDb, discount, product, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate } from '../src/affiliates'
import { createProgram, defaultProgram, saveProgram, setAffiliateProgram } from '../src/programs'
import {
  type AffiliateSettings,
  type CouponRules,
  couponDiscountFields,
  couponOffer,
  defaultAffiliateSettings,
  defaultProgramRules,
  type ProgramRules,
  parseProgramRules,
} from '../src/settings'

/*
 * An affiliate's code on chosen products or collections (round 2, item 15): the program's
 * coupon rules turn into the discount engine's own product / collection targeting, codes made
 * for affiliates carry it, a change reaches codes already made, and codes from before keep
 * covering the whole order.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }
const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const MAT = '11111111-1111-4111-8111-111111111111'
const PAD = '22222222-2222-4222-8222-222222222222'
const DESKS = '33333333-3333-4333-8333-333333333333'

const coupon = (over: Partial<CouponRules>): CouponRules => ({
  enabled: true,
  bp: 1000,
  appliesTo: 'all',
  targets: [],
  ...over,
})

const perProduct = coupon({
  appliesTo: 'products',
  targets: [
    { target: 'product', id: MAT, label: '', bp: 1500 },
    { target: 'product', id: PAD, label: '', bp: 500 },
    // A collection row left from an earlier choice: kept, but not part of a products code.
    { target: 'collection', id: DESKS, label: '', bp: 2000 },
  ],
})

describe('coupon targeting (pure)', () => {
  it('a stored v1 coupon reads as the whole order', () => {
    const rules = parseProgramRules({ coupon: { enabled: true, bp: 1200 } })
    expect(rules.coupon).toEqual({ enabled: true, bp: 1200, appliesTo: 'all', targets: [] })
    expect(couponDiscountFields(rules.coupon)).toEqual({
      type: 'order',
      method: 'percent',
      value: 1200,
      appliesTo: 'all',
      appliesToIds: [],
      productValues: null,
    })
    expect(couponOffer(rules.coupon)).toEqual({ percent: 12, selected: false })
  })

  it('products: each its own percent, through the engine’s per-product amounts', () => {
    expect(couponDiscountFields(perProduct)).toEqual({
      type: 'products',
      method: 'percent',
      value: 1500,
      appliesTo: 'products',
      appliesToIds: [MAT, PAD],
      productValues: { [MAT]: 1500, [PAD]: 500 },
    })
    expect(couponOffer(perProduct)).toEqual({ percent: 15, selected: true })
  })

  it('collections: one percent on their products', () => {
    const c = coupon({
      appliesTo: 'collections',
      bp: 800,
      targets: [{ target: 'collection', id: DESKS, label: '', bp: 1000 }],
    })
    expect(couponDiscountFields(c)).toMatchObject({
      type: 'products',
      value: 800,
      appliesTo: 'collections',
      appliesToIds: [DESKS],
      productValues: null,
    })
    expect(couponOffer(c)).toEqual({ percent: 8, selected: true })
  })

  it('a narrowed code with nothing picked covers nothing, and offers nothing', () => {
    const empty = coupon({ appliesTo: 'products' })
    expect(couponDiscountFields(empty)).toMatchObject({ appliesTo: 'products', appliesToIds: [] })
    expect(couponOffer(empty)).toBeNull()
    expect(couponOffer(coupon({ enabled: false }))).toBeNull()
  })
})

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, apps: { installed: ['affiliates'], settings: { affiliates: {} } } })
    .returning()
  if (!s) throw new Error('seed')
  await owner.insert(product).values([
    { id: MAT, storeId: s.id, handle: 'mat', title: 'Mat' },
    { id: PAD, storeId: s.id, handle: 'pad', title: 'Pad' },
  ])
  return s.id
}

const join = (storeId: string, programId?: string) =>
  inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      {
        customerId: null,
        email: `a${Math.random().toString(36).slice(2)}@ok.com`,
        phone: null,
        name: 'Asha',
        social: '',
        message: '',
        programId,
      },
      settings,
      SECRET,
    ),
  )

const discountOf = async (id: string | null) => {
  const [d] = await owner
    .select()
    .from(discount)
    .where(eq(discount.id, id ?? ''))
  if (!d) throw new Error('no discount')
  return d
}

const rulesWith = (over: Partial<ProgramRules>): ProgramRules => ({
  ...defaultProgramRules,
  ...over,
})

describe('coupon targeting (codes)', () => {
  it('a code made for an affiliate carries the program’s per-product amounts, and the engine prices them', async () => {
    const storeId = await seed()
    const p = await inStore(storeId, (tx) =>
      createProgram(tx, storeId, { name: 'Gear', rules: rulesWith({ coupon: perProduct }) }),
    )
    const a = await join(storeId, p.id)
    const d = await discountOf(a.discountId)
    expect(d).toMatchObject({
      type: 'products',
      method: 'percent',
      appliesTo: 'products',
      appliesToIds: [MAT, PAD],
      productValues: { [MAT]: 1500, [PAD]: 500 },
      code: a.couponCode,
    })
    // ₹1,000 mat at 15%, ₹400 pad at 5%, a ₹600 product the code does not cover.
    const out = evaluateDiscount(
      {
        lines: [
          { productId: MAT, quantity: 1, unitPricePaise: 1000_00 },
          { productId: PAD, quantity: 2, unitPricePaise: 400_00 },
          {
            productId: '44444444-4444-4444-8444-444444444444',
            quantity: 1,
            unitPricePaise: 600_00,
          },
        ],
      },
      { ...d, combos: d.combos ?? null },
    )
    expect(out.ok && out.amountPaise).toBe(150_00 + 2 * 20_00)
  })

  it('a code from before keeps the whole order; changing the program moves existing codes to the new targeting', async () => {
    const storeId = await seed()
    const def = await inStore(storeId, (tx) => defaultProgram(tx, storeId))
    const a = await join(storeId)
    expect(await discountOf(a.discountId)).toMatchObject({
      type: 'order',
      value: 1000,
      appliesTo: 'all',
      appliesToIds: [],
    })
    const collections = coupon({
      appliesTo: 'collections',
      bp: 700,
      targets: [{ target: 'collection', id: DESKS, label: '', bp: 1000 }],
    })
    await inStore(storeId, (tx) =>
      saveProgram(tx, storeId, def.id, {
        name: def.name,
        rules: { ...def.rules, coupon: collections },
      }),
    )
    expect(await discountOf(a.discountId)).toMatchObject({
      type: 'products',
      value: 700,
      appliesTo: 'collections',
      appliesToIds: [DESKS],
      productValues: null,
    })
    // Moving to a whole-order program puts the code back on the whole order.
    const flat = await inStore(storeId, (tx) =>
      createProgram(tx, storeId, {
        name: 'Flat',
        rules: rulesWith({ coupon: coupon({ bp: 1200 }) }),
      }),
    )
    await inStore(storeId, (tx) => setAffiliateProgram(tx, storeId, a.id, flat.id))
    expect(await discountOf(a.discountId)).toMatchObject({
      type: 'order',
      value: 1200,
      appliesTo: 'all',
      appliesToIds: [],
      productValues: null,
    })
  })

  it('refuses a narrowed code with nothing picked', async () => {
    const storeId = await seed()
    await expect(
      inStore(storeId, (tx) =>
        createProgram(tx, storeId, {
          name: 'Empty',
          rules: rulesWith({ coupon: coupon({ appliesTo: 'products' }) }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'COUPON_TARGETS' })
  })
})
