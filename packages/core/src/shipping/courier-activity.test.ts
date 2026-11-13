/** SOURCE OF TRUTH: courierActivity tests (database) — one courier's tiles in one store — in transit and delayed, booked today and its charge, RTO this month — never another store's or another courier's parcels. */
import { createDb, order, shipment, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { courierActivity } from './courier-activity'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/* 13 Nov 2026, 15:00 in India. */
const NOW = new Date('2026-11-13T09:30:00Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR

let n = 0

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seedShipment(
  storeId: string,
  values: Partial<typeof shipment.$inferInsert> & { createdAt: Date },
) {
  n += 1
  const [o] = await owner
    .insert(order)
    .values({ storeId, number: n, status: 'open', subtotalPaise: 1000, totalPaise: 1000 })
    .returning()
  await owner.insert(shipment).values({
    storeId,
    orderId: o?.id as string,
    provider: 'delhivery',
    waybill: `AWB${n}`,
    updatedAt: values.createdAt,
    ...values,
  })
}

describe('courierActivity', () => {
  it("counts one courier's parcels in one store", async () => {
    const mine = await seedStore('mine')
    const other = await seedStore('other')
    // Booked today: two charged, one cancelled (left out).
    await seedShipment(mine, {
      createdAt: new Date(NOW.getTime() - HOUR),
      courierChargePaise: 9000,
    })
    await seedShipment(mine, {
      createdAt: new Date(NOW.getTime() - 2 * HOUR),
      courierChargePaise: 6000,
    })
    await seedShipment(mine, {
      createdAt: new Date(NOW.getTime() - HOUR),
      status: 'cancelled',
      courierChargePaise: 5000,
    })
    // On the road this month: one past its promised day, one not yet.
    await seedShipment(mine, {
      createdAt: new Date(NOW.getTime() - 5 * DAY),
      status: 'in_transit',
      tracking: { waybill: 'x', status: 'in_transit', events: [], expectedDate: '2026-11-11' },
    })
    await seedShipment(mine, {
      createdAt: new Date(NOW.getTime() - 3 * DAY),
      status: 'out_for_delivery',
      tracking: {
        waybill: 'y',
        status: 'out_for_delivery',
        events: [],
        expectedDate: '2026-11-14',
      },
    })
    // RTO this month, and one from last month (not this month's).
    await seedShipment(mine, { createdAt: new Date(NOW.getTime() - 6 * DAY), status: 'rto' })
    await seedShipment(mine, { createdAt: new Date('2026-10-20T06:00:00Z'), status: 'rto' })
    // Another courier in the same store, and the same courier in another store.
    await seedShipment(mine, {
      createdAt: new Date(NOW.getTime() - HOUR),
      provider: 'shiprocket',
      status: 'in_transit',
    })
    await seedShipment(other, { createdAt: new Date(NOW.getTime() - HOUR), status: 'in_transit' })
    await seedShipment(other, { createdAt: new Date(NOW.getTime() - HOUR), status: 'rto' })

    const a = await withStore(app, mine, (tx) => courierActivity(tx, mine, 'delhivery', NOW))

    expect(a).toMatchObject({
      moving: 2,
      delayed: 1,
      bookedToday: 2,
      chargedTodayPaise: 15000,
      bookedThisMonth: 5,
      rtoThisMonth: 1,
    })
    expect(a.lastUpdate?.getTime()).toBe(NOW.getTime() - HOUR)
  })

  it("never reads another store's parcels, even when asked for its id", async () => {
    const mine = await seedStore('mine')
    const other = await seedStore('other')
    await seedShipment(other, { createdAt: new Date(NOW.getTime() - HOUR), status: 'in_transit' })

    const a = await withStore(app, mine, (tx) => courierActivity(tx, other, 'delhivery', NOW))

    expect(a).toMatchObject({ moving: 0, bookedToday: 0, rtoThisMonth: 0, lastUpdate: null })
  })
})
