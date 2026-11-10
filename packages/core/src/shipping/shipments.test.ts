import {
  address,
  courierOrder,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  shipment,
  shipmentManifest,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider, type Tracking } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { buildTemplateData } from '../notifications/deliver'
import { pushPendingOrders } from './order-push'
import { schedulePickup } from './pickup'
import {
  builtInShippingRegistry,
  encryptShippingSettings,
  estimateForStore,
  maskShippingSettings,
  parseShippingSettings,
  primaryShippingProvider,
  toShippingPolicy,
} from './settings'
import { cancelShipment, rebookableParcels } from './shipment-cancel'
import { applyTracking, createShipmentForOrder, listOpenShipments } from './shipments'

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
    expect(enc.providers.delhivery?.apiToken).toMatch(/^v2\./)
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

  it('weighs the products (500 g when unknown) plus the box packing', async () => {
    const { storeId, orderId } = await seedOrder()
    // The seeded variant has no weight; the store's main box has 700 g of packing.
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
    // Unknown products count as 500 g, plus the main box's 700 g packing.
    expect((captured[0] as { weightGrams: number }).weightGrams).toBe(1200)

    // Now give the variant a real weight: the line sum replaces the 500 g guess.
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
    // Two units of the seeded line at 250 g each, plus the 700 g packing.
    expect((captured2[0] as { weightGrams: number }).weightGrams).toBe(1200)
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
    const cancelled: string[] = []
    provider.cancel = async (waybill: string) => {
      cancelled.push(waybill)
    }
    const c = await withStore(app, storeId, (tx) =>
      cancelShipment({ storeId, tx }, provider, row.id, { author: 'kuldeep@example.com' }),
    )
    expect(c.status).toBe('cancelled')
    expect(cancelled).toEqual([row.waybill])
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, row.id))
    expect(s?.status).toBe('cancelled')
    // The timeline says who cancelled which AWB.
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes).toHaveLength(1)
    expect(notes[0]?.body).toContain(row.waybill)
    expect(notes[0]?.author).toBe('kuldeep@example.com')
  })

  it('refuses a cancel once the parcel left, is on a manifest, or the courier has no cancel', async () => {
    const { storeId, orderId } = await seedOrder()
    const provider = new FakeShippingProvider()
    let asked = 0
    provider.cancel = async () => {
      asked++
    }
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId),
    )
    const cancel = (opts = {}) =>
      withStore(app, storeId, (tx) => cancelShipment({ storeId, tx }, provider, row.id, opts))

    await expect(cancel({ courierCancels: false })).rejects.toMatchObject({
      code: 'SHIPMENT_NOT_CANCELLABLE',
      block: 'not_supported',
    })

    const [m] = await owner
      .insert(shipmentManifest)
      .values({ storeId, provider: 'fake', shipmentIds: [row.id] })
      .returning()
    await expect(cancel()).rejects.toMatchObject({ block: 'in_manifest' })
    await owner.delete(shipmentManifest).where(eq(shipmentManifest.id, m?.id as string))

    await owner.update(shipment).set({ status: 'picked_up' }).where(eq(shipment.id, row.id))
    await expect(cancel()).rejects.toMatchObject({ block: 'picked_up' })
    // Refused before the courier was ever asked.
    expect(asked).toBe(0)
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, row.id))
    expect(s?.status).toBe('picked_up')
  })

  it('a cancelled label frees the parcel: it books again with the packed units', async () => {
    const { storeId, orderId } = await seedOrder()
    const provider = new FakeShippingProvider()
    const first = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId),
    )
    expect(first.fulfillmentOrderId).not.toBeNull()
    await withStore(app, storeId, (tx) => cancelShipment({ storeId, tx }, provider, first.id))
    expect(await withStore(app, storeId, (tx) => rebookableParcels(tx, orderId))).toEqual(
      new Set([first.fulfillmentOrderId]),
    )

    const captured: Array<{ lines: Array<{ quantity: number }> }> = []
    const again = Object.assign(new FakeShippingProvider(), {
      createShipment: async (input: { lines: Array<{ quantity: number }> }) => {
        captured.push(input)
        return { waybill: 'WB-AGAIN', providerRef: 'WB-AGAIN' }
      },
    })
    // Booking the same parcel by id carries the two packed units, not "nothing left to ship".
    const second = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, again, orderId, {
        fulfillmentOrderId: first.fulfillmentOrderId as string,
      }),
    )
    expect(second.waybill).toBe('WB-AGAIN')
    expect(captured[0]?.lines.map((l) => l.quantity)).toEqual([2])
    expect(await withStore(app, storeId, (tx) => rebookableParcels(tx, orderId))).toEqual(new Set())
  })

  it('keeps the booking facts, and a keyed label points at the admin route', async () => {
    const { storeId, orderId } = await seedOrder()
    const provider = Object.assign(new FakeShippingProvider(), {
      createShipment: async () => ({
        waybill: 'DL1',
        providerRef: 'DL1',
        labelViaProvider: true,
      }),
    })
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId, {
        paymentMode: 'cod',
        codAmountPaise: 150000,
        serviceLabel: 'Surface',
      }),
    )
    expect(row.labelUrl).toBe(`/api/shipments/${row.id}/label`)
    expect(row).toMatchObject({
      paymentMode: 'cod',
      codAmountPaise: 150000,
      pickupLocationName: 'Waimers HQ',
      serviceLabel: 'Surface',
    })
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

