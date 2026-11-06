import { eq, sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { navigationMenu } from '../src/content-schema'
import { pixelConnection } from '../src/pixel-schema'
import { store } from '../src/schema'
import {
  listenStorefrontCache,
  parseStorefrontCachePayload,
  STOREFRONT_CACHE_CHANNEL,
  STOREFRONT_CACHE_EXEMPT,
  STOREFRONT_CACHE_SOFT_TABLES,
  STOREFRONT_CACHE_TABLES,
} from '../src/storefront-cache'
import { withStore } from '../src/with-store'
import { resetDb } from './reset'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const listener = postgres(process.env.DATABASE_URL_OWNER as string, { max: 1 })

afterAll(async () => {
  await Promise.all([owner.$client.end(), app.$client.end(), listener.end()])
})

/** Collects notifications until `act` has committed and the server had time to deliver them. */
async function notificationsDuring(act: () => Promise<unknown>): Promise<string[]> {
  const got: string[] = []
  const { unlisten } = await listener.listen(STOREFRONT_CACHE_CHANNEL, (p) => got.push(p))
  try {
    await act()
    await new Promise((r) => setTimeout(r, 300))
  } finally {
    await unlisten()
  }
  return got
}

describe('storefront cache triggers', () => {
  it('classifies every table with a store_id: rendered (trigger) or exempt (reason)', async () => {
    const rows = await owner.execute<{ table_name: string }>(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'store_id' order by 1
    `)
    const rendered = new Set<string>(STOREFRONT_CACHE_TABLES)
    const unclassified = rows
      .map((r) => r.table_name)
      .filter((t) => !rendered.has(t) && !(t in STOREFRONT_CACHE_EXEMPT))
    expect(
      unclassified,
      'add the table to STOREFRONT_CACHE_TABLES (and a trigger migration) or STOREFRONT_CACHE_EXEMPT',
    ).toEqual([])
    const both = [...rendered].filter((t) => t in STOREFRONT_CACHE_EXEMPT)
    expect(both).toEqual([])
  })

  it('every rendered table (and store) carries the trigger, no exempt table does', async () => {
    const rows = await owner.execute<{ table_name: string; args: string }>(sql`
      select c.relname as table_name, encode(t.tgargs, 'escape') as args
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where t.tgname = 'storefront_cache_notify' order by 1
    `)
    const withTrigger = rows.map((r) => r.table_name)
    expect(withTrigger).toEqual(['store', ...STOREFRONT_CACHE_TABLES].sort())
    const soft = rows.filter((r) => r.args.startsWith('soft')).map((r) => r.table_name)
    expect(soft).toEqual([...STOREFRONT_CACHE_SOFT_TABLES])
  })
})

describe('storefront cache notifications', () => {
  let storeId: string

  beforeEach(async () => {
    await resetDb(owner)
    const [s] = await owner.insert(store).values({ slug: 'a', name: 'Store A' }).returning()
    if (!s) throw new Error('seed failed')
    storeId = s.id
  })

  it('a write to a rendered table notifies its store once, at commit', async () => {
    const got = await notificationsDuring(() =>
      withStore(app, storeId, async (tx) => {
        await tx
          .insert(navigationMenu)
          .values({ storeId, handle: 'main', title: 'Main', items: [] })
        await tx
          .insert(navigationMenu)
          .values({ storeId, handle: 'foot', title: 'Foot', items: [] })
      }),
    )
    expect(got).toEqual([storeId])
    expect(parseStorefrontCachePayload(got[0] as string)).toEqual({ storeId, soft: false })
  })

  it('sending a pixel event notifies nobody, changing the pixel does', async () => {
    const [pixel] = await owner
      .insert(pixelConnection)
      .values({ storeId, pixelId: '1234567890' })
      .returning()
    if (!pixel) throw new Error('seed failed')
    const sent = await notificationsDuring(() =>
      owner
        .update(pixelConnection)
        .set({ lastSentAt: new Date(), lastError: null, lastErrorAt: null })
        .where(eq(pixelConnection.id, pixel.id)),
    )
    expect(sent).toEqual([])
    const changed = await notificationsDuring(() =>
      owner
        .update(pixelConnection)
        .set({ status: 'paused' })
        .where(eq(pixelConnection.id, pixel.id)),
    )
    expect(changed).toEqual([storeId])
  })

  it('a rolled-back write notifies nobody', async () => {
    const got = await notificationsDuring(() =>
      withStore(app, storeId, async (tx) => {
        await tx
          .insert(navigationMenu)
          .values({ storeId, handle: 'main', title: 'Main', items: [] })
        throw new Error('roll back')
      }).catch(() => {}),
    )
    expect(got).toEqual([])
  })

  it('the store row notifies for settings, not for the order counter', async () => {
    const counter = await notificationsDuring(() =>
      owner
        .update(store)
        .set({ nextOrderNumber: sql`${store.nextOrderNumber} + 1` })
        .where(sql`${store.id} = ${storeId}`),
    )
    expect(counter).toEqual([])
    const renamed = await notificationsDuring(() =>
      owner.update(store).set({ name: 'Renamed' }).where(sql`${store.id} = ${storeId}`),
    )
    expect(renamed).toEqual([storeId])
  })
})

describe('listenStorefrontCache', () => {
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 50))
    expect(check()).toBe(true)
  }

  it('reports changes, and a lost connection followed by a new live one', async () => {
    await resetDb(owner)
    const [s] = await owner.insert(store).values({ slug: 'a', name: 'Store A' }).returning()
    const storeId = s?.id as string
    const events: string[] = []
    const listener = listenStorefrontCache(process.env.DATABASE_URL as string, {
      onChange: (id, soft) => events.push(`change:${id === storeId}:${soft}`),
      onLive: () => events.push('live'),
      onLost: () => events.push('lost'),
    })
    try {
      await until(() => events.includes('live'))
      await withStore(app, storeId, (tx) =>
        tx.insert(navigationMenu).values({ storeId, handle: 'main', title: 'Main', items: [] }),
      )
      await until(() => events.includes('change:true:false'))
      await owner.execute(sql`
        select pg_terminate_backend(pid) from pg_stat_activity
        where application_name = 'storefront-cache' and datname = current_database()
      `)
      await until(() => events.filter((e) => e === 'live').length === 2)
      expect(events.indexOf('lost')).toBeGreaterThan(events.indexOf('change:true:false'))
    } finally {
      await listener.close()
    }
  })
})

describe('parseStorefrontCachePayload', () => {
  it('reads hard and soft payloads and refuses anything else', () => {
    const id = '01a0de8f-0350-7522-8375-547613dcae7f'
    expect(parseStorefrontCachePayload(id)).toEqual({ storeId: id, soft: false })
    expect(parseStorefrontCachePayload(`${id}:soft`)).toEqual({ storeId: id, soft: true })
    expect(parseStorefrontCachePayload('not-a-store')).toBeNull()
    expect(parseStorefrontCachePayload(`${id}:hard`)).toBeNull()
  })
})
