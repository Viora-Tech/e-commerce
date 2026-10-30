/** SOURCE OF TRUTH: Home smart cards storage — WHAT: reads one store's facts for the card rules, rebuilds its stored cards (keeping dismissals), lists the live ones and dismisses one / WHY: the worker refreshes every store once a day and Home only reads, so the page never runs the heavy queries */
import { wallClock } from '@commerce/dates'
import {
  cart,
  cartLine,
  collection,
  customerSegment,
  homeCard,
  homeCardRun,
  marketingSession,
  media,
  order,
  orderLine,
  product,
  productMedia,
  sellableStock,
  variant,
} from '@commerce/db'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  sql,
  sum,
} from 'drizzle-orm'
import { abandonedStats } from '../cart/abandoned'
import { storeLowStockThreshold } from '../catalog/stock-threshold'
import { notSystemTest } from '../catalog/system-test'
import type { StoreContext } from '../context'
import { notTestOrder } from '../order/test-orders'
import { buildHomeCards, type HomeCard, type HomeCardFacts, parseHomeCard } from './rules'

const DAY_MS = 86_400_000
/** Cards older than this are rebuilt when Home is opened, in case the worker is behind. */
const STALE_MS = 26 * 60 * 60_000
/** A dismissed card stays hidden this long, then may come back if it still applies. */
const DISMISS_MS = 30 * DAY_MS
/** Product pages looked at for the add-to-cart rule, busiest first. */
const PAGE_ROWS = 20
const BEST_SELLER_ROWS = 10
const SALES_ROWS = 30

/** A real order: not a draft, not paid on test keys, not cancelled. */
const realOrder = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'), notTestOrder)

async function firstImages(ctx: StoreContext, productIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (productIds.length === 0) return out
  const rows = await ctx.tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, productIds))
    .orderBy(asc(productMedia.position))
  for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, r.url)
  return out
}

/** Landing sessions per product page and the carts that took the product, last 30 days. */
async function productPages(ctx: StoreContext, since: Date) {
  const handle = sql<string>`substring(${marketingSession.landingPath} from '/products/([^/?#]+)')`
  const visits = await ctx.tx
    .select({ handle, sessions: count() })
    .from(marketingSession)
    .where(
      and(
        gte(marketingSession.startedAt, since),
        sql`${marketingSession.landingPath} like '%/products/%'`,
      ),
    )
    .groupBy(handle)
    .orderBy(desc(count()))
    .limit(PAGE_ROWS)
  const handles = visits.map((v) => v.handle).filter((h): h is string => Boolean(h))
  if (handles.length === 0) return []
  const products = await ctx.tx
    .select({ id: product.id, handle: product.handle, title: product.title })
    .from(product)
    .where(and(inArray(product.handle, handles), eq(product.status, 'active'), notSystemTest))
  const ids = products.map((p) => p.id)
  if (ids.length === 0) return []
  const carts = await ctx.tx
    .select({
      productId: variant.productId,
      carts: sql<number>`count(distinct ${cart.id})`.mapWith(Number),
    })
    .from(cartLine)
    .innerJoin(cart, eq(cart.id, cartLine.cartId))
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .where(and(inArray(variant.productId, ids), gte(cart.createdAt, since)))
    .groupBy(variant.productId)
  const cartsBy = new Map(carts.map((c) => [c.productId, c.carts]))
  const sessionsBy = new Map(visits.map((v) => [v.handle, v.sessions]))
  const images = await firstImages(ctx, ids)
  return products.map((p) => ({
    productId: p.id,
    title: p.title,
    imageUrl: images.get(p.id) ?? null,
    sessions: sessionsBy.get(p.handle) ?? 0,
    addToCarts: cartsBy.get(p.id) ?? 0,
  }))
}

