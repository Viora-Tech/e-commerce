/**
 * #1775: a parcel on a pickup (or only on a printed manifest) can be taken off it, either back to
 * Booked with its label live, or with the AWB cancelled so the order is back in To book with its
 * items packed. The pickup's parcel count follows, and a parcel the courier has collected stays.
 */
import {
  address,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  shipment,
  shipmentManifest,
  shipmentPickup,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createManifest, listUnpickedShipments, schedulePickup } from './pickup'
import {
  cancelShipment,
  PickupScheduledByCourier,
  rebookableParcels,
  returnShipmentToBooked,
} from './shipment-cancel'
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

let seeded = 0

/** An open COD order of two pads, shipping from Sonipat (a store of its own each time). */
async function seedOrder() {
  seeded++
  const [s] = await owner
    .insert(store)
    .values({
      slug: `w${seeded}`,
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

/** A Delhivery-like courier: takes pickup requests and cancels, recording each AWB it cancels. */
function courier() {
  const cancelled: string[] = []
  const provider = Object.assign(new FakeShippingProvider(), {
    defaultPickupLocationName: 'Waimers Sonipat',
    schedulePickup: async () => ({ providerPickupId: 'PR1' }),
  })
  provider.cancel = async (waybill: string) => {
    cancelled.push(waybill)
  }
  return { provider, cancelled }
}

/** A booked parcel put on a pickup (and its manifest) for a future day. */
async function bookOnPickup() {
  const { storeId, orderId } = await seedOrder()
  const { provider, cancelled } = courier()
  const row = await withStore(app, storeId, (tx) =>
    createShipmentForOrder({ storeId, tx }, provider, orderId),
  )
  const pickup = await withStore(app, storeId, (tx) =>
    schedulePickup({ storeId, tx }, provider, {
      shipmentIds: [row.id],
      date: '2099-10-27',
      timeFrom: '14:00',
      pickupLocationName: '',
    }),
  )
  const manifest = await withStore(app, storeId, (tx) =>
    createManifest({ storeId, tx }, provider, { pickupId: pickup.id }),
  )
  return { storeId, orderId, provider, cancelled, row, pickup, manifest }
}

const pickupOf = async (id: string) =>
  (await owner.select().from(shipmentPickup).where(eq(shipmentPickup.id, id)))[0]
const manifestOf = async (id: string) =>
  (await owner.select().from(shipmentManifest).where(eq(shipmentManifest.id, id)))[0]
const shipmentOf = async (id: string) =>
  (await owner.select().from(shipment).where(eq(shipment.id, id)))[0]

describe('taking a parcel off its pickup (#1775)', () => {
  it('back to Booked: leaves the pickup and manifest, the label stays, the count drops', async () => {
    const t = await bookOnPickup()
    expect((await pickupOf(t.pickup.id))?.expectedPackageCount).toBe(1)

    await withStore(app, t.storeId, (tx) =>
      returnShipmentToBooked({ storeId: t.storeId, tx }, t.row.id, { author: 'staff@example.com' }),
    )
    const s = await shipmentOf(t.row.id)
    expect(s).toMatchObject({ status: 'created', pickupId: null })
    expect(t.cancelled).toEqual([])
    expect((await manifestOf(t.manifest.id))?.shipmentIds).toEqual([])
    expect((await pickupOf(t.pickup.id))?.expectedPackageCount).toBe(0)
    // Free for another day's pickup.
    const waiting = await withStore(app, t.storeId, (tx) =>
      listUnpickedShipments({ storeId: t.storeId, tx }),
    )
    expect(waiting.map((w) => w.id)).toContain(t.row.id)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, t.orderId))
    expect(notes.at(-1)).toMatchObject({ author: 'staff@example.com' })
    expect(notes.at(-1)?.body).toContain(t.row.waybill)
  })

  it('back to To book: the courier cancels the AWB, the items stay packed to book again', async () => {
    const t = await bookOnPickup()
    await withStore(app, t.storeId, (tx) =>
      cancelShipment({ storeId: t.storeId, tx }, t.provider, t.row.id, { keepPacked: true }),
    )
    expect(t.cancelled).toEqual([t.row.providerRef || t.row.waybill])
    expect(await shipmentOf(t.row.id)).toMatchObject({ status: 'cancelled', pickupId: null })
    expect((await manifestOf(t.manifest.id))?.shipmentIds).toEqual([])
    expect((await pickupOf(t.pickup.id))?.expectedPackageCount).toBe(0)
    expect(await withStore(app, t.storeId, (tx) => rebookableParcels(tx, t.orderId))).toEqual(
      new Set([t.row.fulfillmentOrderId]),
    )
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, t.orderId))
    expect(notes.at(-1)?.body).toContain('stay packed')
  })

  it('a parcel only on a printed manifest (no pickup) can go back to Booked too', async () => {
    const { storeId, orderId } = await seedOrder()
    const { provider } = courier()
    const row = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId),
    )
    const manifest = await withStore(app, storeId, (tx) =>
      createManifest({ storeId, tx }, provider, { shipmentIds: [row.id] }),
    )
    await withStore(app, storeId, (tx) => returnShipmentToBooked({ storeId, tx }, row.id))
    expect((await manifestOf(manifest.id))?.shipmentIds).toEqual([])
  })

  it('refuses a parcel on no pickup or manifest, and one the courier has collected', async () => {
    const { storeId, orderId } = await seedOrder()
    const { provider } = courier()
    const loose = await withStore(app, storeId, (tx) =>
      createShipmentForOrder({ storeId, tx }, provider, orderId),
    )
    await expect(
      withStore(app, storeId, (tx) => returnShipmentToBooked({ storeId, tx }, loose.id)),
    ).rejects.toMatchObject({ code: 'SHIPMENT_NOT_ON_PICKUP' })

    const t = await bookOnPickup()
    await owner.update(shipment).set({ status: 'picked_up' }).where(eq(shipment.id, t.row.id))
    await expect(
      withStore(app, t.storeId, (tx) =>
        returnShipmentToBooked({ storeId: t.storeId, tx }, t.row.id),
      ),
    ).rejects.toMatchObject({ code: 'SHIPMENT_NOT_CANCELLABLE', block: 'picked_up' })
    await expect(
      withStore(app, t.storeId, (tx) =>
        cancelShipment({ storeId: t.storeId, tx }, t.provider, t.row.id, { keepPacked: true }),
      ),
    ).rejects.toMatchObject({ block: 'picked_up' })
    // Nothing moved and the courier was never asked.
    expect(t.cancelled).toEqual([])
    expect((await shipmentOf(t.row.id))?.pickupId).toBe(t.pickup.id)
    expect((await manifestOf(t.manifest.id))?.shipmentIds).toEqual([t.row.id])
    expect((await pickupOf(t.pickup.id))?.expectedPackageCount).toBe(1)
  })
})

