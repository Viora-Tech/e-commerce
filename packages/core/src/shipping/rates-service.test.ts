import {
  cart,
  cartLine,
  createDb,
  discount,
  inventoryLevel,
  order,
  product,
  shippingRate,
  shippingZone,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ShippingRateUnavailable, ShippingUnavailable } from '../errors'
import { placeOrder } from '../order/place-order'
import { FakePaymentProvider } from '../providers/payment'
import { computeGst } from '../tax/gst'
import { quoteCartShipping } from './profiles-service'
import {
  createShippingZone,
  deleteShippingZone,
  listShippingZones,
  storeFreeShippingThreshold,
  updateShippingZone,
} from './rates-service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

type Seed = { storeId: string; cartId: string; variantId: string }

/** A store in Karnataka selling a ₹600 (18% GST) item weighing 300 g, and a cart of `quantity`. */
async function seed(slug: string, quantity = 1): Promise<Seed> {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      gstRatePercent: 18,
      address: { line1: '1 MG Road', city: 'Bengaluru', state: 'KA', pincode: '560001' },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p.id,
      title: 'Default',
      pricePaise: 60_000,
      weightGrams: 300,
    })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  const cartId = await newCart(s.id, v.id, quantity)
  return { storeId: s.id, cartId, variantId: v.id }
}

async function newCart(storeId: string, variantId: string, quantity: number): Promise<string> {
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId, cartId: c.id, variantId, quantity, unitPricePaise: 60_000 })
  return c.id
}

/** A new shopper each time, so repeated orders of the same items are not refused as duplicates. */
let shopper = 0
const checkout = (stateCode: string, pincode: string) => ({
  email: `a${++shopper}@example.com`,
  phone: `99999${String(shopper).padStart(5, '0')}`,
  name: 'Asha',
  address: { line1: '2 Park St', city: 'City', stateCode, pincode },
})

/** "All India": Standard ₹49 free from ₹999; Express ₹149. */
async function allIndia(storeId: string) {
  return withStore(app, storeId, (tx) =>
    createShippingZone(tx, storeId, {
      name: 'All India',
      stateCodes: [],
      pincodeRules: [],
      rates: [
        {
          name: 'Standard',
          condition: 'none',
          minValue: null,
          maxValue: null,
          pricePaise: 4900,
          freeAbovePaise: 99_900,
          codSurchargePaise: null,
          minTransitDays: null,
          maxTransitDays: null,
        },
        {
          name: 'Express',
          condition: 'none',
          minValue: null,
          maxValue: null,
          pricePaise: 14_900,
          freeAbovePaise: null,
          codSurchargePaise: 2900,
          minTransitDays: 1,
          maxTransitDays: 2,
        },
      ],
    }),
  )
}

const place = (s: Seed, opts: { rateId?: string; cod?: boolean; to?: [string, string] } = {}) =>
  withStore(app, s.storeId, (tx) =>
    placeOrder(
      { storeId: s.storeId, tx },
      {
        cartId: s.cartId,
        paymentProvider: new FakePaymentProvider({
          mode: 'capture',
          ...(opts.cod ? { id: 'cod' } : {}),
        }),
        checkout: checkout(...(opts.to ?? ['MH', '400001'])),
        shippingRateId: opts.rateId ?? null,
      },
    ),
  )

const orderOf = async (id: string) => (await owner.select().from(order).where(eq(order.id, id)))[0]

