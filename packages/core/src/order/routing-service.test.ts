/** SOURCE OF TRUTH: order routing service tests — WHAT: loading locations and routing an order / WHY: guards which location ships each line */
import {
  address,
  business,
  cart,
  cartLine,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  gstRegistration,
  inventoryLevel,
  location,
  order,
  orderLine,
  product,
  sellableStock,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getCart } from '../cart/cart'
import { CannotShipToState, OutOfStock, PreorderLimitReached } from '../errors'
import { FakePaymentProvider } from '../providers/payment'
import { convertDraft } from './drafts'
import { orderParcelsView, previewCartParcels } from './parcel-view'
import { type PlaceOrderInput, placeOrder } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const PINS: Record<string, string> = { HR: '122001', DL: '110001', MH: '400001', KA: '560001' }
const GSTINS = { HR: '06AAAPL1234C1Z5', DL: '07AAAPL1234C1Z3', MH: '27AAAPL1234C1Z1' }

/**
 * Waimers' three warehouses, all shipping online: Haryana (default, priority 0, HR GSTIN),
 * Delhi (priority 1, DL GSTIN), Mumbai (priority 2, MH GSTIN). Two products, shirt and cap.
 */
async function seed(opts: { maxParcels?: number; mumbaiComposition?: boolean } = {}) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      shipping: { routing: { maxParcels: opts.maxParcels ?? 2 } },
      // Routing at checkout: drafts off, as a draft is routed when it converts (checkout-draft.ts).
      payments: { unpaidAsDrafts: 'off' },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [b] = await owner
    .insert(business)
    .values({ storeId: s.id, legalName: 'Waimers', pan: 'AAAPL1234C', isPrimary: true })
    .returning()
  if (!b) throw new Error('seed')
  const regs = await owner
    .insert(gstRegistration)
    .values(
      (['HR', 'DL', 'MH'] as const).map((state) => ({
        storeId: s.id,
        businessId: b.id,
        gstin: GSTINS[state],
        isDefault: state === 'HR',
        registrationType:
          state === 'MH' && opts.mumbaiComposition
            ? ('composition' as const)
            : ('regular' as const),
      })),
    )
    .returning()
  const reg = (state: string) => regs.find((r) => r.gstin.startsWith(state))?.id as string
  const locs = await owner
    .insert(location)
    .values([
      {
        storeId: s.id,
        name: 'Haryana',
        stateCode: 'HR',
        isDefault: true,
        fulfilsOnlineOrders: true,
        priority: 0,
        gstRegistrationId: reg('06'),
      },
      {
        storeId: s.id,
        name: 'Delhi',
        stateCode: 'DL',
        fulfilsOnlineOrders: true,
        priority: 1,
        gstRegistrationId: reg('07'),
      },
      {
        storeId: s.id,
        name: 'Mumbai',
        stateCode: 'MH',
        fulfilsOnlineOrders: true,
        priority: 2,
        gstRegistrationId: reg('27'),
      },
    ])
    .returning()
  const loc = (name: string) => locs.find((l) => l.name === name)?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'tee', title: 'Tee', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [shirt, cap] = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p.id, title: 'Shirt', pricePaise: 118_000 },
      { storeId: s.id, productId: p.id, title: 'Cap', pricePaise: 59_000 },
    ])
    .returning()
  if (!shirt || !cap) throw new Error('seed')
  return {
    storeId: s.id,
    shirt: shirt.id,
    cap: cap.id,
    haryana: loc('Haryana'),
    delhi: loc('Delhi'),
    mumbai: loc('Mumbai'),
    reg,
  }
}

type Seeded = Awaited<ReturnType<typeof seed>>

async function stock(t: Seeded, variantId: string, at: Record<string, number>) {
  for (const [locationId, onHand] of Object.entries(at)) {
    await owner.insert(inventoryLevel).values({ storeId: t.storeId, variantId, locationId, onHand })
  }
}

