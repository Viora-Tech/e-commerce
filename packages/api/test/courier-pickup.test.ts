/**
 * A courier that schedules its own pickup at booking (capability `pickup_at_booking`, RapidShyp):
 * a parcel on its pickup is never offered for Create pickup, and "Move back to Booked" is refused,
 * because the courier's pickup can't be undone over its API (owner, 23 Nov 2026). One whose pickup
 * the courier refused at booking has none, and Create pickup offers it. Other couriers keep both.
 */
import { dayKey } from '@commerce/dates'
import { address, createDb, order, shipment, shipmentPickup, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { fakeShippingFactory, ShippingRegistry } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { pickupByCourier, pickupHeldByCourier } from '../src/services/courier-pickup'
import {
  listPickupOptionsForStore,
  listUnpickedForStore,
  schedulePickupForStore,
} from '../src/services/shipments-operations.service'
import { returnStoreShipmentToBooked } from '../src/services/shipping.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-settings-secret'
const plain = new ShippingRegistry().register(fakeShippingFactory)
const selfPickup = new ShippingRegistry().register({
  ...fakeShippingFactory,
  label: 'RapidShyp',
  capabilities: [...fakeShippingFactory.capabilities, 'pickup_at_booking'],
})
const REFUSAL =
  'RapidShyp schedules its own pickup when you book. To stop the pickup, cancel the shipment.'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A store with one booked parcel; `onPickup` puts it on today's scheduled pickup. */
async function seed(onPickup: boolean) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'w',
      shipping: {
        enabled: ['fake'],
        policy: {
          originPincode: '131028',
          warehouse: { name: 'HQ', line1: 'Plot 4', city: 'Sonipat', state: 'HR', phone: '9' },
        },
      },
    })
    .returning()
  const storeId = s?.id as string
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
      number: 42,
      status: 'open',
      subtotalPaise: 1000,
      totalPaise: 1000,
      paymentMethod: 'prepaid',
      email: 'asha@example.com',
      shippingAddressId: a?.id as string,
    })
    .returning()
  const [p] = onPickup
    ? await owner
        .insert(shipmentPickup)
        .values({
          storeId,
          provider: 'fake',
          scheduledFor: dayKey(new Date()),
          timeFrom: '',
          expectedPackageCount: 1,
          pickupLocationName: 'HQ',
          status: 'scheduled',
        })
        .returning()
    : []
  const [sh] = await owner
    .insert(shipment)
    .values({
      storeId,
      orderId: o?.id as string,
      provider: 'fake',
      waybill: 'AWB42',
      weightGrams: 1000,
      pickupId: p?.id ?? null,
    })
    .returning()
  return { storeId, shipmentId: sh?.id as string, pickupId: p?.id ?? null }
}

describe('pickupByCourier', () => {
  it('names the courier only when it schedules its own pickup at booking', () => {
    expect(pickupByCourier(selfPickup, 'fake')).toBe('RapidShyp')
    expect(pickupByCourier(plain, 'fake')).toBeNull()
    expect(pickupByCourier(selfPickup, 'gone')).toBeNull()
    expect(pickupByCourier(undefined, 'fake')).toBeNull()
  })

  it('holds Create pickup back only once the parcel is on a pickup', () => {
    expect(pickupHeldByCourier(selfPickup, 'fake', 'pickup-1')).toBe('RapidShyp')
    expect(pickupHeldByCourier(selfPickup, 'fake', null)).toBeNull()
    expect(pickupHeldByCourier(plain, 'fake', 'pickup-1')).toBeNull()
  })
})

describe('Create pickup never offers a parcel already on its courier-scheduled pickup', () => {
  it('offers one whose pickup the courier refused at booking (no pickup yet)', async () => {
    const t = await seed(false)
    const unpicked = await withStore(app, t.storeId, (tx) =>
      listUnpickedForStore(tx, t.storeId, selfPickup),
    )
    expect(unpicked.map((u) => u.id)).toEqual([t.shipmentId])
  })

  it('leaves it out of the Pickups picker and the Create pickup drawer, and refuses the request', async () => {
    const t = await seed(true)
    const unpicked = await withStore(app, t.storeId, (tx) =>
      listUnpickedForStore(tx, t.storeId, selfPickup),
    )
    expect(unpicked).toEqual([])
    const options = await withStore(app, t.storeId, (tx) =>
      listPickupOptionsForStore(tx, t.storeId, selfPickup, secret, [t.shipmentId]),
    )
    expect(options.groups).toEqual([])
    await expect(
      withStore(app, t.storeId, (tx) =>
        schedulePickupForStore(tx, t.storeId, selfPickup, secret, {
          shipmentIds: [t.shipmentId],
          date: dayKey(new Date()),
          timeFrom: '14:00',
        }),
      ),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', message: /RapidShyp schedules/ })
    expect(
      (await owner.select().from(shipment).where(eq(shipment.id, t.shipmentId)))[0]?.pickupId,
    ).toBe(t.pickupId)
  })

  it('still offers the same parcel for a courier that takes pickup requests', async () => {
    const t = await seed(false)
    const unpicked = await withStore(app, t.storeId, (tx) =>
      listUnpickedForStore(tx, t.storeId, plain),
    )
    expect(unpicked.map((u) => u.id)).toEqual([t.shipmentId])
  })
})

describe('Move back to Booked', () => {
  it('is refused for a courier-scheduled pickup, and the parcel stays on it', async () => {
    const t = await seed(true)
    await expect(
      withStore(app, t.storeId, (tx) =>
        returnStoreShipmentToBooked(tx, t.storeId, selfPickup, t.shipmentId),
      ),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', message: REFUSAL })
    const [row] = await owner.select().from(shipment).where(eq(shipment.id, t.shipmentId))
    expect(row?.pickupId).toBe(t.pickupId)
  })

  it('still works for other couriers', async () => {
    const t = await seed(true)
    await withStore(app, t.storeId, (tx) =>
      returnStoreShipmentToBooked(tx, t.storeId, plain, t.shipmentId),
    )
    const [row] = await owner.select().from(shipment).where(eq(shipment.id, t.shipmentId))
    expect(row?.pickupId).toBeNull()
  })
})
