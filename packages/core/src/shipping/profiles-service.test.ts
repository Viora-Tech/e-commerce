import { readFileSync } from 'node:fs'
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  product,
  shippingProfile,
  shippingProfileProduct,
  shippingZone,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrder } from '../order/place-order'
import { FakePaymentProvider } from '../providers/payment'
import {
  cartShippingHintFor,
  createShippingProfile,
  deleteShippingProfile,
  getShippingProfile,
  listShippingProfiles,
  quoteCartShipping,
  updateShippingProfile,
} from './profiles-service'
import type { ShippingRateWrite } from './rates'
import { createShippingZone, listShippingZones } from './rates-service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

type Seed = { storeId: string; tshirt: Item; skate: Item }
type Item = { productId: string; variantId: string }

async function item(storeId: string, handle: string, pricePaise: number): Promise<Item> {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle, title: handle, status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p.id, title: 'Default', pricePaise, weightGrams: 500 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId, variantId: v.id, onHand: 50 })
  return { productId: p.id, variantId: v.id }
}

/** A store selling a ₹600 T-shirt and a ₹5,000 skate. */
async function seed(slug: string): Promise<Seed> {
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
  return {
    storeId: s.id,
    tshirt: await item(s.id, 'tshirt', 60_000),
    skate: await item(s.id, 'skate', 500_000),
  }
}

async function cartOf(storeId: string, items: Item[]): Promise<string> {
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('seed')
  for (const i of items) {
    const [v] = await owner.select().from(variant).where(eq(variant.id, i.variantId))
    await owner.insert(cartLine).values({
      storeId,
      cartId: c.id,
      variantId: i.variantId,
      quantity: 1,
      unitPricePaise: v?.pricePaise ?? 0,
    })
  }
  return c.id
}

const flat = (name: string, pricePaise: number, freeAbovePaise: number | null = null) =>
  ({
    name,
    condition: 'none',
    minValue: null,
    maxValue: null,
    pricePaise,
    freeAbovePaise,
    codSurchargePaise: null,
    minTransitDays: null,
    maxTransitDays: null,
  }) satisfies ShippingRateWrite

/** Waimers: General ships free (Standard ₹49, free from ₹999); Skates pay ₹99 or ₹139. */
async function waimers(s: Seed) {
  return withStore(app, s.storeId, async (tx) => {
    await createShippingZone(tx, s.storeId, {
      name: 'All India',
      stateCodes: [],
      pincodeRules: [],
      rates: [flat('Standard', 4900, 99_900)],
    })
    const skates = await createShippingProfile(tx, s.storeId, {
      name: 'Skates',
      productIds: [s.skate.productId],
    })
    await createShippingZone(tx, s.storeId, {
      name: 'All India',
      profileId: skates.id,
      stateCodes: [],
      pincodeRules: [],
      rates: [flat('Delhivery', 9900), flat('Bluedart', 13_900)],
    })
    return skates
  })
}

const to = { stateCode: 'MH', pincode: '400001' }

const place = (storeId: string, cartId: string, shippingRateId: string | null = null) =>
  withStore(app, storeId, (tx) =>
    placeOrder(
      { storeId, tx },
      {
        cartId,
        paymentProvider: new FakePaymentProvider({ mode: 'capture' }),
        checkout: {
          email: 'a@example.com',
          phone: '9999999999',
          name: 'Asha',
          address: { line1: '2 Park St', city: 'Mumbai', ...to },
        },
        shippingRateId,
      },
    ),
  )

const totalOf = async (orderId: string) =>
  (await owner.select().from(order).where(eq(order.id, orderId)))[0]?.totalPaise

const quote = (storeId: string, cartId: string) =>
  withStore(app, storeId, (tx) => quoteCartShipping({ storeId, tx }, cartId, to))

describe('migration 0193: existing rates become General', () => {
  it('gives every store a General profile holding the zones it had', async () => {
    const s = await seed('migrate')
    // A zone as it was before profiles: no profile.
    const [zone] = await owner
      .insert(shippingZone)
      .values({ storeId: s.storeId, name: 'All India' })
      .returning()
    const file = new URL('../../../db/drizzle/0193_shipping_profiles.sql', import.meta.url)
    const backfill = readFileSync(file, 'utf8')
      .split('--> statement-breakpoint')
      .map((x) => x.replace(/^\s*--.*$/gm, '').trim())
      .filter((x) => x.startsWith('INSERT INTO "shipping_profile"') || x.startsWith('UPDATE'))
    expect(backfill).toHaveLength(2)
    for (const statement of [...backfill, ...backfill]) await owner.execute(sql.raw(statement))
    const profiles = await owner
      .select()
      .from(shippingProfile)
      .where(eq(shippingProfile.storeId, s.storeId))
    // Run twice, still one General.
    expect(profiles).toMatchObject([{ name: 'General', isDefault: true }])
    const [moved] = await owner
      .select()
      .from(shippingZone)
      .where(eq(shippingZone.id, zone?.id ?? ''))
    expect(moved?.profileId).toBe(profiles[0]?.id)
  })

  it('lists a zone written without a profile under General', async () => {
    const s = await seed('lazy')
    await owner.insert(shippingZone).values({ storeId: s.storeId, name: 'Seeded' })
    const profiles = await withStore(app, s.storeId, (tx) => listShippingProfiles(tx, s.storeId))
    expect(profiles.map((p) => [p.name, p.productCount, p.zones.map((z) => z.name)])).toEqual([
      ['General', null, ['Seeded']],
    ])
  })
})