async function cartOf(t: Seeded, lines: [string, number][]) {
  const [c] = await owner.insert(cart).values({ storeId: t.storeId }).returning()
  if (!c) throw new Error('seed')
  for (const [variantId, quantity] of lines) {
    await owner.insert(cartLine).values({
      storeId: t.storeId,
      cartId: c.id,
      variantId,
      quantity,
      unitPricePaise: variantId === t.shirt ? 118_000 : 59_000,
    })
  }
  return c
}

async function place(
  t: Seeded,
  lines: [string, number][],
  stateCode: string,
  extra: Pick<PlaceOrderInput, 'deliveryEstimates'> = {},
) {
  const c = await cartOf(t, lines)
  return withStore(app, t.storeId, (tx) =>
    placeOrder(
      { storeId: t.storeId, tx },
      {
        cartId: c.id,
        paymentProvider: new FakePaymentProvider(),
        ...extra,
        checkout: {
          email: 'a@example.com',
          phone: '9820012345',
          name: 'Aarav',
          address: { line1: '1 Road', city: 'City', stateCode, pincode: PINS[stateCode] ?? '' },
        },
      },
    ),
  )
}

async function parcelsOf(orderId: string) {
  const fos = await owner
    .select()
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(asc(fulfillmentOrder.position))
  const lines = await owner.select().from(fulfillmentOrderLine)
  return fos.map((fo) => ({
    ...fo,
    units: lines.filter((l) => l.fulfillmentOrderId === fo.id).reduce((n, l) => n + l.quantity, 0),
  }))
}

async function committed(variantId: string, locationId: string) {
  const [row] = await owner
    .select({ onHand: inventoryLevel.onHand, reserved: inventoryLevel.reserved })
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), eq(inventoryLevel.locationId, locationId)))
  return row ?? null
}

