/**
 * The AI assistant's store tools: READ-ONLY lookups the model may call (sales, top products,
 * stock, orders to ship, abandoned checkouts). Each one opens its own
 * `withStore` transaction for the store in the engine's runtime (never a store id from the
 * model), reads aggregates only, and returns `facts`: labelled, already-formatted values the
 * model copies into its answer and the admin shows as sources. No customer names, emails,
 * phones or addresses ever leave here.
 */
import { type AiRuntime, type AiToolSet, defineAiTool, guardData } from '@commerce/ai'
import { abandonedStats, notSystemTest, notTestOrder, UNFULFILLED_STATUSES } from '@commerce/core'
import { formatInZone, startOfDay } from '@commerce/dates'
import {
  type Db,
  marketingSession,
  order,
  orderLine,
  product,
  refund,
  type StoreTx,
  sellableStock,
  variant,
  withStore,
} from '@commerce/db'
import { type Currency, formatMoney } from '@commerce/money'
import { and, asc, desc, eq, gte, inArray, lt, lte, ne, sql, sum } from 'drizzle-orm'
import { z } from 'zod'
import type { Taint } from './assistant/taint'
import type { StoreFacts } from './guard'

export type Fact = { label: string; value: string }
export type ToolOutput = { facts: Fact[] }

const DAY_MS = 86_400_000
/** Sales answers leave out drafts and test-mode orders (gateway test keys, no real money). */
const notDraft = and(ne(order.status, 'draft'), notTestOrder)
const live = and(notDraft, ne(order.status, 'cancelled'))

const available = sql<number>`${sellableStock.onHand} - ${sellableStock.reserved}`

export type ToolEnv = { db: Db; store: StoreFacts; now: () => Date; taint?: Taint | undefined }

/** A product title (merchant text) made safe for the model; flags the turn if it tries to instruct. */
export function safeTitle(env: ToolEnv, title: string): string {
  const guarded = guardData(title, 120)
  if (guarded.flagged && env.taint) env.taint.flagged = true
  return guarded.text
}

/** Whole units of the store's currency: an answer reads "₹2,37,948", not "₹2,37,948.21". */
export function money(env: ToolEnv, minor: number): string {
  return formatMoney(minor, env.store.currency as Currency, { whole: true })
}

export function day(env: ToolEnv, at: Date): string {
  return formatInZone(at, { day: 'numeric', month: 'short' }, { timeZone: env.store.timezone })
}

export function read<T>(
  env: ToolEnv,
  runtime: AiRuntime,
  fn: (tx: StoreTx) => Promise<T>,
): Promise<T> {
  return withStore(env.db, runtime.storeId, fn)
}

const pct = (now: number, before: number): string | null =>
  before > 0 ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : null

/**
 * One window's sales, the way a merchant (and Shopify) reads them: gross is every order placed,
 * net takes off what was cancelled and refunded in the window. The parts come back too, so the
 * assistant can say why sales moved instead of "the tool does not say" (audit #189).
 */