describe('placeOrder with shipping rates', () => {
  it('ships free when the store has no zones, as before', async () => {
    const s = await seed('free')
    const r = await place(s)
    const o = await orderOf(r.orderId)
    expect(o?.shippingPaise).toBe(0)
    expect(o?.shippingRateId).toBeNull()
    expect(o?.totalPaise).toBe(60_000)
  })

  it('charges the cheapest rate by default and snapshots it on the order', async () => {
    const s = await seed('flat')
    const zone = await allIndia(s.storeId)
    const r = await place(s)
    const o = await orderOf(r.orderId)
    const standard = zone.rates.find((x) => x.name === 'Standard')
    expect(o?.shippingPaise).toBe(4900)
    expect(o?.totalPaise).toBe(64_900)
    expect(o?.shippingRateId).toBe(standard?.id)
    expect(o?.shippingRateName).toBe('Standard')
    expect(o?.shipping).toMatchObject({
      rateName: 'Standard',
      zoneName: 'All India',
      listPricePaise: 4900,
      pricePaise: 4900,
    })
  })

  it('charges the rate the shopper picked, and its COD fee instead of the store one', async () => {
    const s = await seed('picked')
    await owner
      .update(store)
      .set({
        payments: {
          enabled: ['cod'],
          adjustments: { cod: { type: 'fixed', value: 5000, label: 'COD fee' } },
        },
      })
      .where(eq(store.id, s.storeId))
    const zone = await allIndia(s.storeId)
    const express = zone.rates.find((x) => x.name === 'Express')
    const r = await place(s, { rateId: express?.id as string, cod: true })
    const o = await orderOf(r.orderId)
    expect(o?.shippingPaise).toBe(14_900)
    // The rate's ₹29 replaces the store's ₹50; never both.
    expect(o?.paymentAdjustmentPaise).toBe(2900)
    expect(o?.paymentAdjustmentLabel).toBe('COD fee')
    expect(o?.totalPaise).toBe(60_000 + 14_900 + 2900)

    // Standard sets no COD fee of its own, so the store's applies.
    const again = { ...s, cartId: await newCart(s.storeId, s.variantId, 1) }
    const r2 = await place(again, { cod: true })
    const o2 = await orderOf(r2.orderId)
    expect(o2?.shippingPaise).toBe(4900)
    expect(o2?.paymentAdjustmentPaise).toBe(5000)
  })

  it('goes free above the threshold', async () => {
    const s = await seed('threshold', 2)
    await allIndia(s.storeId)
    const o = await orderOf((await place(s)).orderId)
    expect(o?.shippingPaise).toBe(0)
    expect(o?.shipping).toMatchObject({ listPricePaise: 4900, pricePaise: 0 })
  })

  it('zeroes the rate for a free-shipping discount', async () => {
    const s = await seed('freeship')
    await allIndia(s.storeId)
    await owner.insert(discount).values({
      storeId: s.storeId,
      title: 'Free delivery',
      kind: 'code',
      code: 'SHIPFREE',
      method: 'free_shipping',
      value: 0,
      appliesTo: 'all',
      status: 'active',
    })
    await owner.update(cart).set({ discountCode: 'SHIPFREE' }).where(eq(cart.id, s.cartId))
    const quote = await withStore(app, s.storeId, (tx) =>
      quoteCartShipping({ storeId: s.storeId, tx }, s.cartId, {
        stateCode: 'MH',
        pincode: '400001',
      }),
    )
    expect(quote.freeShippingDiscount).toBe(true)
    expect(quote.kind === 'rates' && quote.options.every((o) => o.pricePaise === 0)).toBe(true)
    const o = await orderOf((await place(s)).orderId)
    expect(o?.shippingPaise).toBe(0)
    expect(o?.discountLabel).toBe('Free delivery')
  })

  it('extracts GST from shipping at the goods rate, inside the total', async () => {
    const s = await seed('gst')
    await allIndia(s.storeId)
    const inter = await orderOf((await place(s, { to: ['MH', '400001'] })).orderId)
    const expected = computeGst({
      amountPaise: 64_900,
      ratePercent: 18,
      shipToState: 'MH',
      storeState: 'KA',
    })
    expect(inter?.taxPaise).toBe(expected.taxPaise)
    expect(inter?.taxBreakdown).toMatchObject({ igstPaise: expected.taxPaise, interState: true })

    const local = { ...s, cartId: await newCart(s.storeId, s.variantId, 1) }
    const intra = await orderOf((await place(local, { to: ['KA', '560001'] })).orderId)
    expect(intra?.taxBreakdown).toMatchObject({ igstPaise: 0, interState: false })
    expect(intra?.taxPaise).toBe(expected.taxPaise)
  })

  it('refuses an address no zone covers, and a rate that does not apply', async () => {
    const s = await seed('blocked')
    const zone = await withStore(app, s.storeId, (tx) =>
      createShippingZone(tx, s.storeId, {
        name: 'Bengaluru',
        stateCodes: [],
        pincodeRules: [{ pattern: '560*', mode: 'include' }],
        rates: [
          {
            name: 'Light',
            condition: 'weight',
            minValue: 0,
            maxValue: 1000,
            pricePaise: 3000,
            freeAbovePaise: null,
            codSurchargePaise: null,
            minTransitDays: null,
            maxTransitDays: null,
          },
        ],
      }),
    )
    await expect(place(s, { to: ['MH', '400001'] })).rejects.toBeInstanceOf(ShippingUnavailable)
    await expect(
      place(s, { to: ['KA', '560001'], rateId: '0199a000-0000-7000-8000-000000000009' }),
    ).rejects.toBeInstanceOf(ShippingRateUnavailable)
    const o = await orderOf((await place(s, { to: ['KA', '560001'] })).orderId)
    expect(o?.shippingRateId).toBe(zone.rates[0]?.id)
    expect(o?.shippingPaise).toBe(3000)
  })
})