describe('placeOrder routes to warehouses', () => {
  it("ships from the buyer's own state when that warehouse has everything", async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 5, [t.delhi]: 5 })
    const placed = await place(t, [[t.shirt, 2]], 'DL')
    const parcels = await parcelsOf(placed.orderId)
    expect(parcels).toEqual([
      expect.objectContaining({
        locationId: t.delhi,
        gstRegistrationId: t.reg('07'),
        status: 'open',
        needsTransfer: false,
        units: 2,
      }),
    ])
    expect(await committed(t.shirt, t.delhi)).toEqual({ onHand: 5, reserved: 2 })
    expect(await committed(t.shirt, t.haryana)).toEqual({ onHand: 5, reserved: 0 })
    // The order is billed from Delhi: CGST + SGST for a Delhi buyer, same price.
    const [o] = await owner.select().from(order).where(eq(order.id, placed.orderId))
    expect(o?.gstRegistrationId).toBe(t.reg('07'))
    expect(o?.totalPaise).toBe(236_000)
  })

  it('splits into two parcels when no warehouse has everything', async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 1 })
    await stock(t, t.cap, { [t.mumbai]: 1 })
    const placed = await place(
      t,
      [
        [t.shirt, 1],
        [t.cap, 1],
      ],
      'KA',
    )
    const parcels = await parcelsOf(placed.orderId)
    expect(parcels.map((p) => [p.locationId, p.position, p.units, p.needsTransfer])).toEqual([
      [t.haryana, 1, 1, false],
      [t.mumbai, 2, 1, false],
    ])
    expect(parcels.map((p) => p.gstRegistrationId)).toEqual([t.reg('06'), t.reg('27')])
    expect(await committed(t.shirt, t.haryana)).toMatchObject({ reserved: 1 })
    expect(await committed(t.cap, t.mumbai)).toMatchObject({ reserved: 1 })
  })

  it('past the parcel limit the default warehouse takes the rest and needs a transfer', async () => {
    const t = await seed({ maxParcels: 1 })
    await stock(t, t.shirt, { [t.delhi]: 1 })
    await stock(t, t.cap, { [t.mumbai]: 1 })
    const placed = await place(
      t,
      [
        [t.shirt, 1],
        [t.cap, 1],
      ],
      'KA',
    )
    const parcels = await parcelsOf(placed.orderId)
    expect(parcels).toEqual([
      expect.objectContaining({ locationId: t.haryana, needsTransfer: true, units: 2 }),
    ])
    // Haryana holds them past its stock (a row is made for it); Delhi and Mumbai keep theirs.
    expect(await committed(t.shirt, t.haryana)).toEqual({ onHand: 0, reserved: 1 })
    expect(await committed(t.cap, t.haryana)).toEqual({ onHand: 0, reserved: 1 })
    expect(await committed(t.shirt, t.delhi)).toEqual({ onHand: 1, reserved: 0 })
  })

  it('refuses when all warehouses together are short (today’s out of stock)', async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 1, [t.delhi]: 1 })
    await expect(place(t, [[t.shirt, 3]], 'HR')).rejects.toBeInstanceOf(OutOfStock)
    expect(await committed(t.shirt, t.haryana)).toMatchObject({ reserved: 0 })
  })

  it('a composition warehouse never ships to another state', async () => {
    const t = await seed({ mumbaiComposition: true })
    await owner
      .update(location)
      .set({ fulfilsOnlineOrders: false })
      .where(eq(location.id, t.haryana))
    await owner.update(location).set({ fulfilsOnlineOrders: false }).where(eq(location.id, t.delhi))
    await stock(t, t.shirt, { [t.mumbai]: 5 })
    await expect(place(t, [[t.shirt, 1]], 'KA')).rejects.toBeInstanceOf(CannotShipToState)
    // Within Maharashtra it ships.
    const placed = await place(t, [[t.shirt, 1]], 'MH')
    expect((await parcelsOf(placed.orderId))[0]?.locationId).toBe(t.mumbai)
  })

  it('a location switched off stops selling, and its stock leaves the storefront total', async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 2, [t.delhi]: 3 })
    const total = async () => {
      const [row] = await withStore(app, t.storeId, (tx) =>
        tx.select().from(sellableStock).where(eq(sellableStock.variantId, t.shirt)),
      )
      return row?.onHand
    }
    expect(await total()).toBe(5)
    await owner.update(location).set({ fulfilsOnlineOrders: false }).where(eq(location.id, t.delhi))
    expect(await total()).toBe(2)
    await expect(place(t, [[t.shirt, 3]], 'DL')).rejects.toBeInstanceOf(OutOfStock)
    await owner.update(location).set({ active: false }).where(eq(location.id, t.haryana))
    await owner.update(location).set({ fulfilsOnlineOrders: true }).where(eq(location.id, t.delhi))
    expect(await total()).toBe(3)
  })
})

describe('each parcel is taxed from its own GSTIN', () => {
  it('a split order bills each parcel CGST + SGST or IGST by where it leaves from', async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 1 })
    await stock(t, t.cap, { [t.delhi]: 1 })
    const placed = await place(
      t,
      [
        [t.shirt, 1],
        [t.cap, 1],
      ],
      'DL',
    )
    const parcels = await parcelsOf(placed.orderId)
    // Delhi is the buyer's own state, so it ships first; Haryana sends the shirt.
    expect(parcels.map((p) => p.locationId)).toEqual([t.delhi, t.haryana])
    const [delhi, haryana] = parcels
    expect(delhi).toMatchObject({
      gstRegistrationId: t.reg('07'),
      subtotalPaise: 59_000,
      totalPaise: 59_000,
      taxPaise: 9_000,
      taxBreakdown: expect.objectContaining({ cgstPaise: 4_500, sgstPaise: 4_500, igstPaise: 0 }),
      taxOrigin: expect.objectContaining({ gstin: GSTINS.DL, stateCode: 'DL' }),
    })
    expect(haryana).toMatchObject({
      gstRegistrationId: t.reg('06'),
      totalPaise: 118_000,
      taxPaise: 18_000,
      taxBreakdown: expect.objectContaining({ igstPaise: 18_000, cgstPaise: 0 }),
      taxOrigin: expect.objectContaining({ gstin: GSTINS.HR, stateCode: 'HR' }),
    })
    const [o] = await owner.select().from(order).where(eq(order.id, placed.orderId))
    // The shopper pays the same; the order's GST is the parcels' sum.
    expect(o?.totalPaise).toBe(177_000)
    expect(o?.taxPaise).toBe(27_000)
    expect(o?.taxBreakdown).toMatchObject({
      cgstPaise: 4_500,
      sgstPaise: 4_500,
      igstPaise: 18_000,
      interState: false,
    })
    // Billed from the parcel holding the most value.
    expect(o?.gstRegistrationId).toBe(t.reg('06'))
  })

  it('a parcel from a composition GSTIN charges no GST', async () => {
    const t = await seed({ mumbaiComposition: true })
    await stock(t, t.shirt, { [t.mumbai]: 1 })
    const placed = await place(t, [[t.shirt, 1]], 'MH')
    const [only] = await parcelsOf(placed.orderId)
    expect(only).toMatchObject({ locationId: t.mumbai, totalPaise: 118_000, taxPaise: 0 })
    const [o] = await owner.select().from(order).where(eq(order.id, placed.orderId))
    expect(o?.totalPaise).toBe(118_000)
    expect(o?.taxPaise).toBe(0)
  })
})

