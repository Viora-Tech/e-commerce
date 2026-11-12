/** The Create pickup drawer's data (Figma 905:8280, 906:8464): per courier and place, the booked
 *  parcels still without a pickup and the pickups already booked there from today on. */
import { dayKey } from '@commerce/dates'
import { address, createDb, order, shipment, shipmentPickup, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { fakeShippingFactory, ShippingRegistry } from '@commerce/shipping'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { listPickupOptionsForStore } from '../src/services/shipments-operations.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-settings-secret'
const registry = new ShippingRegistry().register(fakeShippingFactory)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY_MS = 24 * 60 * 60 * 1000

async function seedStore(slug: string) {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
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
  return { storeId: s.id, addressId: a?.id as string }
}

async function seedParcel(
  seed: { storeId: string; addressId: string },
  number: number,
  extra: Partial<typeof shipment.$inferInsert> = {},
) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId: seed.storeId,
      number,
      status: 'open',
      subtotalPaise: 1000,
      totalPaise: 1000,
      paymentMethod: 'prepaid',
      email: 'asha@example.com',
      shippingAddressId: seed.addressId,
    })
    .returning()
  const [sh] = await owner
    .insert(shipment)
    .values({
      storeId: seed.storeId,
      orderId: o?.id as string,
      provider: 'fake',
      waybill: `AWB${number}`,
      weightGrams: 1000,
      ...extra,
    })
    .returning()
  return sh?.id as string
}

describe('listPickupOptionsForStore', () => {
  it('offers the booked parcels of the same courier and place, and the pickup already booked', async () => {
    const seed = await seedStore('w')
    const today = dayKey(new Date())
    const tomorrow = dayKey(new Date(Date.now() + DAY_MS))
    const yesterday = dayKey(new Date(Date.now() - DAY_MS))
    const [coming] = await owner
      .insert(shipmentPickup)
      .values({
        storeId: seed.storeId,
        provider: 'fake',
        scheduledFor: tomorrow,
        timeFrom: '14:00',
        expectedPackageCount: 1,
        pickupLocationName: 'HQ',
        status: 'scheduled',
        providerRef: 'P-1',
      })
      .returning()
    // Already over: never offered.
    await owner.insert(shipmentPickup).values({
      storeId: seed.storeId,
      provider: 'fake',
      scheduledFor: yesterday,
      timeFrom: '10:00',
      pickupLocationName: 'HQ',
      status: 'scheduled',
    })
    const anchor = await seedParcel(seed, 42)
    const waiting = await seedParcel(seed, 39)
    await seedParcel(seed, 31, { pickupId: coming?.id as string })
    // Another place on the same courier: its own group, not offered with HQ's.
    await seedParcel(seed, 50, { pickupLocationName: 'Store 2' })
    // Delivered already: not waiting for a pickup.
    await seedParcel(seed, 51, { status: 'delivered' })

    // Another store's parcel never shows up.
    const other = await seedStore('x')
    const foreign = await seedParcel(other, 99)

    const r = await withStore(app, seed.storeId, (tx) =>
      listPickupOptionsForStore(tx, seed.storeId, registry, secret, [anchor, foreign]),
    )
    expect(r.today).toBe(today)
    expect(r.groups).toHaveLength(1)
    const [g] = r.groups
    expect(g?.place).toBe('HQ')
    expect(g?.parcels.map((p) => [p.orderNumber, p.anchor])).toEqual([
      [42, true],
      [39, false],
    ])
    expect(g?.parcels.find((p) => p.shipmentId === waiting)?.customerName).toBe('Asha')
    expect(g?.pickups).toEqual([
      expect.objectContaining({
        id: coming?.id,
        scheduledFor: tomorrow,
        timeFrom: '14:00',
        providerRef: 'P-1',
        orderNumbers: [31],
      }),
    ])
  })

  it('returns nothing for parcels already on a pickup', async () => {
    const seed = await seedStore('w')
    const [p] = await owner
      .insert(shipmentPickup)
      .values({
        storeId: seed.storeId,
        provider: 'fake',
        scheduledFor: dayKey(new Date()),
        timeFrom: '14:00',
        status: 'scheduled',
      })
      .returning()
    const id = await seedParcel(seed, 7, { pickupId: p?.id as string })
    const r = await withStore(app, seed.storeId, (tx) =>
      listPickupOptionsForStore(tx, seed.storeId, registry, secret, [id]),
    )
    expect(r.groups).toEqual([])
  })
})
