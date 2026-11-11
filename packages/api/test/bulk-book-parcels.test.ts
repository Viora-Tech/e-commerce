/** Bulk Create shipment on a cart checkout split across locations: each parcel books on the
 *  courier checkout quoted for it (`OrderDeliveryRoute.parcels`), not the order's first route. */
import { saveDeliveryOption, saveParcelIds } from '@commerce/core'
import {
  address,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  location,
  type OrderDeliveryParcelRoute,
  type OrderDeliveryRoute,
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

const route = (serviceId: string, carrier: string) => ({
  key: `fake:${serviceId}`,
  providerId: 'fake',
  channel: 'aggregator' as const,
  carrier,
  serviceId,
  serviceLabel: `${carrier} service`,
})

const parcelRoute = (
  locationId: string,
  r: ReturnType<typeof route>,
  insured: boolean,
): OrderDeliveryParcelRoute => ({
  locationId,
  onHold: false,
  route: r,
  insured,
  insurancePaise: insured ? 4000 : null,
  markupPaise: 0,
  courierCostPaise: 9000,
  promisedEarliest: '2026-11-15',
  promisedLatest: '2026-11-16',
})

/** An order split across Delhi and Mumbai: Delhi on Blue Dart (insured), Mumbai on DTDC. */
async function seedSplitOrder(sameLocation = false) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'Waimers',
      apps: { installed: ['delivery-options'] },
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
  const option = await withStore(app, s.id, (tx) =>
    saveDeliveryOption(tx, s.id, null, { name: 'Standard' }),
  )
  const [delhi, mumbai] = await owner
    .insert(location)
    .values([
      { storeId: s.id, name: 'Delhi', isDefault: true, fulfilsOnlineOrders: true },
      { storeId: s.id, name: 'Mumbai', fulfilsOnlineOrders: true },
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
  // Same place: the second is a pre-order parcel, since released (no longer on hold).
  const at2 = (sameLocation ? delhi?.id : mumbai?.id) as string
  const parcels = [
    parcelRoute(delhi?.id as string, route('20', 'Blue Dart'), true),
    { ...parcelRoute(at2, route('30', 'DTDC'), false), onHold: sameLocation },
  ]
  const [first] = parcels
  const delivery: OrderDeliveryRoute = {
    optionId: option.id,
    optionName: 'Standard',
    route: first?.route ?? null,
    pickedBy: 'strategy',
    insured: true,
    insurancePaise: 4000,
    markupPaise: 0,
    courierCostPaise: 9000,
    promisedEarliest: '2026-11-15',
    promisedLatest: '2026-11-16',
    quoteSource: 'live',
    parcels,
  }
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 7,
      status: 'open',
      subtotalPaise: 200000,
      totalPaise: 200000,
      paymentMethod: 'prepaid',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
      shipping: {
        rateId: option.id,
        rateName: 'Standard',
        zoneId: '',
        zoneName: '',
        listPricePaise: 0,
        pricePaise: 0,
        codSurchargePaise: null,
        minTransitDays: null,
        maxTransitDays: null,
        delivery,
      },
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'p', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 100000 })
    .returning()
  const lines = await owner
    .insert(orderLine)
    .values(
      [1, 2].map((n) => ({
        storeId: s.id,
        orderId: o?.id as string,
        variantId: v?.id as string,
        title: `Pad ${n}`,
        variantTitle: 'Default',
        quantity: 1,
        unitPricePaise: 100000,
      })),
    )
    .returning()
  const fos = await owner
    .insert(fulfillmentOrder)
    .values(
      [delhi, sameLocation ? delhi : mumbai].map((l, i) => ({
        storeId: s.id,
        orderId: o?.id as string,
        locationId: l?.id as string,
        position: i + 1,
        totalPaise: 100000,
      })),
    )
    .returning()
  await owner.insert(fulfillmentOrderLine).values(
    fos.map((fo, i) => ({
      storeId: s.id,
      fulfillmentOrderId: fo.id,
      orderLineId: lines[i]?.id as string,
      quantity: 1,
    })),
  )
  // Placing the order stamped each route with its parcel, the second still on hold then.
  await withStore(app, s.id, (tx) =>
    saveParcelIds(
      tx,
      o?.id as string,
      fos.map((fo, i) => ({
        id: fo.id,
        locationId: fo.locationId,
        status: sameLocation && i === 1 ? 'on_hold' : 'open',
      })),
    ),
  )
  return { storeId: s.id, orderId: o?.id as string, delhi: fos[0]?.id, mumbai: fos[1]?.id }
}

describe('bulk booking a split cart', () => {
  it('books each parcel on the courier checkout quoted for it', async () => {
    const { storeId, orderId, delhi, mumbai } = await seedSplitOrder()
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, { orderIds: [orderId] }),
    )
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.map((r) => r.fulfillmentOrderId)).toEqual([delhi, mumbai])
    expect(booked.map((b) => b.serviceId)).toEqual(['20', '30'])
    const rows = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    const byParcel = new Map(rows.map((r) => [r.fulfillmentOrderId, r]))
    expect(byParcel.get(delhi ?? null)).toMatchObject({ carrier: 'Blue Dart', insured: true })
    expect(byParcel.get(mumbai ?? null)).toMatchObject({ carrier: 'DTDC', insured: false })
  })

  it('a released pre-order parcel at the same place keeps its own route', async () => {
    const { storeId, orderId, delhi, mumbai: preorder } = await seedSplitOrder(true)
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, { orderIds: [orderId] }),
    )
    expect(results.map((r) => [r.fulfillmentOrderId, r.ok])).toEqual([
      [delhi, true],
      [preorder, true],
    ])
    const rows = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    const byParcel = new Map(rows.map((r) => [r.fulfillmentOrderId, r]))
    expect(byParcel.get(delhi ?? null)).toMatchObject({ carrier: 'Blue Dart', insured: true })
    expect(byParcel.get(preorder ?? null)).toMatchObject({ carrier: 'DTDC', insured: false })
  })

  it('the parcel the merchant quoted books alone, on its own route', async () => {
    const { storeId, orderId, mumbai } = await seedSplitOrder()
    const results = await withStore(app, storeId, (tx) =>
      bulkBookShipments(tx, storeId, registry, secret, {
        orderIds: [orderId],
        parcelIds: { [orderId]: mumbai as string },
      }),
    )
    expect(results).toEqual([expect.objectContaining({ ok: true, fulfillmentOrderId: mumbai })])
    expect(booked.map((b) => b.serviceId)).toEqual(['30'])
    const rows = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    expect(rows).toEqual([
      expect.objectContaining({ fulfillmentOrderId: mumbai, carrier: 'DTDC', insured: false }),
    ])
  })
})