describe('pickup requests', () => {
  /** A courier that takes pickup requests, recording each one; `fail` makes it refuse. */
  const pickupCourier = (asked: unknown[], fail = false) =>
    Object.assign(new FakeShippingProvider(), {
      defaultPickupLocationName: 'Waimers Sonipat',
      schedulePickup: async (input: unknown) => {
        asked.push(input)
        if (fail) throw new Error('Delhivery has no pickup location named "Waimers Sonipat"')
        return { providerPickupId: `PR${asked.length}` }
      },
    })

  it('asks once per place and day; a second booking that day joins the open request', async () => {
    const { storeId, orderId } = await seedOrder()
    const asked: unknown[] = []
    const courier = pickupCourier(asked)
    const first = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, courier, orderId),
    )
    // The courier's own pickup location is what the booking (and so the pickup) names.
    expect(first.pickupLocationName).toBe('Waimers Sonipat')
    const pickup = await withStore(app, storeId, (tx) =>
      schedulePickup({ storeId, tx }, courier, {
        shipmentIds: [first.id],
        date: '2026-10-27',
        timeFrom: '14:00',
        pickupLocationName: '',
      }),
    )
    expect(pickup).toMatchObject({
      status: 'scheduled',
      providerRef: 'PR1',
      pickupLocationName: 'Waimers Sonipat',
      expectedPackageCount: 1,
    })
    expect(asked[0]).toMatchObject({
      pickupLocationName: 'Waimers Sonipat',
      expectedPackageCount: 1,
    })

    // A second parcel the same day: no new request, the open one counts it.
    await owner.update(shipment).set({ status: 'cancelled' }).where(eq(shipment.id, first.id))
    const second = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, courier, orderId),
    )
    const joined = await withStore(app, storeId, (tx) =>
      schedulePickup({ storeId, tx }, courier, {
        shipmentIds: [second.id],
        date: '2026-10-27',
        timeFrom: '15:00',
        pickupLocationName: 'Waimers Sonipat',
      }),
    )
    expect(asked).toHaveLength(1)
    expect(joined.id).toBe(pickup.id)
    expect(joined.expectedPackageCount).toBe(2)
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, second.id))
    expect(s?.pickupId).toBe(pickup.id)
  })

  it('a refused request is recorded as failed and leaves the parcel free to request again', async () => {
    const { storeId, orderId } = await seedOrder()
    const asked: unknown[] = []
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, pickupCourier(asked), orderId),
    )
    const failed = await withStore(app, storeId, (tx) =>
      schedulePickup({ storeId, tx }, pickupCourier(asked, true), {
        shipmentIds: [row.id],
        date: '2026-10-27',
        timeFrom: '14:00',
        pickupLocationName: '',
      }),
    )
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('no pickup location')
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, row.id))
    expect(s?.pickupId).toBeNull()
    // A failed request is not "open": the retry asks the courier again.
    const retried = await withStore(app, storeId, (tx) =>
      schedulePickup({ storeId, tx }, pickupCourier(asked), {
        shipmentIds: [row.id],
        date: '2026-10-27',
        timeFrom: '14:00',
        pickupLocationName: '',
      }),
    )
    expect(retried.status).toBe('scheduled')
    expect(asked).toHaveLength(2)
  })
})

