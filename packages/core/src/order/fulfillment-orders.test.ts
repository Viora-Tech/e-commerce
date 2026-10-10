import {
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
  returnRequest,
  returnRequestLine,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { FakePaymentProvider } from '../providers/payment'
import { returnLocation, returnPickupLocation } from '../returns/service'
import { convertDraft } from './drafts'
import { fulfilOrderLines, fulfilRemainingLines } from './fulfil'
import {
  deleteFulfillmentOrders,
  ensureFulfillmentOrders,
  groupIntoParcels,
  lineLocation,
} from './fulfillment-orders'
import { orderParcelsView } from './parcel-view'
import { placeOrder } from './place-order'
import { cancelOrder } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

describe('groupIntoParcels', () => {
  const lines = [
    { orderLineId: 'a', quantity: 2, locationId: 'mumbai' },
    { orderLineId: 'b', quantity: 1, locationId: null },
    { orderLineId: 'c', quantity: 3, locationId: 'delhi' },
    { orderLineId: 'd', quantity: 1, locationId: 'delhi', fulfilledQuantity: 5 },
    { orderLineId: 'e', quantity: 0, locationId: 'delhi' },
  ]

  it('makes one parcel per location, the default location first, then by id', () => {
    const plans = groupIntoParcels(lines, 'mumbai')
    expect(plans.map((p) => p.locationId)).toEqual(['mumbai', 'delhi'])
    expect(plans[0]?.lines.map((l) => l.orderLineId)).toEqual(['a', 'b'])
    expect(plans[1]?.lines.map((l) => l.orderLineId)).toEqual(['c', 'd'])
  })

  it('puts lines with no location at the default one and drops empty lines', () => {
    const plans = groupIntoParcels(lines, 'haryana')
    expect(plans.map((p) => p.locationId)).toEqual(['haryana', 'delhi', 'mumbai'])
    expect(plans[0]?.lines).toEqual([{ orderLineId: 'b', quantity: 1, fulfilledQuantity: 0 }])
    expect(plans.flatMap((p) => p.lines).some((l) => l.orderLineId === 'e')).toBe(false)
  })

  it('never records more packed than ordered, nor less than nothing', () => {
    const plans = groupIntoParcels(
      [
        { orderLineId: 'x', quantity: 1, locationId: null, fulfilledQuantity: 5 },
        { orderLineId: 'y', quantity: 2, locationId: null, fulfilledQuantity: -1 },
      ],
      'home',
    )
    expect(plans[0]?.lines.map((l) => l.fulfilledQuantity)).toEqual([1, 0])
    expect(plans[0]?.status).toBe('open')
  })

  it('returns nothing for an order without goods', () => {
    expect(groupIntoParcels([], 'home')).toEqual([])
  })
})

/**
 * A store with two locations: Haryana (default, sells online, 10 on hand) and Delhi (5 on
 * hand, not selling). Haryana is linked to a GSTIN. `order` adds an open order for 3 units
 * with 3 committed at Haryana, placed before parcels existed (no fulfilment order yet).
 */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [b] = await owner
    .insert(business)
    .values({ storeId: s.id, legalName: 'Waimers', pan: 'AAAPL1234C', isPrimary: true })
    .returning()
  if (!b) throw new Error('seed')
  const [reg] = await owner
    .insert(gstRegistration)
    .values({ storeId: s.id, businessId: b.id, gstin: '06AAAPL1234C1Z5', isDefault: true })
    .returning()
  if (!reg) throw new Error('seed')
  const [haryana, delhi] = await owner
    .insert(location)
    .values([
      {
        storeId: s.id,
        name: 'Haryana',
        isDefault: true,
        fulfilsOnlineOrders: true,
        gstRegistrationId: reg.id,
      },
      { storeId: s.id, name: 'Delhi' },
    ])
    .returning()
  if (!haryana || !delhi) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: v.id, locationId: haryana.id, onHand: 10 },
    { storeId: s.id, variantId: v.id, locationId: delhi.id, onHand: 5, fulfilsOnline: false },
  ])
  return { storeId: s.id, variantId: v.id, haryana, delhi, registrationId: reg.id }
}

type Seeded = Awaited<ReturnType<typeof seed>>

async function legacyOrder(
  t: Seeded,
  opts: { status?: 'open' | 'cancelled' | 'draft'; fulfilled?: number; committed?: number } = {},
) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId: t.storeId,
      number: 1,
      status: opts.status ?? 'open',
      subtotalPaise: 300000,
      totalPaise: 300000,
      gstRegistrationId: t.registrationId,
    })
    .returning()
  if (!o) throw new Error('seed')
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId: t.storeId,
      orderId: o.id,
      variantId: t.variantId,
      quantity: 3,
      unitPricePaise: 100000,
      fulfilledQuantity: opts.fulfilled ?? 0,
    })
    .returning()
  if (!line) throw new Error('seed')
  await owner
    .update(inventoryLevel)
    .set({ reserved: opts.committed ?? 3 })
    .where(
      and(eq(inventoryLevel.variantId, t.variantId), eq(inventoryLevel.locationId, t.haryana.id)),
    )
  return { orderId: o.id, line }
}

