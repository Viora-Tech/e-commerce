import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { order, orderLine, product, store, variant } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0105 snapshots each order line's cost at sale. Orders placed before it take their variant's
 * cost as it is on the day of the migration, marked estimated; drafts and gift cards keep null.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0105_order_profit.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  const storeId = s?.id as string
  const [p] = await owner.insert(product).values({ storeId, handle: 'p', title: 'P' }).returning()
  const [costed, uncosted] = await owner
    .insert(variant)
    .values([
      { storeId, productId: p?.id as string, title: 'A', pricePaise: 1000, costPaise: 400 },
      { storeId, productId: p?.id as string, title: 'B', pricePaise: 1000 },
    ])
    .returning()
  const orders = await owner
    .insert(order)
    .values([
      { storeId, number: 1, status: 'open', subtotalPaise: 1000, totalPaise: 1000 },
      { storeId, number: 2, status: 'draft', subtotalPaise: 1000, totalPaise: 1000 },
    ])
    .returning()
  const line = (
    orderId: string,
    variantId: string,
    extra: { giftCard?: boolean; cost?: number } = {},
  ) => ({
    storeId,
    orderId,
    variantId,
    quantity: 1,
    unitPricePaise: 1000,
    giftCard: extra.giftCard ?? false,
    costAtSalePaise: extra.cost ?? null,
  })
  const [open, draft] = orders
  const lines = await owner
    .insert(orderLine)
    .values([
      line(open?.id as string, costed?.id as string),
      line(open?.id as string, uncosted?.id as string),
      line(open?.id as string, costed?.id as string, { giftCard: true }),
      line(open?.id as string, costed?.id as string, { cost: 350 }),
      line(draft?.id as string, costed?.id as string),
    ])
    .returning()
  return lines.map((l) => l.id)
}

async function costOf(id: string) {
  const [row] = await owner.select().from(orderLine).where(eq(orderLine.id, id))
  return { cost: row?.costAtSalePaise ?? null, estimated: row?.costEstimated ?? null }
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0105 backfill', () => {
  it('fills placed lines from today’s variant cost, marked estimated, once', async () => {
    const [costed, uncosted, giftCard, snapshotted, draft] = await seed()
    await runBackfill()
    await runBackfill()
    expect(await costOf(costed as string)).toEqual({ cost: 400, estimated: true })
    expect(await costOf(uncosted as string)).toEqual({ cost: null, estimated: false })
    expect(await costOf(giftCard as string)).toEqual({ cost: null, estimated: false })
    // A line that already had its own cost keeps it.
    expect(await costOf(snapshotted as string)).toEqual({ cost: 350, estimated: false })
    expect(await costOf(draft as string)).toEqual({ cost: null, estimated: false })
  })
})
