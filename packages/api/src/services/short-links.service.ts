import { notTestOrder } from '@commerce/core'
import { SHORT_LINK_SLUG } from '@commerce/core/marketing'
import type { StoreTx } from '@commerce/db'
import { order, shortLink, shortLinkClickDay } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, lt, ne, or, sql } from 'drizzle-orm'
import { bucketByDay, istIsoDate, resolveRange } from './analytics-buckets'

export type ShortLinkInput = {
  name: string
  slug: string
  /** A path on the store (`storeDestination` turns what the merchant typed into one). */
  destination: string
  utmSource?: string | undefined
  utmMedium?: string | undefined
  utmCampaign?: string | undefined
  utmContent?: string | undefined
  utmTerm?: string | undefined
}

export type ShortLinkStats = { clicks: number; orders: number; revenuePaise: number }

const clean = (v: string | undefined) => v?.trim() || null

function columnsOf(input: ShortLinkInput) {
  const slug = input.slug.trim().toLowerCase()
  if (!SHORT_LINK_SLUG.test(slug)) {
    throw new ORPCError('BAD_REQUEST', { message: 'Use lower-case letters, numbers and hyphens.' })
  }
  if (!input.destination.startsWith('/') || input.destination.startsWith('//')) {
    throw new ORPCError('BAD_REQUEST', { message: 'A link has to go to a page on your store.' })
  }
  return {
    slug,
    name: input.name.trim(),
    destination: input.destination,
    utmSource: clean(input.utmSource),
    utmMedium: clean(input.utmMedium),
    utmCampaign: clean(input.utmCampaign),
    utmContent: clean(input.utmContent),
    utmTerm: clean(input.utmTerm),
  }
}

const takenSlug = (err: unknown) =>
  err instanceof Error && /short_link_store_slug/.test(`${err.message} ${String(err.cause ?? '')}`)

/** Orders counted for a link: placed (not draft or cancelled), like the Growth overview. */
const countedOrder = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'), notTestOrder)

/**
 * Clicks, orders and revenue per link. Orders are the ones whose attribution carries the link
 * (`attribution.linkId`, stamped by the storefront when the visit came through `/l/<slug>`).
 */
export async function shortLinkStats(
  tx: StoreTx,
  linkIds: string[],
): Promise<Map<string, ShortLinkStats>> {
  const stats = new Map<string, ShortLinkStats>(
    linkIds.map((id) => [id, { clicks: 0, orders: 0, revenuePaise: 0 }]),
  )
  if (linkIds.length === 0) return stats
  const clicks = await tx
    .select({
      linkId: shortLinkClickDay.linkId,
      clicks: sql<number>`coalesce(sum(${shortLinkClickDay.clicks}), 0)`,
    })
    .from(shortLinkClickDay)
    .where(inArray(shortLinkClickDay.linkId, linkIds))
    .groupBy(shortLinkClickDay.linkId)
  const linkOf = sql<string>`${order.attribution}->>'linkId'`
  const orders = await tx
    .select({
      linkId: linkOf,
      orders: count(),
      revenuePaise: sql<number>`coalesce(sum(${order.totalPaise}), 0)`,
    })
    .from(order)
    .where(and(countedOrder, inArray(linkOf, linkIds)))
    .groupBy(linkOf)
  for (const c of clicks) {
    const s = stats.get(c.linkId)
    if (s) s.clicks = Number(c.clicks)
  }
  for (const o of orders) {
    const s = stats.get(o.linkId)
    if (!s) continue
    s.orders = Number(o.orders)
    s.revenuePaise = Number(o.revenuePaise)
  }
  return stats
}