function inStore<T>(t: Seeded, fn: (ctx: StoreContext) => Promise<T>) {
  return withStore(app, t.storeId, (tx) => fn({ tx, storeId: t.storeId }))
}

async function levels(t: Seeded) {
  const rows = await owner
    .select()
    .from(inventoryLevel)
    .where(eq(inventoryLevel.variantId, t.variantId))
  const at = (id: string) => {
    const r = rows.find((x) => x.locationId === id)
    return { onHand: r?.onHand, committed: r?.reserved }
  }
  return { haryana: at(t.haryana.id), delhi: at(t.delhi.id) }
}

/** Delhi becomes the selling location after the order was placed (the merchant moved stock). */
async function moveSellingToDelhi(t: Seeded) {
  await owner
    .update(inventoryLevel)
    .set({ fulfilsOnline: false })
    .where(eq(inventoryLevel.variantId, t.variantId))
  await owner
    .update(inventoryLevel)
    .set({ fulfilsOnline: true })
    .where(
      and(eq(inventoryLevel.variantId, t.variantId), eq(inventoryLevel.locationId, t.delhi.id)),
    )
}

async function parcelsOf(orderId: string) {
  const fos = await owner
    .select()
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(fulfillmentOrder.position)
  const lines = fos.length
    ? await owner
        .select()
        .from(fulfillmentOrderLine)
        .where(eq(fulfillmentOrderLine.fulfillmentOrderId, fos[0]?.id as string))
    : []
  return { fos, lines }
}

describe('placeOrder makes the parcel', () => {
  it('holds the stock in one parcel at the location it reserved at, under its GSTIN', async () => {
    const t = await seed()
    const [c] = await owner.insert(cart).values({ storeId: t.storeId }).returning()
    if (!c) throw new Error('seed')
    await owner.insert(cartLine).values({
      storeId: t.storeId,
      cartId: c.id,
      variantId: t.variantId,
      quantity: 2,
      unitPricePaise: 100000,
    })
    const placed = await inStore(t, (ctx) =>
      placeOrder(ctx, { cartId: c.id, paymentProvider: new FakePaymentProvider() }),
    )
    const { fos, lines } = await parcelsOf(placed.orderId)
    expect(fos).toHaveLength(1)
    expect(fos[0]).toMatchObject({
      locationId: t.haryana.id,
      gstRegistrationId: t.registrationId,
      position: 1,
      status: 'open',
    })
    expect(lines).toEqual([expect.objectContaining({ quantity: 2, fulfilledQuantity: 0 })])
    expect((await levels(t)).haryana).toEqual({ onHand: 10, committed: 2 })
  })
})

describe('older orders get their parcels on the next stock move', () => {
  it('ensureFulfillmentOrders mirrors what was packed, once', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t, { fulfilled: 1, committed: 2 })
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, orderId))
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, orderId))
    const { fos, lines } = await parcelsOf(orderId)
    expect(fos).toHaveLength(1)
    expect(fos[0]).toMatchObject({ locationId: t.haryana.id, status: 'open' })
    expect(lines).toEqual([
      expect.objectContaining({ orderLineId: line.id, quantity: 3, fulfilledQuantity: 1 }),
    ])
  })

  it('a cancelled order gets cancelled parcels; a draft gets none', async () => {
    const t = await seed()
    const cancelled = await legacyOrder(t, { status: 'cancelled', committed: 0 })
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, cancelled.orderId))
    expect((await parcelsOf(cancelled.orderId)).fos[0]?.status).toBe('cancelled')

    await owner.update(order).set({ status: 'draft' }).where(eq(order.id, cancelled.orderId))
    await owner.delete(fulfillmentOrder).where(eq(fulfillmentOrder.orderId, cancelled.orderId))
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, cancelled.orderId))
    expect((await parcelsOf(cancelled.orderId)).fos).toHaveLength(0)
  })

  it('a fully packed older order gets a fulfilled parcel', async () => {
    const t = await seed()
    const { orderId } = await legacyOrder(t, { fulfilled: 3, committed: 0 })
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, orderId))
    expect((await parcelsOf(orderId)).fos[0]?.status).toBe('fulfilled')
  })
})

