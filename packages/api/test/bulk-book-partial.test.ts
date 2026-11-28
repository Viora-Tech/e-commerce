/** Bulk Create shipment with part of a parcel (the drawer's Edit shipment, Items to send): the
 *  parcel keeps the picked units and books only those; the rest stays unfulfilled in a new
 *  parcel for later, as the order page's partial Create shipment does. */
import {
  address,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  location,
  order,
  orderLine,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import {
  type CreateShipmentInput,
  FakeShippingProvider,
  fakeShippingFactory,
  ShippingRegistry,
} from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bulkBookShipments } from '../src/services/shipments-workspace.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-settings-secret'

/** The demo courier, recording what each booking asked for; no network. */
const booked: CreateShipmentInput[] = []
let clock = Date.now()
const registry = new ShippingRegistry().register({
  ...fakeShippingFactory,
  create: () =>
    Object.assign(new FakeShippingProvider(() => (clock += 7919)), {
      async createShipment(input: CreateShipmentInput) {
        booked.push(input)
        return FakeShippingProvider.prototype.createShipment.call(this, input)
      },
    }),
})

beforeEach(async () => {
  booked.length = 0
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A COD order of 2 glasspads and a wrist rest, in one parcel. */
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'Waimers',
      shipping: {
        enabled: ['fake'],
        policy: {
          originPincode: '131028',
          warehouse: { name: 'HQ', line1: 'Plot 4', city: 'Sonipat', state: 'HR', phone: '9' },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [at] = await owner
    .insert(location)
    .values({ storeId: s.id, name: 'Sonipat', isDefault: true, fulfilsOnlineOrders: true })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  const [pad, rest] = await owner
    .insert(variant)
    .values([
      {
        storeId: s.id,
        productId: p?.id as string,
        title: 'Pad',
        pricePaise: 249900,
        weightGrams: 300,
      },
      {
        storeId: s.id,
        productId: p?.id as string,
        title: 'Rest',
        pricePaise: 99900,
        weightGrams: 200,
      },
    ])
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.id,
      name: 'Asha',
      line1: '12 MG Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560001',
      phone: '9999999999',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 9,
      status: 'open',
      subtotalPaise: 599700,
      totalPaise: 599700,
      paymentMethod: 'cod',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
    })
    .returning()
  const lines = await owner
    .insert(orderLine)
    .values([
      {
        storeId: s.id,
        orderId: o?.id as string,
        variantId: pad?.id as string,
        title: 'Glasspad',
        variantTitle: 'Pad',
        quantity: 2,
        unitPricePaise: 249900,
      },
      {
        storeId: s.id,
        orderId: o?.id as string,
        variantId: rest?.id as string,
        title: 'Wrist rest',
        variantTitle: 'Rest',
        quantity: 1,
        unitPricePaise: 99900,
      },
    ])
    .returning()
  const [fo] = await owner
    .insert(fulfillmentOrder)
    .values({
      storeId: s.id,
      orderId: o?.id as string,
      locationId: at?.id as string,
      position: 1,
      totalPaise: 599700,
    })
    .returning()
  await owner.insert(fulfillmentOrderLine).values(
    lines.map((l) => ({
      storeId: s.id,
      fulfillmentOrderId: fo?.id as string,
      orderLineId: l.id,
      quantity: l.quantity,
    })),
  )
  return {
    storeId: s.id,
    orderId: o?.id as string,
    parcelId: fo?.id as string,
    padLine: lines[0]?.id as string,
    restLine: lines[1]?.id as string,
  }
}

describe('bulk booking part of a parcel', () => {
  it('books only the picked units and leaves the rest unfulfilled for later', async () => {
    const { storeId, orderId, parcelId, padLine, restLine } = await seed()
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, {
        orderIds: [orderId],
        courierOverrides: { [orderId]: 'fake' },
        parcelIds: { [orderId]: parcelId },
        perOrder: {
          [orderId]: {
            weightGrams: 450,
            insured: false,
            codAmountPaise: 249900,
            keep: [
              { orderLineId: padLine, quantity: 1 },
              { orderLineId: restLine, quantity: 0 },
            ],
            notifyCustomer: false,
          },
        },
      }),
    )
    expect(results).toEqual([expect.objectContaining({ ok: true, fulfillmentOrderId: parcelId })])
    // The courier got one glasspad, and the part's share of the cash to collect.
    expect(booked).toHaveLength(1)
    expect(booked[0]?.lines.map((l) => l.quantity)).toEqual([1])
    expect(booked[0]?.codAmountPaise).toBe(249900)
    const [label] = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    expect(label).toMatchObject({ fulfillmentOrderId: parcelId, codAmountPaise: 249900 })

    // The rest: a new open parcel with one glasspad and the wrist rest, nothing fulfilled.
    const parcels = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId))
    const later = parcels.find((p) => p.id !== parcelId)
    expect(later).toMatchObject({ status: 'open', splitReason: 'not_ready' })
    const left = await owner
      .select()
      .from(fulfillmentOrderLine)
      .where(eq(fulfillmentOrderLine.fulfillmentOrderId, later?.id as string))
    expect(
      Object.fromEntries(left.map((l) => [l.orderLineId, [l.quantity, l.fulfilledQuantity]])),
    ).toEqual({ [padLine]: [1, 0], [restLine]: [1, 0] })
  })

  it('refuses a split that keeps nothing, and books nothing', async () => {
    const { storeId, orderId, parcelId, padLine, restLine } = await seed()
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, {
        orderIds: [orderId],
        courierOverrides: { [orderId]: 'fake' },
        parcelIds: { [orderId]: parcelId },
        perOrder: {
          [orderId]: {
            keep: [
              { orderLineId: padLine, quantity: 0 },
              { orderLineId: restLine, quantity: 0 },
            ],
          },
        },
      }),
    )
    expect(results).toEqual([expect.objectContaining({ ok: false })])
    expect(booked).toHaveLength(0)
  })
})
