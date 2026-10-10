import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { inventoryLevel, location, product, store, variant } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0098 lets several locations sell one variant. Its backfill numbers location priorities
 * (default first, then oldest) and makes every level row agree with its location; its trigger
 * keeps them agreeing when a location is switched on or off.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0098_multi_location_routing.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

async function seed(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [older] = await owner
    .insert(location)
    .values({ storeId: s.id, name: 'Older', createdAt: new Date('2026-01-01'), priority: 7 })
    .returning()
  const [home] = await owner
    .insert(location)
    .values({
      storeId: s.id,
      name: 'Home',
      isDefault: true,
      fulfilsOnlineOrders: true,
      createdAt: new Date('2026-05-01'),
      priority: 7,
    })
    .returning()
  const [newer] = await owner
    .insert(location)
    .values({ storeId: s.id, name: 'Newer', createdAt: new Date('2026-03-01'), priority: 7 })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'p', title: 'P' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'V', pricePaise: 100 })
    .returning()
  if (!older || !home || !newer || !v) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: v.id, locationId: home.id, onHand: 2 },
    { storeId: s.id, variantId: v.id, locationId: older.id, onHand: 3 },
  ])
  return { storeId: s.id, home: home.id, older: older.id, newer: newer.id, variantId: v.id }
}

async function sells(variantId: string, locationId: string) {
  const [row] = await owner
    .select({ sells: inventoryLevel.fulfilsOnline })
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), eq(inventoryLevel.locationId, locationId)))
  return row?.sells
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0098 backfill', () => {
  it('numbers priorities default first, then oldest, per store', async () => {
    const a = await seed('a')
    const b = await seed('b')
    await runBackfill()
    await runBackfill()
    for (const t of [a, b]) {
      const rows = await owner
        .select({ id: location.id, priority: location.priority })
        .from(location)
        .where(eq(location.storeId, t.storeId))
        .orderBy(asc(location.priority))
      expect(rows.map((r) => r.id)).toEqual([t.home, t.older, t.newer])
      expect(rows.map((r) => r.priority)).toEqual([0, 1, 2])
    }
  })

  it('makes level rows agree with their location', async () => {
    const a = await seed('a')
    await owner
      .update(inventoryLevel)
      .set({ fulfilsOnline: true })
      .where(eq(inventoryLevel.locationId, a.older))
    await runBackfill()
    expect(await sells(a.variantId, a.older)).toBe(false)
    expect(await sells(a.variantId, a.home)).toBe(true)
  })
})

describe('0098 trigger', () => {
  it('switching a location on lets several rows of one variant sell', async () => {
    const a = await seed('a')
    await owner.update(location).set({ fulfilsOnlineOrders: true }).where(eq(location.id, a.older))
    expect(await sells(a.variantId, a.older)).toBe(true)
    expect(await sells(a.variantId, a.home)).toBe(true)
  })

  it('an inactive location stops selling, and new rows there never sell', async () => {
    const a = await seed('a')
    await owner.update(location).set({ active: false }).where(eq(location.id, a.home))
    expect(await sells(a.variantId, a.home)).toBe(false)
    await owner.update(location).set({ fulfilsOnlineOrders: true }).where(eq(location.id, a.newer))
    await owner.update(location).set({ active: false }).where(eq(location.id, a.newer))
    await owner
      .insert(inventoryLevel)
      .values({ storeId: a.storeId, variantId: a.variantId, locationId: a.newer, onHand: 1 })
    expect(await sells(a.variantId, a.newer)).toBe(false)
  })
})