describe('checkout across shipping profiles', () => {
  it('keeps a General-only cart priced exactly as before', async () => {
    const s = await seed('general-only')
    await waimers(s)
    const cartId = await cartOf(s.storeId, [s.tshirt])
    const q = await quote(s.storeId, cartId)
    expect(q).toMatchObject({ kind: 'rates', options: [{ name: 'Standard', pricePaise: 4900 }] })
    const placed = await place(s.storeId, cartId)
    expect(await totalOf(placed.orderId)).toBe(64_900)
  })

  it('charges the skate rate on top of General for a mixed cart (audit #159)', async () => {
    const s = await seed('mixed')
    await waimers(s)
    const cartId = await cartOf(s.storeId, [s.tshirt, s.skate])
    const q = await quote(s.storeId, cartId)
    if (q.kind !== 'rates') throw new Error(q.kind)
    // ₹5,600 in the cart, but General's free-from-₹999 reads General's ₹600 only.
    expect(q.options.map((o) => [o.name, o.pricePaise])).toEqual([
      ['Standard + Delhivery', 4900 + 9900],
      ['Standard + Bluedart', 4900 + 13_900],
    ])
    const bluedart = q.options[1]
    const placed = await place(s.storeId, cartId, bluedart?.rateId ?? null)
    const [row] = await owner.select().from(order).where(eq(order.id, placed.orderId))
    expect(row?.shippingPaise).toBe(18_800)
    expect(row?.shippingRateId).toBe(bluedart?.parts?.[0]?.rateId)
    expect(row?.shipping?.profiles?.map((p) => [p.profileName, p.rateName, p.pricePaise])).toEqual([
      ['General', 'Standard', 4900],
      ['Skates', 'Bluedart', 13_900],
    ])
  })

  it('prices a skates-only cart on the Skates rates alone', async () => {
    const s = await seed('skates-only')
    await waimers(s)
    const cartId = await cartOf(s.storeId, [s.skate])
    const q = await quote(s.storeId, cartId)
    expect(q).toMatchObject({
      kind: 'rates',
      options: [
        { name: 'Delhivery', pricePaise: 9900 },
        { name: 'Bluedart', pricePaise: 13_900 },
      ],
    })
    const placed = await place(s.storeId, cartId)
    expect(await totalOf(placed.orderId)).toBe(509_900)
  })

  it('only promises free shipping in the cart for products whose profiles do', async () => {
    const s = await seed('hint')
    await waimers(s)
    const shirts = await cartOf(s.storeId, [s.tshirt])
    const mixed = await cartOf(s.storeId, [s.tshirt, s.skate])
    const hint = (cartId: string | null) =>
      withStore(app, s.storeId, (tx) => cartShippingHintFor(tx, cartId))
    expect(await hint(null)).toEqual({ charged: true, freeAbovePaise: 99_900 })
    expect(await hint(shirts)).toEqual({ charged: true, freeAbovePaise: 99_900 })
    expect(await hint(mixed)).toEqual({ charged: true, freeAbovePaise: null })
  })
})

describe('shipping profile service', () => {
  it('moves products between profiles and back to General on delete, per store', async () => {
    const s = await seed('service')
    const other = await seed('other')
    const skates = await waimers(s)
    const result = await withStore(app, s.storeId, async (tx) => {
      const boards = await createShippingProfile(tx, s.storeId, {
        name: 'Boards',
        // The other store's product is not linked.
        productIds: [s.skate.productId, other.tshirt.productId],
      })
      return {
        boards,
        skates: await getShippingProfile(tx, s.storeId, skates.id),
        list: await listShippingProfiles(tx, s.storeId),
      }
    })
    expect(result.boards.productIds).toEqual([s.skate.productId])
    expect(result.skates?.productIds).toEqual([])
    expect(result.list.map((p) => [p.name, p.productCount])).toEqual([
      ['General', null],
      ['Skates', 0],
      ['Boards', 1],
    ])

    const renamed = await withStore(app, s.storeId, (tx) =>
      updateShippingProfile(tx, s.storeId, result.boards.id, { name: 'Decks', productIds: [] }),
    )
    expect(renamed).toMatchObject({ name: 'Decks', productIds: [] })

    expect(await withStore(app, other.storeId, (tx) => deleteShippingProfile(tx, skates.id))).toBe(
      false,
    )
    const general = result.list[0]
    expect(
      await withStore(app, s.storeId, (tx) => deleteShippingProfile(tx, general?.id ?? '')),
    ).toBe(false)
    expect(await withStore(app, s.storeId, (tx) => deleteShippingProfile(tx, skates.id))).toBe(true)
    const zones = await withStore(app, s.storeId, (tx) => listShippingZones(tx))
    expect(zones.map((z) => z.rates.map((r) => r.name))).toEqual([['Standard']])
    expect(await owner.select().from(shippingProfileProduct)).toEqual([])
  })
})
