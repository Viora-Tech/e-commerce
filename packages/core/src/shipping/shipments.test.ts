import {
  address,
  createDb,
  order,
  orderLine,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider, type Tracking } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { buildTemplateData } from '../notifications/deliver'
import {
  builtInShippingRegistry,
  encryptShippingSettings,
  estimateForStore,
  maskShippingSettings,
  parseShippingSettings,
  primaryShippingProvider,
  toShippingPolicy,
} from './settings'
import {
  applyTracking,
  cancelShipment,
  createShipmentForOrder,
  listOpenShipments,
} from './shipments'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-settings-secret'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedOrder() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'Waimers',
      shipping: {
        enabled: ['fake'],
        policy: {
          originPincode: '131028',
          warehouse: {
            name: 'Waimers HQ',
            line1: 'Plot 4',
            city: 'Sonipat',
            state: 'HR',
            phone: '9',
          },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
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
      number: 7,
      status: 'open',
      subtotalPaise: 199900,
      totalPaise: 199900,
      paymentMethod: 'cod',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
    })
    .returning()
  if (!o) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'p', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 199900 })
    .returning()
  await owner.insert(orderLine).values({
    storeId: s.id,
    orderId: o.id,
    variantId: v?.id as string,
    title: 'Pad',
    variantTitle: 'Default',
    quantity: 2,
    unitPricePaise: 199900,
  })
  return { storeId: s.id, orderId: o.id }
}

describe('shipping settings', () => {
  it('fills defaults, encrypts tokens and resolves the built-in demo courier', () => {
    const s = parseShippingSettings({
      enabled: ['fake', 'delhivery'],
      providers: { delhivery: { apiToken: 'tok_secret' } },
      policy: { originPincode: '131028' },
    })
    expect(s.policy).toMatchObject({
      cutoff: '14:00',
      workingDays: [1, 2, 3, 4, 5, 6],
      codAllowed: true,
    })
    const enc = encryptShippingSettings(s, secret)
    expect(enc.providers.delhivery?.apiToken).toMatch(/^v1\./)
    expect(maskShippingSettings(s).providers.delhivery?.apiToken).toBe('••••cret')
    expect(primaryShippingProvider(builtInShippingRegistry(), enc, secret)?.id).toBe('fake')
    expect(toShippingPolicy(s).originPincode).toBe('131028')
  })

  it('falls back to defaults on garbage', () => {
    expect(parseShippingSettings({ policy: { cutoff: 'noon' } }).policy.cutoff).toBe('14:00')
  })

  it('estimates through the primary courier', async () => {
    const r = await estimateForStore({
      registry: builtInShippingRegistry(),
      settings: parseShippingSettings({ enabled: ['fake'] }),
      secret,
      pincode: '110 001',
      now: new Date('2026-09-21T10:00:00+05:30'),
    })
    expect(r).toMatchObject({ ok: true, serviceable: true, pincode: '110001', fallback: false })
  })
})