describe('order push', () => {
  it('sends a new order once as a pending order, then books that same order', async () => {
    const { storeId, orderId } = await seedOrder()
    const pushes: unknown[] = []
    const bookings: { pushed?: unknown }[] = []
    const courier = Object.assign(new FakeShippingProvider(), {
      pushOrder: async (input: unknown) => {
        pushes.push(input)
        return { externalOrderId: 'SR-1', externalShipmentId: 'SH-1' }
      },
      createShipment: async (input: { pushed?: unknown }) => {
        bookings.push(input)
        return { waybill: 'WB9', providerRef: 'SH-1' }
      },
    })
    const settings = parseShippingSettings({
      enabled: ['fake'],
      policy: {
        originPincode: '131028',
        warehouse: { name: 'HQ', line1: 'Plot 4', city: 'Sonipat', state: 'HR', phone: '9' },
      },
    })
    const push = () =>
      withStore(app, storeId, (tx) =>
        pushPendingOrders({ storeId, tx }, [courier], settings, 'Waimers'),
      )
    expect(await push()).toEqual({ pushed: 1, failed: 0 })
    expect(pushes[0]).toMatchObject({
      orderNumber: 7,
      paymentMode: 'cod',
      to: { pincode: '560001' },
    })
    // Already sent: not sent again.
    expect(await push()).toEqual({ pushed: 0, failed: 0 })

    await withStore(app, storeId, (tx) => createShipmentForOrder({ storeId, tx }, courier, orderId))
    expect(bookings[0]?.pushed).toEqual({ externalOrderId: 'SR-1', externalShipmentId: 'SH-1' })
    const [row] = await owner.select().from(courierOrder).where(eq(courierOrder.orderId, orderId))
    expect(row?.status).toBe('booked')
  })
})

/** An order placed on Express · Blue Dart Air via the courier `fake`, insured. */
async function saveExpressRoute(orderId: string) {
  await owner
    .update(order)
    .set({
      shipping: {
        rateId: 'opt-express',
        rateName: 'Express · Blue Dart',
        zoneId: '',
        zoneName: '',
        listPricePaise: 18000,
        pricePaise: 18000,
        codSurchargePaise: null,
        minTransitDays: null,
        maxTransitDays: null,
        delivery: {
          optionId: 'opt-express',
          optionName: 'Express',
          route: {
            key: 'fake:20',
            providerId: 'fake',
            channel: 'aggregator',
            carrier: 'Blue Dart',
            serviceId: '20',
            serviceLabel: 'Bluedart Air',
          },
          pickedBy: 'shopper',
          insured: true,
          insurancePaise: 4000,
          markupPaise: 0,
          courierCostPaise: 12800,
          promisedEarliest: '2026-10-30',
          promisedLatest: '2026-10-30',
          quoteSource: 'live',
        },
      },
    })
    .where(eq(order.id, orderId))
}

describe('delivery options: booking the route saved at checkout', () => {
  it('books the saved service, keeps its insurance and records the carrier', async () => {
    const { storeId, orderId } = await seedOrder()
    await saveExpressRoute(orderId)
    const captured: Array<Record<string, unknown>> = []
    const spy = Object.assign(new FakeShippingProvider(), {
      createShipment: async (input: Record<string, unknown>) => {
        captured.push(input)
        return { waybill: 'BD1', providerRef: 'BD1' }
      },
    })
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, spy, orderId, {
        serviceId: '20',
        serviceLabel: 'Bluedart Air',
      }),
    )
    expect(captured[0]).toMatchObject({ serviceId: '20', insured: true })
    expect(row).toMatchObject({ provider: 'fake', carrier: 'Blue Dart', insured: true })

    // The delivered scan's time is kept for promised vs delivered.
    const tracked = await withStore(app, storeId, (tx) =>
      applyTracking({ storeId, tx }, row.id, {
        waybill: 'BD1',
        status: 'delivered',
        events: [{ at: '2026-10-30T09:15:00Z', status: 'delivered', description: 'Delivered' }],
      }),
    )
    expect(tracked.shipment.deliveredAt?.toISOString()).toBe('2026-10-30T09:15:00.000Z')
  })

  it('a route booked on purpose instead of the saved one is noted on the order', async () => {
    const { storeId, orderId } = await seedOrder()
    await saveExpressRoute(orderId)
    const spy = Object.assign(new FakeShippingProvider(), {
      createShipment: async () => ({ waybill: 'DL1', providerRef: 'DL1' }),
    })
    await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, spy, orderId, {
        serviceId: 'S',
        serviceLabel: 'Surface',
      }),
    )
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toContainEqual(
      expect.stringContaining('instead of the route chosen at checkout: Blue Dart Bluedart Air'),
    )
  })
})
