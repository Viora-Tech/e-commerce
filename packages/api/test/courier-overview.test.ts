/** A courier app's Pickup locations and per-courier Shipments counts (Figma 928:11256): the
 *  account's own place first, locations with courier pickup on, the next pickup booked with that
 *  courier at each; and the tab counts of one courier only. One store's rows only. */
import { dayKey } from '@commerce/dates'
import { createDb, location, order, shipment, shipmentPickup, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { courierPickupPlaces } from '../src/services/courier-overview.service'
import { shipmentCounts } from '../src/services/shipments-workspace.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const DAY_MS = 24 * 60 * 60 * 1000

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      shipping: {
        enabled: ['delhivery'],
        providers: { delhivery: { pickupLocationName: 'WAIMERS WH' } },
        policy: {
          originPincode: '122001',
          warehouse: { name: 'Waimers Warehouse', city: 'Gurugram' },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('courierPickupPlaces', () => {
  it("lists the account's place, then locations with courier pickup, each with its next pickup", async () => {
    const mine = await seedStore('mine')
    const other = await seedStore('other')
    await owner.insert(location).values([
      {
        storeId: mine,
        name: 'Pune store',
        city: 'Pune',
        pincode: '411045',
        courierPickup: { pickupName: 'WAIMERS PUNE', contactName: '', phone: '' },
      },
      // No courier pickup: not a pickup location.
      { storeId: mine, name: 'Back room', city: 'Pune', pincode: '411045' },
      {
        storeId: other,
        name: 'Elsewhere',
        city: 'Delhi',
        pincode: '110001',
        courierPickup: { pickupName: 'OTHER WH', contactName: '', phone: '' },
      },
    ])
    const today = dayKey(new Date())
    const tomorrow = dayKey(new Date(Date.now() + DAY_MS))
    const yesterday = dayKey(new Date(Date.now() - DAY_MS))
    await owner.insert(shipmentPickup).values([
      {
        storeId: mine,
        provider: 'delhivery',
        scheduledFor: tomorrow,
        timeFrom: '14:00',
        expectedPackageCount: 6,
        pickupLocationName: 'WAIMERS WH',
        status: 'scheduled',
      },
      // Later, past, failed and another courier's pickups never show as next.
      {
        storeId: mine,
        provider: 'delhivery',
        scheduledFor: dayKey(new Date(Date.now() + 3 * DAY_MS)),
        timeFrom: '10:00',
        expectedPackageCount: 2,
        pickupLocationName: 'WAIMERS WH',
        status: 'scheduled',
      },
      {
        storeId: mine,
        provider: 'delhivery',
        scheduledFor: yesterday,
        timeFrom: '10:00',
        pickupLocationName: 'WAIMERS PUNE',
        status: 'scheduled',
      },
      {
        storeId: mine,
        provider: 'delhivery',
        scheduledFor: today,
        timeFrom: '10:00',
        pickupLocationName: 'WAIMERS PUNE',
        status: 'failed',
      },
      {
        storeId: mine,
        provider: 'shiprocket',
        scheduledFor: today,
        timeFrom: '11:00',
        pickupLocationName: 'WAIMERS PUNE',
        status: 'scheduled',
      },
    ])

    const places = await withStore(app, mine, (tx) => courierPickupPlaces(tx, mine, 'delhivery'))

    expect(places).toEqual([
      {
        locationId: null,
        pickupName: 'WAIMERS WH',
        label: 'Waimers Warehouse',
        city: 'Gurugram',
        pincode: '122001',
        isDefault: true,
        nextPickup: { date: tomorrow, timeFrom: '14:00', parcels: 6 },
      },
      expect.objectContaining({
        pickupName: 'WAIMERS PUNE',
        label: 'Pune store',
        isDefault: false,
        nextPickup: null,
      }),
    ])
  })
})

describe('shipmentCounts with a provider', () => {
  it("counts one courier's shipments in this store only", async () => {
    const mine = await seedStore('mine')
    const other = await seedStore('other')
    let n = 0
    const ship = async (storeId: string, provider: string, status: 'in_transit' | 'rto') => {
      n += 1
      const [o] = await owner
        .insert(order)
        .values({ storeId, number: n, status: 'open', subtotalPaise: 1, totalPaise: 1 })
        .returning()
      await owner
        .insert(shipment)
        .values({ storeId, orderId: o?.id as string, provider, waybill: `W${n}`, status })
    }
    await ship(mine, 'delhivery', 'in_transit')
    await ship(mine, 'delhivery', 'rto')
    await ship(mine, 'shiprocket', 'in_transit')
    await ship(other, 'delhivery', 'in_transit')

    const one = await withStore(app, mine, (tx) => shipmentCounts(tx, new Date(), 'delhivery'))
    const all = await withStore(app, mine, (tx) => shipmentCounts(tx))

    expect(one).toMatchObject({ inTransit: 1, rto: 1 })
    expect(all).toMatchObject({ inTransit: 2, rto: 1 })
  })
})