/** Units and revenue per product in [from, to). */
async function salesBetween(
  ctx: StoreContext,
  from: Date,
  to: Date,
  limit: number,
  only?: string[],
) {
  return ctx.tx
    .select({
      productId: variant.productId,
      title: product.title,
      units: sum(orderLine.quantity).mapWith(Number),
      revenuePaise: sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`).mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        realOrder,
        eq(orderLine.giftCard, false),
        gte(order.placedAt, from),
        lt(order.placedAt, to),
        only ? inArray(variant.productId, only) : undefined,
      ),
    )
    .groupBy(variant.productId, product.title)
    .orderBy(desc(sum(orderLine.quantity)))
    .limit(limit)
}

/** Everything the card rules read, for one store at `now`. */
export async function homeCardFacts(ctx: StoreContext, now: Date): Promise<HomeCardFacts> {
  const month = new Date(now.getTime() - 30 * DAY_MS)
  const monthBefore = new Date(now.getTime() - 60 * DAY_MS)

  const pages = await productPages(ctx, month)

  const collections = await ctx.tx
    .select({ id: collection.id, title: collection.title, imageUrl: media.url })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .where(eq(collection.status, 'active'))

  const repeat = await ctx.tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(
    ctx.tx
      .select({ customerId: order.customerId })
      .from(order)
      .where(and(realOrder, isNotNull(order.customerId)))
      .groupBy(order.customerId)
      .having(sql`count(*) >= 2`)
      .as('repeat_buyers'),
  )
  const segments = await ctx.tx.select({ rules: customerSegment.rules }).from(customerSegment)
  const hasRepeatSegment = segments.some((s) =>
    s.rules.conditions.some(
      (c) => c.field === 'orders' && (c.op === 'gte' || c.op === 'eq') && Number(c.value) >= 2,
    ),
  )

  const thisMonth = await salesBetween(ctx, month, now, SALES_ROWS)
  const ids = thisMonth.map((r) => r.productId)
  const before = ids.length ? await salesBetween(ctx, monthBefore, month, SALES_ROWS, ids) : []
  const beforeBy = new Map(before.map((r) => [r.productId, r.revenuePaise]))
  const best = thisMonth.slice(0, BEST_SELLER_ROWS)
  const bestIds = best.map((r) => r.productId)
  const stock = bestIds.length
    ? await ctx.tx
        .select({
          productId: variant.productId,
          available: sql<number>`sum(${sellableStock.onHand} - ${sellableStock.reserved})`.mapWith(
            Number,
          ),
        })
        .from(sellableStock)
        .innerJoin(variant, eq(variant.id, sellableStock.variantId))
        .where(
          and(
            inArray(variant.productId, bestIds),
            eq(variant.trackInventory, true),
            isNull(variant.archivedAt),
          ),
        )
        .groupBy(variant.productId)
    : []
  const stockBy = new Map(stock.map((s) => [s.productId, s.available]))
  const images = await firstImages(ctx, ids)

  const [waiting] = await ctx.tx
    .select({ n: count(), oldest: sql<Date | null>`min(${order.placedAt})` })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        notTestOrder,
        inArray(order.fulfillmentStatus, ['unfulfilled', 'partially_fulfilled']),
        lt(order.placedAt, new Date(now.getTime() - DAY_MS)),
      ),
    )
  const oldest = waiting?.oldest ? new Date(waiting.oldest) : null

  const abandoned = await abandonedStats(ctx, { days: 7, now })

  return {
    productPages: pages,
    collections,
    repeatBuyers: repeat[0]?.n ?? 0,
    hasRepeatSegment,
    bestSellers: best.map((r) => ({
      productId: r.productId,
      title: r.title,
      imageUrl: images.get(r.productId) ?? null,
      unitsSold: r.units,
      available: stockBy.get(r.productId) ?? null,
    })),
    lowStockThreshold: await storeLowStockThreshold(ctx.tx, ctx.storeId),
    unfulfilled: {
      orders: waiting?.n ?? 0,
      oldestDays: oldest ? Math.floor((now.getTime() - oldest.getTime()) / DAY_MS) : 0,
    },
    abandoned: { carts: abandoned.notRecovered, valuePaise: abandoned.valuePaise },
    productSales: thisMonth.map((r) => ({
      productId: r.productId,
      title: r.title,
      imageUrl: images.get(r.productId) ?? null,
      units: r.units,
      revenuePaise: r.revenuePaise,
      previousRevenuePaise: beforeBy.get(r.productId) ?? 0,
    })),
  }
}

/**
 * Rebuild one store's cards: upsert today's, drop live cards that no longer apply, forget
 * dismissals older than 30 days. A dismissed card that still applies keeps its dismissal.
 */
export async function refreshHomeCards(ctx: StoreContext, now = new Date()): Promise<number> {
  const local = wallClock(now)
  const cards = buildHomeCards(await homeCardFacts(ctx, now), {
    month: local.getUTCMonth() + 1,
    year: local.getUTCFullYear(),
  })
  const keys = cards.map((c) => c.key)
  await ctx.tx
    .delete(homeCard)
    .where(
      and(isNull(homeCard.dismissedAt), keys.length ? notInArray(homeCard.key, keys) : undefined),
    )
  await ctx.tx
    .delete(homeCard)
    .where(lt(homeCard.dismissedAt, new Date(now.getTime() - DISMISS_MS)))
  for (const card of cards) {
    await ctx.tx
      .insert(homeCard)
      .values({ storeId: ctx.storeId, key: card.key, data: card, refreshedAt: now })
      .onConflictDoUpdate({
        target: [homeCard.storeId, homeCard.key],
        set: { data: card, refreshedAt: now },
      })
  }
  await ctx.tx
    .insert(homeCardRun)
    .values({ storeId: ctx.storeId, refreshedAt: now })
    .onConflictDoUpdate({ target: homeCardRun.storeId, set: { refreshedAt: now } })
  return cards.length
}

/** The live cards, best first; rebuilt first when the worker has not run for a day. */
export async function listHomeCards(ctx: StoreContext, now = new Date()): Promise<HomeCard[]> {
  const [run] = await ctx.tx.select({ at: homeCardRun.refreshedAt }).from(homeCardRun)
  if (!run || now.getTime() - run.at.getTime() > STALE_MS) await refreshHomeCards(ctx, now)
  const rows = await ctx.tx
    .select({ data: homeCard.data })
    .from(homeCard)
    .where(isNull(homeCard.dismissedAt))
  return rows
    .map((r) => parseHomeCard(r.data))
    .filter((c): c is HomeCard => c !== null)
    .sort((a, b) => b.priority - a.priority)
}

/** Hide one card for 30 days; `false` brings it back (Undo). */
export async function dismissHomeCard(
  ctx: StoreContext,
  key: string,
  dismissed = true,
): Promise<void> {
  await ctx.tx
    .update(homeCard)
    .set({ dismissedAt: dismissed ? new Date() : null })
    .where(eq(homeCard.key, key))
}
