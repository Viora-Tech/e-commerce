import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { fulfillmentOrder, location, order, store } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0099 stores each parcel's share of the order's money and its GST. An order with one parcel
 * gets the order's own figures; one with more keeps nulls.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0099_gst_per_parcel.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

const breakdown = {
  taxPaise: 18_000,
  cgstPaise: 9_000,
  sgstPaise: 9_000,
  igstPaise: 0,
  ratePercent: 18,
  interState: false,
  byRate: [],
}
const origin = {
  source: 'location' as const,
  locationId: null,
  locationName: 'Home',
  gstRegistrationId: null,
  gstin: '06AAAPL1234C1Z5',
  stateCode: 'HR',
  stateName: 'Haryana',
}

async function seed(parcels: number) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  const [home] = await owner
    .insert(location)
    .values({ storeId: s?.id as string, name: 'Home', isDefault: true, fulfilsOnlineOrders: true })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s?.id as string,
      number: 1,
      subtotalPaise: 120_000,
      discountPaise: 2_000,
      paymentAdjustmentPaise: -1_000,
      shippingPaise: 1_000,
      totalPaise: 118_000,
      taxPaise: 18_000,
      taxBreakdown: breakdown,
      taxOrigin: origin,
    })
    .returning()
  for (let position = 1; position <= parcels; position++) {
    await owner.insert(fulfillmentOrder).values({
      storeId: s?.id as string,
      orderId: o?.id as string,
      locationId: home?.id as string,
      position,
    })
  }
  return o?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0099 backfill', () => {
  it('an order with one parcel gives it the order’s money and GST', async () => {
    const orderId = await seed(1)
    await runBackfill()
    await runBackfill()
    const [fo] = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId))
    expect(fo).toMatchObject({
      subtotalPaise: 120_000,
      discountPaise: 2_000,
      adjustmentPaise: -1_000,
      shippingPaise: 1_000,
      totalPaise: 118_000,
      taxPaise: 18_000,
      taxBreakdown: breakdown,
      taxOrigin: origin,
    })
  })

  it('an order with more parcels is left alone', async () => {
    const orderId = await seed(2)
    await runBackfill()
    const fos = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId))
    expect(fos.every((f) => f.totalPaise === null && f.taxBreakdown === null)).toBe(true)
  })
})