describe('shipments', () => {
  it('books a consignment, records it and marks the order fulfilled', async () => {
    const { storeId, orderId } = await seedOrder()
    const provider = new FakeShippingProvider()
    const captured: unknown[] = []
    const spy = Object.assign(provider, {
      createShipment: async (input: unknown) => {
        captured.push(input)
        return { waybill: 'WB1', providerRef: 'WB1', labelUrl: 'https://l' }
      },
    })
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, spy, orderId),
    )
    expect(row).toMatchObject({ provider: 'fake', waybill: 'WB1', status: 'created' })
    expect(captured[0]).toMatchObject({
      orderNumber: 7,
      paymentMode: 'cod',
      codAmountPaise: 199900,
      // No variant weight and no box preset on this store: falls back to ASSUMED_WEIGHT_GRAMS,
      // not the old per-line multiply (see resolveParcelWeightGrams).
      weightGrams: 500,
      to: { pincode: '560001', state: 'KA' },
      from: { name: 'Waimers HQ', pincode: '131028' },
      lines: [{ title: 'Pad', quantity: 2 }],
    })
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.fulfillmentStatus).toBe('fulfilled')

    // A second call returns the existing consignment instead of booking twice.
    const again = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, spy, orderId),
    )
    expect(again.id).toBe(row.id)
    expect(captured).toHaveLength(1)

    // The shipped notification now carries the waybill.
    const built = await withStore(app, storeId, (tx) => buildTemplateData({ storeId, tx }, orderId))
    expect(built?.data.waybill).toBe('WB1')
  })

  it('sums variant weights when the line has one, else falls back to the default box preset', async () => {
    const { storeId, orderId } = await seedOrder()
    // The seeded variant has no weight; give the store a default box preset.
    await owner
      .update(store)
      .set({
        shipping: {
          enabled: ['fake'],
          policy: { originPincode: '131028' },
          boxPresets: [
            { id: 'b1', name: 'Small', lengthCm: 20, widthCm: 15, heightCm: 10, weightGrams: 300 },
            {
              id: 'b2',
              name: 'Default',
              lengthCm: 30,
              widthCm: 20,
              heightCm: 15,
              weightGrams: 700,
              isDefault: true,
            },
          ],
        },
      })
      .where(eq(store.id, storeId))
    const captured: unknown[] = []
    const provider = Object.assign(new FakeShippingProvider(), {
      createShipment: async (input: { weightGrams: number }) => {
        captured.push(input)
        return { waybill: 'WB2', providerRef: 'WB2' }
      },
    })
    await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId),
    )
    expect((captured[0] as { weightGrams: number }).weightGrams).toBe(700)

    // Now give the variant a real weight: the line sum wins over the box.
    await owner.update(variant).set({ weightGrams: 250 }).where(eq(variant.storeId, storeId))
    const captured2: unknown[] = []
    const provider2 = Object.assign(new FakeShippingProvider(), {
      createShipment: async (input: { weightGrams: number }) => {
        captured2.push(input)
        return { waybill: 'WB3', providerRef: 'WB3' }
      },
    })
    const [existing] = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    await owner
      .update(shipment)
      .set({ status: 'cancelled' })
      .where(eq(shipment.id, existing?.id as string))
    await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider2, orderId),
    )
    // Two units of the seeded line at 250g each.
    expect((captured2[0] as { weightGrams: number }).weightGrams).toBe(500)
  })

  it('applies tracking, flips the order to delivered once, and lists open shipments', async () => {
    const { storeId, orderId } = await seedOrder()
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, new FakeShippingProvider(), orderId),
    )
    expect((await withStore(app, storeId, (tx) => listOpenShipments({ storeId, tx }))).length).toBe(
      1,
    )

    const transit: Tracking = { waybill: row.waybill, status: 'in_transit', events: [] }
    const a = await withStore(app, storeId, (tx) => applyTracking({ storeId, tx }, row.id, transit))
    expect(a.becameDelivered).toBe(false)
    const [moving] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(moving?.fulfillmentStatus).toBe('shipped')

    const delivered: Tracking = {
      waybill: row.waybill,
      status: 'delivered',
      events: [],
      trackingUrl: 'https://t',
    }
    const b = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delivered),
    )
    expect(b.becameDelivered).toBe(true)
    expect(b.shipment.trackingUrl).toBe('https://t')
    const c = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, delivered),
    )
    expect(c.becameDelivered).toBe(false)
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.fulfillmentStatus).toBe('delivered')
    // Cash on delivery not collected yet: delivered, but still open.
    expect(o?.status).toBe('open')
    expect((await withStore(app, storeId, (tx) => listOpenShipments({ storeId, tx }))).length).toBe(
      0,
    )
  })

  it('cancels with the courier and records it', async () => {
    const { storeId, orderId } = await seedOrder()
    const provider = new FakeShippingProvider()
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId),
    )
    const c = await withStore(app, storeId, (tx) =>
      cancelShipment({ storeId, tx }, provider, row.id),
    )
    expect(c.status).toBe('cancelled')
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, row.id))
    expect(s?.status).toBe('cancelled')
  })

  it('reads a courier return (RTO) as returned', async () => {
    const { storeId, orderId } = await seedOrder()
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, new FakeShippingProvider(), orderId),
    )
    await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, { waybill: row.waybill, status: 'rto', events: [] }),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.fulfillmentStatus).toBe('returned')
    expect(o?.status).toBe('open')
  })

  it('refuses an order without an address', async () => {
    const { storeId, orderId } = await seedOrder()
    await owner.update(order).set({ shippingAddressId: null }).where(eq(order.id, orderId))
    await expect(
      withStore(app, storeId, (tx) =>
        createShipmentForOrder({ storeId, tx }, new FakeShippingProvider(), orderId),
      ),
    ).rejects.toThrow('no shipping address')
  })
})
