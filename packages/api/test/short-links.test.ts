import { followShortLink } from '@commerce/core'
import {
  createDb,
  type MarketingAttribution,
  order,
  shortLinkClickDay,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createShortLink,
  listShortLinks,
  shortLinkTotals,
  shortLinkTrend,
} from '../src/services/short-links.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

let orderNumber = 1
async function placed(
  storeId: string,
  totalPaise: number,
  linkId: string | null,
  status: 'open' | 'draft' | 'cancelled' = 'open',
) {
  await owner.insert(order).values({
    storeId,
    number: orderNumber++,
    status,
    subtotalPaise: totalPaise,
    totalPaise,
    placedAt: new Date(),
    attribution: {
      channel: 'whatsapp',
      at: new Date().toISOString(),
      ...(linkId ? { linkId } : {}),
    } as MarketingAttribution,
  })
}

const link = (storeId: string, slug: string) =>
  withStore(app, storeId, (tx) =>
    createShortLink(
      tx,
      storeId,
      { name: slug, slug, destination: '/collections/glasspads', utmSource: 'whatsapp' },
      null,
    ),
  )

const follow = (
  storeId: string,
  slug: string,
  userAgent: string | null,
  method = 'GET',
  now?: Date,
) => withStore(app, storeId, (tx) => followShortLink(tx, storeId, slug, { userAgent, method, now }))

describe('short links', () => {
  it('counts shopper clicks per day, not bots, previews or HEAD requests', async () => {
    const storeId = await newStore('l1')
    const created = await link(storeId, 'diwali-wa')
    const day1 = new Date('2026-10-09T10:00:00Z')
    const day2 = new Date('2026-10-10T10:00:00Z')
    await follow(storeId, 'diwali-wa', PHONE, 'GET', day1)
    await follow(storeId, 'DIWALI-WA', PHONE, 'GET', day1)
    await follow(storeId, 'diwali-wa', PHONE, 'GET', day2)
    await follow(storeId, 'diwali-wa', 'WhatsApp/2.23.20.0 A', 'GET', day2)
    await follow(storeId, 'diwali-wa', PHONE, 'HEAD', day2)
    expect(await follow(storeId, 'missing', PHONE)).toBeNull()
    const days = await owner.select().from(shortLinkClickDay)
    expect(days.map((d) => [d.linkId, d.day, d.clicks]).sort()).toEqual([
      [created?.id, '2026-10-09', 2],
      [created?.id, '2026-10-10', 1],
    ])
  })

  it('credits placed orders and their revenue to the link they came through', async () => {
    const storeId = await newStore('l2')
    const a = await link(storeId, 'insta')
    const b = await link(storeId, 'youtube')
    await follow(storeId, 'insta', PHONE)
    await follow(storeId, 'insta', PHONE)
    await placed(storeId, 250000, a?.id as string)
    await placed(storeId, 100000, a?.id as string)
    await placed(storeId, 999900, a?.id as string, 'cancelled')
    await placed(storeId, 999900, a?.id as string, 'draft')
    await placed(storeId, 50000, null)
    const list = await withStore(app, storeId, (tx) => listShortLinks(tx, { page: 1, perPage: 25 }))
    const byId = new Map(list.items.map((i) => [i.id, i]))
    expect(byId.get(a?.id as string)).toMatchObject({ clicks: 2, orders: 2, revenuePaise: 350000 })
    expect(byId.get(b?.id as string)).toMatchObject({ clicks: 0, orders: 0, revenuePaise: 0 })
    expect(await withStore(app, storeId, (tx) => shortLinkTotals(tx))).toEqual({
      links: 2,
      clicks: 2,
      orders: 2,
      revenuePaise: 350000,
    })
  })

  it("never counts another store's orders or links", async () => {
    const one = await newStore('l3')
    const two = await newStore('l4')
    const a = await link(one, 'drop')
    await link(two, 'drop')
    await placed(two, 400000, a?.id as string)
    const list = await withStore(app, one, (tx) => listShortLinks(tx, { page: 1, perPage: 25 }))
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({ orders: 0, revenuePaise: 0 })
  })

  it('charts clicks, orders and revenue per day over the last 30 days', async () => {
    const storeId = await newStore('l6')
    const a = await link(storeId, 'trend')
    await follow(storeId, 'trend', PHONE)
    await follow(storeId, 'trend', PHONE, 'GET', new Date(Date.now() - 40 * 86_400_000))
    await placed(storeId, 250000, a?.id as string)
    await placed(storeId, 90000, null)
    const trend = await withStore(app, storeId, (tx) => shortLinkTrend(tx))
    expect(trend).toHaveLength(30)
    const sum = (key: 'clicks' | 'orders' | 'revenuePaise') => trend.reduce((n, d) => n + d[key], 0)
    expect([sum('clicks'), sum('orders'), sum('revenuePaise')]).toEqual([1, 1, 250000])
  })

  it('refuses a short name the store already uses', async () => {
    const storeId = await newStore('l5')
    await link(storeId, 'sale')
    await expect(link(storeId, 'sale')).rejects.toThrow(/already uses/)
  })
})