async function salesWindow(tx: StoreTx, from: Date, to: Date) {
  const inWindow = and(gte(order.placedAt, from), lt(order.placedAt, to))
  const cancelledOrder = sql`${order.status} = 'cancelled'`
  const [placed] = await tx
    .select({
      placed: sql<number>`count(*)::int`,
      gross: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`.mapWith(Number),
      discounts: sql<number>`coalesce(sum(${order.discountPaise}), 0)::bigint`.mapWith(Number),
      cancelled: sql<number>`(count(*) filter (where ${cancelledOrder}))::int`,
      cancelledValue: sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${cancelledOrder}), 0)::bigint`.mapWith(
        Number,
      ),
      tracked: sql<number>`(count(*) filter (where not ${cancelledOrder} and (${order.attribution}->>'channel') is not null))::int`,
    })
    .from(order)
    .where(and(notDraft, inWindow))
  // Refunds count when they were made, on orders not cancelled (those are already out of net).
  const [refunded] = await tx
    .select({
      total: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::bigint`.mapWith(Number),
    })
    .from(refund)
    .innerJoin(order, eq(order.id, refund.orderId))
    .where(
      and(
        inArray(refund.status, ['processed', 'manual']),
        gte(refund.createdAt, from),
        lt(refund.createdAt, to),
        live,
      ),
    )
  const [visits] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(marketingSession)
    .where(and(gte(marketingSession.startedAt, from), lt(marketingSession.startedAt, to)))
  const cancelled = placed?.cancelled ?? 0
  const gross = placed?.gross ?? 0
  const cancelledValue = placed?.cancelledValue ?? 0
  const refunds = refunded?.total ?? 0
  return {
    orders: (placed?.placed ?? 0) - cancelled,
    gross,
    cancelled,
    cancelledValue,
    refunds,
    discounts: placed?.discounts ?? 0,
    net: gross - cancelledValue - refunds,
    sessions: visits?.n ?? 0,
    tracked: placed?.tracked ?? 0,
  }
}

type SalesWindow = Awaited<ReturnType<typeof salesWindow>>

/** Orders from tracked visits per visit; sessions are only counted on this storefront. */
const conversionText = (w: SalesWindow) =>
  w.sessions > 0
    ? `${(Math.min(w.tracked / w.sessions, 1) * 100).toFixed(1)}%`
    : 'no visits tracked'

/** The store's read-only AI tools, bound to its database and formatting. */
export function storeTools(env: ToolEnv): AiToolSet {
  return {
    salesSummary: defineAiTool({
      description:
        'Sales for the last N days including today (India time) and the N days before: net sales (gross minus cancellations and refunds), gross, orders, average order, cancelled orders and their value, refunds, discounts, store visits and conversion. Use the parts to explain why sales changed.',
      input: z.object({ days: z.number().int().min(1).max(90).default(7) }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ToolOutput> => {
          const now = env.now()
          const from = startOfDay(now, env.store.timezone, -(input.days - 1))
          const before = new Date(from.getTime() - input.days * DAY_MS)
          const cur = await salesWindow(tx, from, now)
          const prev = await salesWindow(tx, before, from)
          const change = pct(cur.net, prev.net)
          const period = input.days === 1 ? 'today' : `last ${input.days} days`
          const both = (now: string, then: string) =>
            `${now} (the ${input.days} days before: ${then})`
          return {
            facts: [
              {
                label: `Net sales, ${period}`,
                value: both(money(env, cur.net), money(env, prev.net)),
              },
              ...(change ? [{ label: 'Change in net sales', value: change }] : []),
              {
                label: 'Gross sales (every order placed)',
                value: both(money(env, cur.gross), money(env, prev.gross)),
              },
              {
                label: 'Orders (not cancelled)',
                value: both(String(cur.orders), String(prev.orders)),
              },
              {
                label: 'Cancelled orders',
                value: both(
                  `${cur.cancelled} worth ${money(env, cur.cancelledValue)}`,
                  `${prev.cancelled} worth ${money(env, prev.cancelledValue)}`,
                ),
              },
              { label: 'Refunds', value: both(money(env, cur.refunds), money(env, prev.refunds)) },
              {
                label: 'Discounts given',
                value: both(money(env, cur.discounts), money(env, prev.discounts)),
              },
              {
                label: 'Average order',
                value: cur.orders
                  ? money(env, Math.round((cur.gross - cur.cancelledValue) / cur.orders))
                  : 'no orders',
              },
              {
                label: 'Store visits',
                value: both(String(cur.sessions), String(prev.sessions)),
              },
              {
                label: 'Conversion (orders from tracked visits)',
                value: both(conversionText(cur), conversionText(prev)),
              },
            ],
          }
        }),
    }),

    topProducts: defineAiTool({
      description: 'Best-selling products by units sold over the last N days, with revenue.',
      input: z.object({
        days: z.number().int().min(1).max(90).default(30),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ToolOutput> => {
          const from = startOfDay(env.now(), env.store.timezone, -(input.days - 1))
          const rows = await tx
            .select({
              title: product.title,
              units: sum(orderLine.quantity).mapWith(Number),
              revenue: sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`).mapWith(
                Number,
              ),
            })
            .from(orderLine)
            .innerJoin(order, eq(order.id, orderLine.orderId))
            .innerJoin(variant, eq(variant.id, orderLine.variantId))
            .innerJoin(product, eq(product.id, variant.productId))
            .where(and(live, gte(order.placedAt, from)))
            .groupBy(product.id, product.title)
            .orderBy(desc(sum(orderLine.quantity)))
            .limit(input.limit)
          if (!rows.length)
            return {
              facts: [{ label: `Sold in the last ${input.days} days`, value: 'nothing yet' }],
            }
          return {
            facts: rows.map((r, i) => ({
              label: `${i + 1}. ${safeTitle(env, r.title)}`,
              value: `${r.units} sold, ${money(env, r.revenue)}`,
            })),
          }
        }),
    }),

    lowStock: defineAiTool({
      description:
        'Products running out: tracked variants with this many units or fewer available to sell online, lowest first.',
      input: z.object({
        threshold: z.number().int().min(0).max(50).default(5),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ToolOutput> => {
          const where = and(
            eq(variant.trackInventory, true),
            ne(product.status, 'archived'),
            notSystemTest,
            lte(available, input.threshold),
          )
          const base = tx
            .select({
              title: product.title,
              variantTitle: variant.title,
              available: available.mapWith(Number),
            })
            .from(sellableStock)
            .innerJoin(variant, eq(variant.id, sellableStock.variantId))
            .innerJoin(product, eq(product.id, variant.productId))
            .where(where)
          const rows = await base.orderBy(asc(available)).limit(input.limit)
          const [count] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(sellableStock)
            .innerJoin(variant, eq(variant.id, sellableStock.variantId))
            .innerJoin(product, eq(product.id, variant.productId))
            .where(where)
          const total = count?.n ?? 0
          return {
            facts: [
              { label: `Variants at ${input.threshold} or fewer`, value: String(total) },
              ...rows.map((r) => ({
                label:
                  r.variantTitle && r.variantTitle !== 'Default'
                    ? `${safeTitle(env, r.title)} (${safeTitle(env, r.variantTitle)})`
                    : safeTitle(env, r.title),
                value:
                  r.available < 0
                    ? `oversold by ${-r.available} (owed to buyers)`
                    : r.available === 0
                      ? 'out of stock'
                      : `${r.available} left`,
              })),
            ],
          }
        }),
    }),

    pendingOrders: defineAiTool({
      description:
        'Open orders not yet packed or shipped that were placed more than N days ago (0 means all of them), oldest first, with whether they are paid.',
      input: z.object({ olderThanDays: z.number().int().min(0).max(30).default(2) }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ToolOutput> => {
          const now = env.now()
          const cutoff = new Date(now.getTime() - input.olderThanDays * DAY_MS)
          const rows = await tx
            .select({
              number: order.number,
              placedAt: order.placedAt,
              totalPaise: order.totalPaise,
              paymentStatus: order.paymentStatus,
            })
            .from(order)
            .where(
              and(
                eq(order.status, 'open'),
                inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
                lt(order.placedAt, cutoff),
              ),
            )
            .orderBy(asc(order.placedAt))
            .limit(200)
          const label =
            input.olderThanDays === 0
              ? 'Orders waiting to ship'
              : `Waiting over ${input.olderThanDays} days`
          if (!rows.length) return { facts: [{ label, value: 'none' }] }
          const paid = rows.filter((r) => r.paymentStatus === 'paid').length
          const value = rows.reduce((n, r) => n + r.totalPaise, 0)
          const oldest = rows[0] as (typeof rows)[number]
          return {
            facts: [
              {
                label,
                value: `${rows.length}${rows.length === 200 ? '+' : ''} orders, ${money(env, value)}`,
              },
              { label: 'Paid and ready', value: String(paid) },
              { label: 'Payment still due', value: String(rows.length - paid) },
              {
                label: 'Oldest',
                value: `#${oldest.number}, placed ${day(env, oldest.placedAt)} (${Math.floor((now.getTime() - oldest.placedAt.getTime()) / DAY_MS)} days ago)`,
              },
              ...rows.slice(1, 6).map((r) => ({
                label: `#${r.number}`,
                value: `placed ${day(env, r.placedAt)}, ${money(env, r.totalPaise)}`,
              })),
            ],
          }
        }),
    }),

    abandonedCheckouts: defineAiTool({
      description:
        'Abandoned checkouts over the last N days: carts that left contact details but did not order, their value, and how many were recovered.',
      input: z.object({ days: z.number().int().min(1).max(30).default(7) }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ToolOutput> => {
          const stats = await abandonedStats(
            { storeId: runtime.storeId, tx },
            { days: input.days, now: env.now() },
          )
          return {
            facts: [
              { label: `Abandoned checkouts, last ${input.days} days`, value: String(stats.carts) },
              { label: 'Value left in carts', value: money(env, stats.valuePaise) },
              {
                label: 'Recovered',
                value: `${stats.recovered} (${Math.round(stats.recoveryRate * 100)}%)`,
              },
            ],
          }
        }),
    }),
  }
}
