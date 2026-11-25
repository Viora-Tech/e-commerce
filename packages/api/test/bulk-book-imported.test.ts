/** Bulk Create shipment on imported orders still open (owner, 25 Nov 2026): each order is taken
 *  over first, so it ends fulfilled and workable like an order booked from its own page, instead
 *  of staying read-only and Unfulfilled until someone clicks "Manage this order" on it. */
import {
  address,
  createDb,
  inventoryLevel,
  location,
  order,
  orderLine,
  orderNote,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider, fakeShippingFactory, ShippingRegistry } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bulkBookShipments } from '../src/services/shipments-workspace.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-settings-secret'
const STAFF = 'owner@waimers.in'

let clock = Date.now()
const registry = new ShippingRegistry().register({
  ...fakeShippingFactory,
  create: () => new FakeShippingProvider(() => (clock += 7919)),
})

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

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
  await owner
    .insert(location)
    .values({ storeId: s.id, name: 'Sonipat', isDefault: true, fulfilsOnlineOrders: true })
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p?.id as string,
      title: 'Black',
      pricePaise: 100000,
      weightGrams: 400,
    })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 10 })
  return { storeId: s.id, variantId: v.id }
}

/** An open, paid order the Shopify import wrote. */
async function imported(storeId: string, variantId: string, number: number) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Raj',
      line1: '1B Main Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560037',
      phone: '9777922152',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number,
      status: 'open',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      checkoutPaidAt: new Date(),
      subtotalPaise: 200000,
      totalPaise: 200000,
      paymentMethod: 'prepaid',
      email: 'raj@example.in',
      shippingAddressId: a?.id,
      importedFrom: 'shopify',
      importMeta: {
        name: `#${number}`,
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        paymentMethod: 'Razorpay',
      },
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId,
    orderId: o.id,
    variantId,
    title: 'Glasspad',
    variantTitle: 'Black',
    quantity: 2,
    unitPricePaise: 100000,
  })
  return o.id
}

const orderRow = async (id: string) => {
  const [o] = await owner.select().from(order).where(eq(order.id, id))
  if (!o) throw new Error('missing order')
  return o
}

describe('bulk booking imported orders', () => {
  it('takes each open one over, so it ends fulfilled like an order booked on its page', async () => {
    const { storeId, variantId } = await seed()
    const a = await imported(storeId, variantId, 2331)
    const b = await imported(storeId, variantId, 2332)
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, { orderIds: [a, b], author: STAFF }),
    )
    expect(results.map((r) => [r.orderId, r.ok])).toEqual([
      [a, true],
      [b, true],
    ])
    for (const id of [a, b]) {
      const o = await orderRow(id)
      // No longer a read-only import: no "Manage this order" left to click.
      expect(o.importedFrom).toBeNull()
      expect(o.importMeta?.takenOver).toMatchObject({ by: STAFF, source: 'shopify' })
      expect(o.fulfillmentStatus).toBe('fulfilled')
      const rows = await owner.select().from(shipment).where(eq(shipment.orderId, id))
      expect(rows).toHaveLength(1)
      const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
      expect(notes.some((n) => n.body.includes('Imported from Shopify'))).toBe(true)
    }
  })

  it('refuses imported history as the single-order page does, and books the rest', async () => {
    const { storeId, variantId } = await seed()
    const shipped = await imported(storeId, variantId, 2331)
    await owner.update(order).set({ fulfillmentStatus: 'fulfilled' }).where(eq(order.id, shipped))
    const open = await imported(storeId, variantId, 2332)
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, {
        orderIds: [shipped, open],
        author: STAFF,
      }),
    )
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orderId: open, ok: true }),
        expect.objectContaining({
          orderId: shipped,
          ok: false,
          error: expect.stringContaining('imported and is read-only'),
        }),
      ]),
    )
    expect(await owner.select().from(shipment).where(eq(shipment.orderId, shipped))).toHaveLength(0)
    expect((await orderRow(shipped)).importedFrom).toBe('shopify')
  })
})