describe('what the shopper is shown', () => {
  it('previews the parcels of a cart without holding any stock', async () => {
    const t = await seed()
    await owner.update(location).set({ city: 'New Delhi' }).where(eq(location.id, t.delhi))
    await stock(t, t.shirt, { [t.haryana]: 1 })
    await stock(t, t.cap, { [t.delhi]: 1 })
    const c = await cartOf(t, [
      [t.shirt, 1],
      [t.cap, 1],
    ])
    const preview = await withStore(app, t.storeId, (tx) =>
      previewCartParcels({ storeId: t.storeId, tx }, c.id, 'DL'),
    )
    expect(preview.map((p) => [p.locationName, p.city, p.stateName, p.lines.length])).toEqual([
      ['Delhi', 'New Delhi', 'Delhi', 1],
      ['Haryana', null, 'Haryana', 1],
    ])
    expect(preview[0]?.lines[0]).toMatchObject({ variantId: t.cap, title: 'Tee', quantity: 1 })
    expect(await committed(t.cap, t.delhi)).toMatchObject({ reserved: 0 })
  })

  it('a cart nothing can cover previews no parcels', async () => {
    const t = await seed()
    const c = await cartOf(t, [[t.shirt, 1]])
    const preview = await withStore(app, t.storeId, (tx) =>
      previewCartParcels({ storeId: t.storeId, tx }, c.id, 'DL'),
    )
    expect(preview).toEqual([])
  })

  it('keeps the delivery window checkout showed on each parcel', async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 1 })
    await stock(t, t.cap, { [t.delhi]: 1 })
    const placed = await place(
      t,
      [
        [t.shirt, 1],
        [t.cap, 1],
      ],
      'DL',
      { deliveryEstimates: { [t.delhi]: { earliest: '2026-10-13', latest: '2026-10-14' } } },
    )
    const views = await withStore(app, t.storeId, (tx) => orderParcelsView(tx, placed.orderId))
    expect(views.map((v) => [v.locationName, v.deliveryEstimate])).toEqual([
      ['Delhi', { earliest: '2026-10-13', latest: '2026-10-14' }],
      ['Haryana', null],
    ])
  })
})

