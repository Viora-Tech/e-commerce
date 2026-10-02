/**
 * The AI assistant's store tools: READ-ONLY lookups the model may call (sales, top products,
 * stock, orders to ship, abandoned checkouts). Each one opens its own
 * `withStore` transaction for the store in the engine's runtime (never a store id from the
 * model), reads aggregates only, and returns `facts`: labelled, already-formatted values the
 * model copies into its answer and the admin shows as sources. No customer names, emails,
 * phones or addresses ever leave here.
 */
import { type AiRuntime, type AiToolSet, defineAiTool, guardData } from '@commerce/ai'
import { abandonedStats, notSystemTest, UNFULFILLED_STATUSES } from '@commerce/core'
import { formatInZone, startOfDay } from '@commerce/dates'
import {
  type Db,
  inventoryLevel,
  order,
  orderLine,
  product,
  type StoreTx,
  sellableLevel,
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
const notDraft = ne(order.status, 'draft')
const live = and(notDraft, ne(order.status, 'cancelled'))
const available = sql<number>`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`

export type ToolEnv = { db: Db; store: StoreFacts; now: () => Date; taint?: Taint | undefined }

/** A product title (merchant text) made safe for the model; flags the turn if it tries to instruct. */
export function safeTitle(env: ToolEnv, title: string): string {
  const guarded = guardData(title, 120)
  if (guarded.flagged && env.taint) env.taint.flagged = true
  return guarded.text
}

/** Whole rupees: an answer reads "₹2,37,948", not "₹2,37,948.21". */
export function money(env: ToolEnv, paise: number): string {
  return formatMoney(Math.round(paise / 100) * 100, env.store.currency as Currency)
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

async function salesWindow(tx: StoreTx, from: Date, to: Date) {
  const [row] = await tx
    .select({
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`.mapWith(Number),
    })
    .from(order)
    .where(and(live, gte(order.placedAt, from), lt(order.placedAt, to)))
  const [cancelled] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(and(eq(order.status, 'cancelled'), gte(order.placedAt, from), lt(order.placedAt, to)))
  return { orders: row?.orders ?? 0, revenue: row?.revenue ?? 0, cancelled: cancelled?.n ?? 0 }
}

/** The store's read-only AI tools, bound to its database and formatting. */
export function storeTools(env: ToolEnv): AiToolSet {
  return {
    salesSummary: defineAiTool({
      description:
        'Sales for the last N days including today (India time): revenue, orders, average order value, cancelled orders, and the same numbers for the N days before, for comparison.',
      input: z.object({ days: z.number().int().min(1).max(90).default(7) }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ToolOutput> => {
          const now = env.now()
          const from = startOfDay(now, env.store.timezone, -(input.days - 1))
          const before = new Date(from.getTime() - input.days * DAY_MS)
          const cur = await salesWindow(tx, from, now)
          const prev = await salesWindow(tx, before, from)
          const change = pct(cur.revenue, prev.revenue)
          const period = input.days === 1 ? 'today' : `last ${input.days} days`
          return {
            facts: [
              { label: `Sales, ${period}`, value: money(env, cur.revenue) },
              { label: `Orders, ${period}`, value: String(cur.orders) },
              {
                label: 'Average order',
                value: cur.orders ? money(env, Math.round(cur.revenue / cur.orders)) : 'no orders',
              },
              {
                label: `Sales, the ${input.days} days before`,
                value: `${money(env, prev.revenue)} from ${prev.orders} orders`,
              },
              ...(change ? [{ label: 'Change in sales', value: change }] : []),
              { label: `Cancelled, ${period}`, value: String(cur.cancelled) },
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
            .from(inventoryLevel)
            .innerJoin(variant, and(eq(variant.id, inventoryLevel.variantId), sellableLevel))
            .innerJoin(product, eq(product.id, variant.productId))
            .where(where)
          const rows = await base.orderBy(asc(available)).limit(input.limit)
          const [count] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(inventoryLevel)
            .innerJoin(variant, and(eq(variant.id, inventoryLevel.variantId), sellableLevel))
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
                value: r.available <= 0 ? 'out of stock' : `${r.available} left`,
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
