import {
  address,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  shipmentPickup,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { type CreateShipmentResult, FakeShippingProvider } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bookedCourier, COURIER_SLOT } from './booking-truth'
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

const rapidshyp = { id: 'rapidshyp', label: 'RapidShyp' }

describe('bookedCourier', () => {
  it('keeps the pick and its quote when the courier booked what was asked', () => {
    expect(
      bookedCourier(
        rapidshyp,
        {
          serviceId: 'AMZS',
          serviceLabel: 'Amazon Shipping Surface (RapidShyp)',
          quotedChargePaise: 12385,
        },
        { bookedService: { id: 'amzs', label: 'Amazon Shipping Surface' } },
      ),
    ).toEqual({
      serviceLabel: 'Amazon Shipping Surface (RapidShyp)',
      carrier: null,
      courierChargePaise: 12385,
      swapped: null,
    })
  })

  it('records the courier booked instead, and drops the other courier’s quote (#2082)', () => {
    const truth = bookedCourier(
      rapidshyp,
      {
        serviceId: 'AMZS',
        serviceLabel: 'Amazon Shipping Surface (RapidShyp)',
        quotedChargePaise: 12385,
      },
      { bookedService: { id: 'BDS', label: 'Blue Dart Surface' } },
    )
    expect(truth).toMatchObject({
      serviceLabel: 'Blue Dart Surface (RapidShyp)',
      courierChargePaise: null,
      swapped: { asked: 'Amazon Shipping Surface (RapidShyp)', booked: 'Blue Dart Surface' },
    })
    expect(truth.carrier).toMatch(/blue dart/i)
  })

  it('never saves the quote of a courier whose quote is not its bill (RapidShyp, #2088)', () => {
    const truth = bookedCourier(
      { ...rapidshyp, quoteIsCharge: false },
      { serviceId: 'BDS', serviceLabel: 'Blue Dart Surface (RapidShyp)', quotedChargePaise: 14163 },
      { bookedService: { id: 'BDS', label: 'Blue Dart Surface' } },
    )
    expect(truth).toMatchObject({ courierChargePaise: null, swapped: null })
    // Its own booking answer, were it ever to carry one, is still saved.
    expect(
      bookedCourier(
        { ...rapidshyp, quoteIsCharge: false },
        { quotedChargePaise: 14163 },
        {
          chargePaise: 7447,
        },
      ).courierChargePaise,
    ).toBe(7447)
  })

  it('names the courier an aggregator chose when none was picked, without a swap note', () => {
    const truth = bookedCourier(
      { id: 'shiprocket', label: 'Shiprocket', quoteIsCharge: false },
      {},
      { bookedService: { id: '217', label: 'Blue Dart Surface' }, chargePaise: 7447 },
    )
    expect(truth).toMatchObject({
      serviceLabel: 'Blue Dart Surface (Shiprocket)',
      courierChargePaise: 7447,
      swapped: null,
    })
    expect(truth.carrier).toMatch(/blue dart/i)
  })

  it('never keeps the quote of a courier whose quote is not its bill (Shiprocket)', () => {
    expect(
      bookedCourier(
        { id: 'shiprocket', label: 'Shiprocket', quoteIsCharge: false },
        {
          serviceId: '217',
          serviceLabel: 'Blue Dart Surface (Shiprocket)',
          quotedChargePaise: 9900,
        },
        { bookedService: { id: '217', label: 'Blue Dart Surface' } },
      ).courierChargePaise,
    ).toBeNull()
  })

  it('takes the charge in the courier’s own answer over any quote', () => {
    expect(
      bookedCourier(rapidshyp, { serviceId: 'A', quotedChargePaise: 100 }, { chargePaise: 15000 })
        .courierChargePaise,
    ).toBe(15000)
  })
})

async function seedOrder(number = 2082) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: `w${number}`,
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
  return { storeId: s.id, orderId: await seedOrderIn(s.id, number) }
}

async function seedOrderIn(storeId: string, number: number) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
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
      storeId,
      number,
      status: 'open',
      subtotalPaise: 99900,
      totalPaise: 99900,
      paymentMethod: 'prepaid',
      shippingAddressId: a?.id,
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `wrist-${number}`, title: 'Wrist rest', status: 'active' })
    .returning()
  // The product's own box is 37 x 14 x 4 cm; the merchant packs it in another one.
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'Default',
      pricePaise: 99900,
      weightGrams: 410,
      packageLengthCm: 37,
      packageWidthCm: 14,
      packageHeightCm: 4,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    title: 'Wrist rest',
    variantTitle: 'Default',
    quantity: 1,
    unitPricePaise: 99900,
  })
  return o?.id as string
}

/** A courier that books whatever `answer` says, and keeps what it was sent. */
function courier(answer: Partial<CreateShipmentResult>) {
  const sent: Array<Record<string, unknown>> = []
  const provider = Object.assign(new FakeShippingProvider(), {
    createShipment: async (input: Record<string, unknown>) => {
      sent.push(input)
      return { waybill: `AWB-${sent.length}`, providerRef: 'r', ...answer }
    },
  })
  return { provider, sent }
}

const PICK = {
  serviceId: 'AMZS',
  serviceLabel: 'Amazon Shipping Surface (RapidShyp)',
  quotedChargePaise: 12385,
  weightGrams: 510,
  dimensionsCm: { length: 20, width: 20, height: 5 },
}

describe('createShipmentForOrder records what the courier booked', () => {
  it('sends and stores the weight and box the merchant saw, and the quote as its charge', async () => {
    const { storeId, orderId } = await seedOrder()
    const { provider, sent } = courier({})
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId, PICK),
    )
    expect(sent[0]).toMatchObject({
      weightGrams: 510,
      dimensionsCm: { length: 20, width: 20, height: 5 },
      serviceId: 'AMZS',
    })
    expect(row).toMatchObject({
      weightGrams: 510,
      lengthCm: 20,
      widthCm: 20,
      heightCm: 5,
      serviceLabel: 'Amazon Shipping Surface (RapidShyp)',
      courierChargePaise: 12385,
      pickupId: null,
    })
  })

  it('names the courier booked instead, leaves the charge empty and notes it on the order', async () => {
    const { storeId, orderId } = await seedOrder()
    const { provider } = courier({ bookedService: { id: 'BDS', label: 'Blue Dart Surface' } })
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId, PICK),
    )
    expect(row.serviceLabel).toBe(`Blue Dart Surface (${provider.label})`)
    expect(row.courierChargePaise).toBeNull()
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body).join(' ')).toMatch(/booked Blue Dart Surface instead of Amazon/)
  })

  it('puts a parcel whose pickup the courier scheduled at booking on a scheduled pickup', async () => {
    const { storeId, orderId } = await seedOrder()
    const second = await seedOrderIn(storeId, 2083)
    const { provider } = courier({ pickupScheduled: true })
    const first = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId, PICK),
    )
    const next = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, second, PICK),
    )
    expect(first.pickupId).not.toBeNull()
    // The same courier, place and day share one pickup, so To be picked up lists both.
    expect(next.pickupId).toBe(first.pickupId)
    const [pickup] = await owner
      .select()
      .from(shipmentPickup)
      .where(eq(shipmentPickup.id, first.pickupId as string))
    expect(pickup).toMatchObject({
      status: 'scheduled',
      timeFrom: COURIER_SLOT,
      expectedPackageCount: 2,
      provider: provider.id,
    })
  })
})
