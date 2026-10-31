/** Discounts: how often each was used (orders, imported counts) and its most recent uses. Split out of discount.service.ts. */
import type { StoreTx } from '@commerce/db'
import { discount, discountUsage, order } from '@commerce/db'
import { and, count, desc, eq, inArray, isNotNull, max, sql } from 'drizzle-orm'

const RECENT_USES = 10

/**
 * What a discount has done, from its `discount_usage` rows (one per order that used it):
 * the orders, what they brought in and what the discount gave away, and the last use.
 * Test orders are left out; a cancelled order still counts as a use (it took one of the
 * limit) but adds nothing to revenue or the amount given.
 */
export type DiscountUsageSummary = {
  orders: number
  revenuePaise: number
  amountPaise: number
  lastUsedAt: Date | null
}

export const EMPTY_USAGE: DiscountUsageSummary = {
  orders: 0,
  revenuePaise: 0,
  amountPaise: 0,
  lastUsedAt: null,
}

const kept = sql`${order.status} <> 'cancelled'`

/** Usage per discount for the ids given (a list page, or one discount). */
export async function usageOf(
  tx: StoreTx,
  ids: string[],
): Promise<Map<string, DiscountUsageSummary>> {
  const byId = new Map<string, DiscountUsageSummary>()
  if (ids.length === 0) return byId
  const rows = await tx
    .select({
      discountId: discountUsage.discountId,
      orders: count(),
      revenuePaise:
        sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      amountPaise:
        sql<number>`coalesce(sum(${discountUsage.amountPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      lastUsedAt: max(discountUsage.createdAt),
    })
    .from(discountUsage)
    .innerJoin(order, eq(order.id, discountUsage.orderId))
    .where(and(inArray(discountUsage.discountId, ids), eq(order.isTest, false)))
    .groupBy(discountUsage.discountId)
  for (const r of rows) {
    byId.set(r.discountId, {
      orders: r.orders,
      revenuePaise: r.revenuePaise,
      amountPaise: r.amountPaise,
      lastUsedAt: r.lastUsedAt,
    })
  }
  await addImportedUsage(tx, ids, byId)
  return byId
}

/**
 * Orders brought over from another platform carry the code they used (`discount_code`, several
 * joined by commas) but no `discount_usage` row, so a code's revenue read ₹0 however often it
 * was used there (#994). They are added here, matched by code; the amount given is the order's
 * whole discount.
 */
async function addImportedUsage(
  tx: StoreTx,
  ids: string[],
  byId: Map<string, DiscountUsageSummary>,
): Promise<void> {
  const codes = await tx
    .select({ id: discount.id, code: discount.code })
    .from(discount)
    .where(and(inArray(discount.id, ids), isNotNull(discount.code)))
  const idByCode = new Map(codes.flatMap((c) => (c.code ? [[c.code.toUpperCase(), c.id]] : [])))
  if (idByCode.size === 0) return
  const used = sql`string_to_array(upper(replace(${order.discountCode}, ' ', '')), ',')`
  const rows = await tx
    .select({
      code: sql<string>`c.code`,
      orders: count(),
      revenuePaise:
        sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      amountPaise:
        sql<number>`coalesce(sum(${order.discountPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      lastUsedAt: max(order.placedAt),
    })
    .from(order)
    .innerJoin(
      sql`unnest(${sql.param([...idByCode.keys()])}::text[]) as c(code)`,
      sql`c.code = any(${used})`,
    )
    .where(
      and(isNotNull(order.importedFrom), isNotNull(order.discountCode), eq(order.isTest, false)),
    )
    .groupBy(sql`c.code`)
  for (const r of rows) {
    const id = idByCode.get(r.code)
    if (!id) continue
    const now = byId.get(id) ?? EMPTY_USAGE
    const last =
      now.lastUsedAt && r.lastUsedAt
        ? new Date(Math.max(now.lastUsedAt.getTime(), new Date(r.lastUsedAt).getTime()))
        : (now.lastUsedAt ?? (r.lastUsedAt ? new Date(r.lastUsedAt) : null))
    byId.set(id, {
      orders: now.orders + r.orders,
      revenuePaise: now.revenuePaise + r.revenuePaise,
      amountPaise: now.amountPaise + r.amountPaise,
      lastUsedAt: last,
    })
  }
}

/**
 * The latest orders that used a discount, newest first, for its detail page. No customer
 * details: a discount reader may not see customers; the order link shows them to those who can.
 */
export async function recentUses(tx: StoreTx, id: string) {
  return tx
    .select({
      orderId: order.id,
      number: order.number,
      status: order.status,
      totalPaise: order.totalPaise,
      amountPaise: discountUsage.amountPaise,
      usedAt: discountUsage.createdAt,
    })
    .from(discountUsage)
    .innerJoin(order, eq(order.id, discountUsage.orderId))
    .where(and(eq(discountUsage.discountId, id), eq(order.isTest, false)))
    .orderBy(desc(discountUsage.createdAt))
    .limit(RECENT_USES)
}