/** Growth → Links: the store's links, newest first, with their clicks, orders and revenue. */
export async function listShortLinks(
  tx: StoreTx,
  input: { page: number; perPage: number; search?: string | undefined },
) {
  const where = input.search
    ? or(
        ilike(shortLink.name, `%${input.search}%`),
        ilike(shortLink.slug, `%${input.search}%`),
        ilike(shortLink.utmCampaign, `%${input.search}%`),
      )
    : undefined
  const rows = await tx
    .select()
    .from(shortLink)
    .where(where)
    .orderBy(desc(shortLink.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const [countRow] = await tx.select({ total: count() }).from(shortLink).where(where)
  const stats = await shortLinkStats(
    tx,
    rows.map((r) => r.id),
  )
  return {
    items: rows.map((r) => ({
      ...r,
      ...(stats.get(r.id) ?? { clicks: 0, orders: 0, revenuePaise: 0 }),
    })),
    total: countRow?.total ?? 0,
  }
}

/** The summary line's numbers: every link of the store, not just the page on screen. */
export async function shortLinkTotals(tx: StoreTx) {
  const ids = (await tx.select({ id: shortLink.id }).from(shortLink)).map((r) => r.id)
  const stats = await shortLinkStats(tx, ids)
  let clicks = 0
  let orders = 0
  let revenuePaise = 0
  for (const s of stats.values()) {
    clicks += s.clicks
    orders += s.orders
    revenuePaise += s.revenuePaise
  }
  return { links: ids.length, clicks, orders, revenuePaise }
}

export async function createShortLink(
  tx: StoreTx,
  storeId: string,
  input: ShortLinkInput,
  createdBy: string | null,
) {
  try {
    const [row] = await tx
      .insert(shortLink)
      .values({ storeId, ...columnsOf(input), createdBy })
      .returning()
    return row
  } catch (err) {
    if (takenSlug(err)) {
      throw new ORPCError('CONFLICT', { message: 'Another link already uses that short name.' })
    }
    throw err
  }
}

export async function updateShortLink(tx: StoreTx, id: string, input: ShortLinkInput) {
  try {
    const [row] = await tx
      .update(shortLink)
      .set({ ...columnsOf(input), updatedAt: new Date() })
      .where(eq(shortLink.id, id))
      .returning()
    if (!row) throw new ORPCError('NOT_FOUND')
    return row
  } catch (err) {
    if (takenSlug(err)) {
      throw new ORPCError('CONFLICT', { message: 'Another link already uses that short name.' })
    }
    throw err
  }
}

export async function deleteShortLink(tx: StoreTx, id: string) {
  await tx.delete(shortLink).where(eq(shortLink.id, id))
}

/** One day of Growth → Links: clicks on every link, and the orders and revenue they brought. */
export type ShortLinkTrendDay = {
  day: string
  clicks: number
  orders: number
  revenuePaise: number
}

/** Clicks, orders and revenue across every link for each of the last 30 IST days, quiet days 0. */
export async function shortLinkTrend(tx: StoreTx, now = new Date()): Promise<ShortLinkTrendDay[]> {
  const range = resolveRange({ key: '30d' }, now)
  const first = range.days[0] ?? istIsoDate(range.from)
  const linkOf = sql<string | null>`${order.attribution}->>'linkId'`
  const [clicks, orders] = await Promise.all([
    tx
      .select({
        day: shortLinkClickDay.day,
        clicks: sql<number>`coalesce(sum(${shortLinkClickDay.clicks}), 0)::int`,
      })
      .from(shortLinkClickDay)
      .where(gte(shortLinkClickDay.day, first))
      .groupBy(shortLinkClickDay.day),
    tx
      .select({ placedAt: order.placedAt, totalPaise: order.totalPaise })
      .from(order)
      .where(
        and(
          countedOrder,
          isNotNull(linkOf),
          gte(order.placedAt, range.from),
          lt(order.placedAt, range.to),
        ),
      ),
  ])
  const clicksByDay = new Map(clicks.map((c) => [c.day, Number(c.clicks)]))
  const ordersByDay = bucketByDay(
    orders.map((o) => ({ at: o.placedAt })),
    range.days,
  )
  const revenueByDay = bucketByDay(
    orders.map((o) => ({ at: o.placedAt, weight: o.totalPaise })),
    range.days,
  )
  return range.days.map((day, i) => ({
    day,
    clicks: clicksByDay.get(day) ?? 0,
    orders: ordersByDay[i] ?? 0,
    revenuePaise: revenueByDay[i] ?? 0,
  }))
}
