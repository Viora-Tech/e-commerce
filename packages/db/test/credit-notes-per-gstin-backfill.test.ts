import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { fulfillmentOrder, location, order, store } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0101 issues credit notes per parcel. Its backfill points each existing credit note of a
 * one-parcel order at that parcel; order-level documents and split orders keep null.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0101_credit_notes_per_gstin.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

async function seed(number: number, parcels: number) {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${number}`, name: 'S' })
    .returning()
  const storeId = s?.id as string
  const [home] = await owner
    .insert(location)
    .values({ storeId, name: 'Home', isDefault: true, fulfilsOnlineOrders: true })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({ storeId, number, subtotalPaise: 100, totalPaise: 100 })
    .returning()
  const orderId = o?.id as string
  const fos = []
  for (let position = 1; position <= parcels; position++) {
    const [fo] = await owner
      .insert(fulfillmentOrder)
      .values({ storeId, orderId, locationId: home?.id as string, position })
      .returning()
    fos.push(fo?.id as string)
  }
  for (const kind of ['credit_note', 'packing_slip']) {
    await owner.execute(sql`
      insert into invoice (id, store_id, order_id, kind, status, snapshot, buyer_name,
        taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise)
      values (gen_random_uuid(), ${storeId}, ${orderId}, ${kind}, 'issued', '{}'::jsonb, 'A',
        0, 0, 0, 0, 0)`)
  }
  return { orderId, fos }
}

async function parcelOf(orderId: string, kind: string) {
  const [row] = await owner.execute<{ fo: string | null }>(
    sql`select fulfillment_order_id as fo from invoice where order_id = ${orderId} and kind = ${kind}`,
  )
  return row?.fo ?? null
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0101 backfill', () => {
  it('points a one-parcel order’s credit note at its parcel, idempotently', async () => {
    const one = await seed(1, 1)
    await runBackfill()
    await runBackfill()
    expect(await parcelOf(one.orderId, 'credit_note')).toBe(one.fos[0])
    // Order-level documents stay per order.
    expect(await parcelOf(one.orderId, 'packing_slip')).toBeNull()
  })

  it('leaves a split order’s credit note alone', async () => {
    const two = await seed(2, 2)
    await runBackfill()
    expect(await parcelOf(two.orderId, 'credit_note')).toBeNull()
  })
})