describe('a converted draft is billed like a checkout', () => {
  it('routes, splits and taxes each parcel from its own GSTIN', async () => {
    const t = await seed()
    await stock(t, t.shirt, { [t.haryana]: 1 })
    await stock(t, t.cap, { [t.delhi]: 1 })
    const [a] = await owner
      .insert(address)
      .values({
        storeId: t.storeId,
        name: 'Aarav',
        line1: '1 Road',
        city: 'Delhi',
        stateCode: 'DL',
        pincode: '110001',
        phone: '9820012345',
      })
      .returning()
    const [d] = await owner
      .insert(order)
      .values({
        storeId: t.storeId,
        number: 9,
        status: 'draft',
        shippingAddressId: a?.id,
        subtotalPaise: 177_000,
        totalPaise: 177_000,
      })
      .returning()
    await owner.insert(orderLine).values([
      {
        storeId: t.storeId,
        orderId: d?.id as string,
        variantId: t.shirt,
        quantity: 1,
        unitPricePaise: 118_000,
        gstRatePercent: 18,
      },
      {
        storeId: t.storeId,
        orderId: d?.id as string,
        variantId: t.cap,
        quantity: 1,
        unitPricePaise: 59_000,
        gstRatePercent: 18,
      },
    ])
    await withStore(app, t.storeId, (tx) =>
      convertDraft({ storeId: t.storeId, tx }, d?.id as string),
    )
    const parcels = await parcelsOf(d?.id as string)
    expect(parcels.map((p) => [p.locationId, p.totalPaise, p.taxPaise])).toEqual([
      [t.delhi, 59_000, 9_000],
      [t.haryana, 118_000, 18_000],
    ])
    const [o] = await owner
      .select()
      .from(order)
      .where(eq(order.id, d?.id as string))
    expect(o).toMatchObject({ status: 'open', taxPaise: 27_000, gstRegistrationId: t.reg('06') })
    expect(o?.taxBreakdown).toMatchObject({ cgstPaise: 4_500, sgstPaise: 4_500, igstPaise: 18_000 })
  })
})

describe('pre-orders with stock in two locations (#1538, #1539)', () => {
  /** Shirt sells on pre-order, at most 2 past stock; its stock is only in Delhi, not at home. */
  async function preorderShirt() {
    const t = await seed()
    const [v] = await owner.select().from(variant).where(eq(variant.id, t.shirt))
    await owner
      .update(product)
      .set({ preorderEnabled: true, preorderLimit: 2 })
      .where(eq(product.id, v?.productId as string))
    await stock(t, t.shirt, { [t.haryana]: 0, [t.delhi]: 3 })
    return t
  }

  const cartRoom = async (t: Seeded) => {
    const c = await cartOf(t, [[t.shirt, 1]])
    const view = await withStore(app, t.storeId, (tx) => getCart({ storeId: t.storeId, tx }, c.id))
    return view?.lines[0]?.available
  }

  it('the cart offers what checkout accepts: stock anywhere, or home stock plus the limit', async () => {
    const t = await preorderShirt()
    // Delhi's 3 ship from stock; past that the line is held whole at home (Haryana: 0 + 2).
    expect(await cartRoom(t)).toBe(3)
    const placed = await place(t, [[t.shirt, 3]], 'HR')
    expect((await parcelsOf(placed.orderId)).map((p) => [p.locationId, p.status])).toEqual([
      [t.delhi, 'open'],
    ])
  })

  it('home stock counts too: the larger of stock everywhere and home free + limit', async () => {
    const t = await preorderShirt()
    await owner
      .update(inventoryLevel)
      .set({ onHand: 2 })
      .where(and(eq(inventoryLevel.variantId, t.shirt), eq(inventoryLevel.locationId, t.haryana)))
    // 5 in stock in all; a pre-order of 6 would sit at home: 2 free + 2 limit = 4 < 6.
    expect(await cartRoom(t)).toBe(5)
    await expect(place(t, [[t.shirt, 6]], 'HR')).rejects.toBeInstanceOf(PreorderLimitReached)
  })

  it('a used-up pre-order limit refuses with PreorderLimitReached, still a kind of OutOfStock', async () => {
    const t = await preorderShirt()
    const refused = place(t, [[t.shirt, 4]], 'HR')
    await expect(refused).rejects.toBeInstanceOf(PreorderLimitReached)
    await expect(refused).rejects.toBeInstanceOf(OutOfStock)
    await expect(refused).rejects.toMatchObject({ code: 'PREORDER_LIMIT_REACHED' })
    expect(await committed(t.shirt, t.haryana)).toMatchObject({ reserved: 0 })
  })
})