describe('shipping zone service', () => {
  it('updates rates in place, adds and removes them, and keeps stores apart', async () => {
    const a = await seed('store-a')
    const b = await seed('store-b')
    const zone = await allIndia(a.storeId)
    const standard = zone.rates.find((x) => x.name === 'Standard')
    const updated = await withStore(app, a.storeId, (tx) =>
      updateShippingZone(tx, a.storeId, zone.id, {
        name: 'India',
        stateCodes: ['ka', 'KA'].map((x) => x.toUpperCase()),
        pincodeRules: [],
        rates: [
          {
            id: standard?.id,
            name: 'Standard',
            condition: 'none',
            minValue: 5,
            maxValue: 9,
            pricePaise: 5900,
            freeAbovePaise: null,
            codSurchargePaise: null,
            minTransitDays: null,
            maxTransitDays: null,
          },
          {
            name: 'Heavy',
            condition: 'weight',
            minValue: 2000,
            maxValue: null,
            pricePaise: 19_900,
            freeAbovePaise: null,
            codSurchargePaise: 0,
            minTransitDays: null,
            maxTransitDays: null,
          },
        ],
      }),
    )
    expect(updated.name).toBe('India')
    expect(updated.stateCodes).toEqual(['KA'])
    expect(updated.rates.map((r) => r.name)).toEqual(['Standard', 'Heavy'])
    expect(updated.rates[0]?.id).toBe(standard?.id)
    // A flat rate never keeps band bounds.
    expect(updated.rates[0]).toMatchObject({ minValue: null, maxValue: null, pricePaise: 5900 })

    const seenByB = await withStore(app, b.storeId, (tx) => listShippingZones(tx))
    expect(seenByB).toEqual([])
    expect(await withStore(app, b.storeId, (tx) => deleteShippingZone(tx, zone.id))).toBe(false)
    expect(await withStore(app, b.storeId, (tx) => storeFreeShippingThreshold(tx))).toBeNull()

    expect(await withStore(app, a.storeId, (tx) => deleteShippingZone(tx, zone.id))).toBe(true)
    expect(await owner.select().from(shippingRate)).toEqual([])
    expect(await owner.select().from(shippingZone)).toEqual([])
  })

  it('reports the free-shipping threshold for the cart line', async () => {
    const s = await seed('threshold-line')
    await allIndia(s.storeId)
    expect(await withStore(app, s.storeId, (tx) => storeFreeShippingThreshold(tx))).toBe(99_900)
  })
})