describe('a courier that schedules its own pickup at booking (owner, 23 Nov 2026)', () => {
  it('refuses Move back to Booked and leaves the parcel on its pickup; Cancel shipment still works', async () => {
    const t = await bookOnPickup()
    const err = await withStore(app, t.storeId, (tx) =>
      returnShipmentToBooked({ storeId: t.storeId, tx }, t.row.id, {
        pickupByCourier: 'RapidShyp',
      }),
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PickupScheduledByCourier)
    expect(err).toMatchObject({
      code: 'SHIPMENT_ACTION_REFUSED',
      message:
        'RapidShyp schedules its own pickup when you book. To stop the pickup, cancel the shipment.',
    })
    expect((await shipmentOf(t.row.id))?.pickupId).toBe(t.pickup.id)
    expect((await manifestOf(t.manifest.id))?.shipmentIds).toEqual([t.row.id])
    expect((await pickupOf(t.pickup.id))?.expectedPackageCount).toBe(1)

    await withStore(app, t.storeId, (tx) =>
      cancelShipment({ storeId: t.storeId, tx }, t.provider, t.row.id, { keepPacked: true }),
    )
    expect(t.cancelled).toEqual([t.row.providerRef || t.row.waybill])
    expect(await shipmentOf(t.row.id)).toMatchObject({ status: 'cancelled', pickupId: null })
  })
})
