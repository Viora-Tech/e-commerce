import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { appInstallation } from '../src/app-schema'
import { createDb } from '../src/client'
import { pixelConnection, pixelEventDay, pixelEventLog } from '../src/pixel-schema'
import { storesWithOldPixelData } from '../src/resolve-store'
import { order, store } from '../src/schema'
import { withStore } from '../src/with-store'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0160 adds the Pixels tables (forced RLS), the prune's store list, and moves each store's
 * Online Store Meta pixel id into a Pixels install plus a browser-only pixel (owner Q4).
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0160_pixels.sql'),
  'utf8',
)
const MOVE = MIGRATION.slice(MIGRATION.indexOf('-- MOVE'))

async function runMove() {
  for (const statement of MOVE.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const prefs = (metaPixel: string) => ({ tracking: { ga4: '', gtm: '', metaPixel } })

describe('0160 pixels move', () => {
  it('installs Pixels and adds a browser-only pixel for stores with a Meta pixel id', async () => {
    const [withPixel, withSpaces, none, bad] = await owner
      .insert(store)
      .values([
        {
          slug: 'a',
          name: 'A',
          preferences: prefs('1234567890123'),
          apps: { installed: ['reviews'] },
        },
        { slug: 'b', name: 'B', preferences: prefs(' 9876543210 ') },
        { slug: 'c', name: 'C', preferences: prefs('') },
        { slug: 'd', name: 'D', preferences: prefs('not-a-pixel') },
      ])
      .returning()

    await runMove()
    await runMove() // idempotent

    const pixels = await owner.select().from(pixelConnection)
    expect(pixels.map((p) => [p.storeId, p.pixelId]).sort()).toEqual(
      [
        [withPixel?.id, '1234567890123'],
        [withSpaces?.id, '9876543210'],
      ].sort(),
    )
    const [first] = pixels
    expect(first?.tokenEnc).toBeNull()
    expect(first?.status).toBe('active')
    expect(first?.purchaseTrigger).toBe('placed')
    expect(first?.events).toEqual([
      'PageView',
      'ViewContent',
      'AddToCart',
      'InitiateCheckout',
      'Purchase',
    ])

    const stores = await owner.select({ id: store.id, apps: store.apps }).from(store)
    const installed = (id?: string) =>
      (stores.find((s) => s.id === id)?.apps as { installed?: string[] } | null)?.installed ?? []
    expect(installed(withPixel?.id)).toEqual(['reviews', 'pixels'])
    expect(installed(withSpaces?.id)).toEqual(['pixels'])
    expect(installed(none?.id)).not.toContain('pixels')
    expect(installed(bad?.id)).not.toContain('pixels')

    const installs = await owner
      .select()
      .from(appInstallation)
      .where(eq(appInstallation.pluginId, 'pixels'))
    expect(installs).toHaveLength(2)
  })
})

describe('pixel tables', () => {
  it('are isolated per store', async () => {
    const [a, b] = await owner
      .insert(store)
      .values([
        { slug: 'a', name: 'A' },
        { slug: 'b', name: 'B' },
      ])
      .returning()
    await owner.insert(pixelConnection).values([
      { storeId: a?.id as string, pixelId: '1111111111' },
      { storeId: b?.id as string, pixelId: '2222222222' },
    ])
    const seen = await withStore(app, a?.id as string, (tx) => tx.select().from(pixelConnection))
    expect(seen.map((p) => p.pixelId)).toEqual(['1111111111'])
  })

  it('reject a malformed pixel id and an unknown trigger', async () => {
    const [s] = await owner.insert(store).values({ slug: 'a', name: 'A' }).returning()
    await expect(
      owner.insert(pixelConnection).values({ storeId: s?.id as string, pixelId: '12ab' }),
    ).rejects.toThrow()
    await expect(
      owner.insert(pixelConnection).values({
        storeId: s?.id as string,
        pixelId: '1234567890',
        purchaseTrigger: 'shipped' as never,
      }),
    ).rejects.toThrow()
  })

  it('lists stores whose pixel data is past 30 days', async () => {
    const [fresh, stale, oldOrder] = await owner
      .insert(store)
      .values([
        { slug: 'a', name: 'A' },
        { slug: 'b', name: 'B' },
        { slug: 'c', name: 'C' },
      ])
      .returning()
    const now = new Date('2026-10-24T06:00:00Z')
    const old = new Date('2026-09-01T06:00:00Z')
    const [cf, cs] = await owner
      .insert(pixelConnection)
      .values([
        { storeId: fresh?.id as string, pixelId: '1111111111' },
        { storeId: stale?.id as string, pixelId: '2222222222' },
      ])
      .returning()
    await owner.insert(pixelEventLog).values([
      {
        storeId: fresh?.id as string,
        connectionId: cf?.id as string,
        eventId: 'e1',
        eventName: 'Purchase',
        origin: 'order',
        createdAt: now,
      },
      {
        storeId: stale?.id as string,
        connectionId: cs?.id as string,
        eventId: 'e2',
        eventName: 'Purchase',
        origin: 'order',
        createdAt: old,
      },
    ])
    await owner.insert(pixelEventDay).values({
      storeId: fresh?.id as string,
      connectionId: cf?.id as string,
      day: '2026-10-23',
      eventName: 'PageView',
      origin: 'storefront',
      sent: 3,
    })
    await owner.insert(order).values({
      storeId: oldOrder?.id as string,
      number: 1,
      status: 'open',
      subtotalPaise: 100,
      totalPaise: 100,
      tracking: { fbp: 'fb.1.1.1', ip: '203.0.113.9', ua: 'UA' },
      placedAt: old,
    })
    const ids = await storesWithOldPixelData(owner, now)
    expect(ids.sort()).toEqual([stale?.id, oldOrder?.id].sort())
  })
})