describe('stock moves at the parcel location', () => {
  it('packing takes stock out where the parcel is, even after selling moved elsewhere', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, orderId))
    await moveSellingToDelhi(t)
    await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId: line.id, quantity: 2 }] }),
    )
    expect(await levels(t)).toEqual({
      haryana: { onHand: 8, committed: 1 },
      delhi: { onHand: 5, committed: 0 },
    })
    const { fos, lines } = await parcelsOf(orderId)
    expect(lines[0]?.fulfilledQuantity).toBe(2)
    expect(fos[0]?.status).toBe('open')
  })

  it('packing the rest marks the parcel fulfilled and is idempotent', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId: line.id, quantity: 1 }] }),
    )
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, orderId))
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, orderId))
    const { fos, lines } = await parcelsOf(orderId)
    expect(fos[0]?.status).toBe('fulfilled')
    expect(lines[0]?.fulfilledQuantity).toBe(3)
    expect((await levels(t)).haryana).toEqual({ onHand: 7, committed: 0 })
  })

  it('cancelling gives the unpacked units back at the parcel location', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId: line.id, quantity: 1 }] }),
    )
    await moveSellingToDelhi(t)
    await inStore(t, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    await inStore(t, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    expect(await levels(t)).toEqual({
      haryana: { onHand: 9, committed: 0 },
      delhi: { onHand: 5, committed: 0 },
    })
    expect((await parcelsOf(orderId)).fos[0]?.status).toBe('cancelled')
  })

  it('cancelling after everything was packed leaves the parcel fulfilled', async () => {
    const t = await seed()
    const { orderId } = await legacyOrder(t)
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, orderId))
    await inStore(t, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    expect((await parcelsOf(orderId)).fos[0]?.status).toBe('fulfilled')
    expect((await levels(t)).haryana).toEqual({ onHand: 7, committed: 0 })
  })

  it('returns go back to the location the parcel left from', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, orderId))
    await moveSellingToDelhi(t)
    expect(await inStore(t, (ctx) => lineLocation(ctx, line.id))).toBe(t.haryana.id)
    expect(
      await inStore(t, (ctx) =>
        returnLocation(ctx, { orderLineId: line.id, variantId: t.variantId }),
      ),
    ).toBe(t.haryana.id)
  })

  it('a courier brings a return back to the location its parcel left from', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, orderId))
    await moveSellingToDelhi(t)
    const [r] = await owner
      .insert(returnRequest)
      .values({ storeId: t.storeId, orderId, number: 1 })
      .returning()
    await owner.insert(returnRequestLine).values({
      storeId: t.storeId,
      returnRequestId: r?.id as string,
      orderLineId: line.id,
      quantity: 2,
    })
    expect(await inStore(t, (ctx) => returnPickupLocation(ctx, r?.id as string))).toBe(t.haryana.id)
  })

  it('a line no parcel holds returns to where the variant sells', async () => {
    const t = await seed()
    const { line } = await legacyOrder(t)
    await moveSellingToDelhi(t)
    expect(
      await inStore(t, (ctx) =>
        returnLocation(ctx, { orderLineId: line.id, variantId: t.variantId }),
      ),
    ).toBe(t.delhi.id)
  })
})

describe('shipments and parcels', () => {
  it('a parcel booked by hand carries the parcel its units came out of', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    const result = await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, {
        orderId,
        lines: [{ lineId: line.id, quantity: 3 }],
        courier: 'Bluedart',
        trackingNumber: 'BD123',
      }),
    )
    const [ship] = await owner
      .select()
      .from(shipment)
      .where(eq(shipment.id, result.shipmentId as string))
    const { fos } = await parcelsOf(orderId)
    expect(ship?.fulfillmentOrderId).toBe(fos[0]?.id)
  })

  it('deleting parcels unlinks their shipments and keeps the shipments', async () => {
    const t = await seed()
    const { orderId, line } = await legacyOrder(t)
    const result = await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, {
        orderId,
        lines: [{ lineId: line.id, quantity: 1 }],
        trackingNumber: 'MAN1',
      }),
    )
    await inStore(t, (ctx) => deleteFulfillmentOrders(ctx.tx, orderId))
    expect((await parcelsOf(orderId)).fos).toHaveLength(0)
    const [ship] = await owner
      .select()
      .from(shipment)
      .where(eq(shipment.id, result.shipmentId as string))
    expect(ship).toMatchObject({ orderId, fulfillmentOrderId: null })
  })
})

describe('draft conversion makes the parcel', () => {
  it('holds the stock in a parcel at the selling location', async () => {
    const t = await seed()
    const { orderId } = await legacyOrder(t, { status: 'draft', committed: 0 })
    await inStore(t, (ctx) => convertDraft(ctx, orderId))
    const { fos, lines } = await parcelsOf(orderId)
    expect(fos).toHaveLength(1)
    expect(fos[0]).toMatchObject({ locationId: t.haryana.id, gstRegistrationId: t.registrationId })
    expect(lines[0]).toMatchObject({ quantity: 3, fulfilledQuantity: 0 })
    expect((await levels(t)).haryana).toEqual({ onHand: 10, committed: 3 })
  })
})

describe('orderParcelsView', () => {
  it('shows where each parcel ships from, its items and packing', async () => {
    const t = await seed()
    await owner
      .update(location)
      .set({ city: 'Gurugram', stateCode: 'HR' })
      .where(eq(location.id, t.haryana.id))
    const { orderId } = await legacyOrder(t)
    await inStore(t, (ctx) => ensureFulfillmentOrders(ctx, orderId))
    const [view] = await inStore(t, (ctx) => orderParcelsView(ctx.tx, orderId))
    expect(view).toMatchObject({
      position: 1,
      status: 'open',
      needsTransfer: false,
      locationName: 'Haryana',
      city: 'Gurugram',
      stateCode: 'HR',
      stateName: 'Haryana',
      gstin: '06AAAPL1234C1Z5',
      lines: [{ quantity: 3, fulfilledQuantity: 0 }],
    })
  })
})
