/** SOURCE OF TRUTH: one booking per parcel under a double "Ship now" — WHAT: two bookings of the same order at once book the courier once and return the same shipment / WHY: a click again after the page reloaded mid-booking must not buy a second label (owner, 14 Nov 2026) */
import {
  address,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  location,
  order,
  orderLine,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { ShippingProvider } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../catalog/products'
import { createShipmentForOrder } from './shipments'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A store with order #7: one line, one open parcel, a delivery address; committed. */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'one-booking', name: 'Chai Co' }).returning()
  const storeId = s?.id as string
  const orderId = await withStore(app, storeId, async (tx) => {
    const [loc] = await tx
      .insert(location)
      .values({ storeId, name: 'Main', isDefault: true, fulfilsOnlineOrders: true })
      .returning()
    const productId = await createProduct(tx, storeId, {
      title: 'Tea',
      status: 'active',
      options: [],
      variants: [{ optionValues: [], pricePaise: 50_000 }],
    })
    const [v] = await tx.select().from(variant).where(eq(variant.productId, productId))
    const [a] = await tx
      .insert(address)
      .values({
        storeId,
        name: 'Asha',
        line1: 'x',
        city: 'Pune',
        stateCode: 'MH',
        pincode: '411001',
        phone: '9876543210',
      })
      .returning()
    const [o] = await tx
      .insert(order)
      .values({
        storeId,
        number: 7,
        subtotalPaise: 100_000,
        totalPaise: 100_000,
        email: 'asha@example.com',
        phone: '9876543210',
        shippingAddressId: a?.id,
      })
      .returning()
    const [line] = await tx
      .insert(orderLine)
      .values({
        storeId,
        orderId: o?.id as string,
        variantId: v?.id as string,
        title: 'Tea',
        quantity: 1,
        unitPricePaise: 50_000,
      })
      .returning()
    const [parcel] = await tx
      .insert(fulfillmentOrder)
      .values({ storeId, orderId: o?.id as string, locationId: loc?.id as string, position: 1 })
      .returning()
    await tx.insert(fulfillmentOrderLine).values({
      storeId,
      fulfillmentOrderId: parcel?.id as string,
      orderLineId: line?.id as string,
      quantity: 1,
    })
    return o?.id as string
  })
  return { storeId, orderId }
}

describe('a double Ship now', () => {
  it('books the courier once and gives both clicks the same shipment', async () => {
    const { storeId, orderId } = await seed()
    let booked = 0
    // A slow courier, like RapidShyp's create order, assign AWB, pickup and label.
    const courier = {
      id: 'stub',
      label: 'Stub',
      async createShipment() {
        booked += 1
        await new Promise((r) => setTimeout(r, 300))
        return { waybill: `AWB-${booked}`, providerRef: `ref-${booked}` }
      },
    } as unknown as ShippingProvider
    const ship = () =>
      withStore(app, storeId, (tx) => createShipmentForOrder({ storeId, tx }, courier, orderId))
    const [first, second] = await Promise.all([ship(), ship()])
    expect(booked).toBe(1)
    expect(second.id).toBe(first.id)
    expect(second.waybill).toBe('AWB-1')
  })
})
