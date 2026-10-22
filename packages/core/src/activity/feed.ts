/** SOURCE OF TRUTH: the admin's activity bell — WHAT: what needs the merchant now (payments to refund, stock out or running low, return requests, photos that failed processing) and what just happened (new orders, refund flags, returns), each part only for staff whose role may see it / WHY: read from the data itself, so the bell can never disagree with the pages it links to and needs no table of its own */
import {
  inventoryLevel,
  media,
  order,
  payment,
  product,
  refund,
  returnRequest,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm'
import { storeLowStockThreshold } from '../catalog/stock-threshold'
import { notSystemTest } from '../catalog/system-test'
import { type Permission, permissions } from '../permissions/statement'

/** How far back "just happened" goes. */
const ACTIVITY_DAYS = 7
/** Most recent events the bell lists. */
const ACTIVITY_MAX = 25

export type ActivityAttention = {
  /** Refunds the gateway accepted and then failed (last 30 days): the shopper has no money back. */
  refundsFailed: number
  refundsNeeded: number
  outOfStock: number
  lowStock: number
  returnsRequested: number
  mediaFailed: number
}

export type ActivityEvent =
  | { kind: 'order'; id: string; at: string; number: number; totalPaise: number }
  | {
      kind: 'refund_needed'
      id: string
      at: string
      orderId: string
      number: number
      amountPaise: number
    }
  | { kind: 'return'; id: string; at: string; number: number }

export type ActivityFeed = {
  attention: ActivityAttention
  events: ActivityEvent[]
}

const since = () => new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000)

async function orderEvents(tx: StoreTx): Promise<ActivityEvent[]> {
  const rows = await tx
    .select({
      id: order.id,
      number: order.number,
      totalPaise: order.totalPaise,
      at: order.placedAt,
    })
    .from(order)
    .where(and(ne(order.status, 'draft'), gte(order.placedAt, since())))
    .orderBy(desc(order.placedAt))
    .limit(ACTIVITY_MAX)
  return rows.map((r) => ({ kind: 'order', ...r, at: r.at.toISOString() }))
}

async function refundEvents(tx: StoreTx): Promise<ActivityEvent[]> {
  const rows = await tx
    .select({
      id: payment.id,
      orderId: payment.orderId,
      number: order.number,
      amountPaise: payment.amountPaise,
      at: payment.createdAt,
    })
    .from(payment)
    .innerJoin(order, eq(order.id, payment.orderId))
    .where(and(eq(payment.refundNeeded, true), eq(payment.status, 'captured')))
    .orderBy(desc(payment.createdAt))
    .limit(ACTIVITY_MAX)
  return rows.map((r) => ({ kind: 'refund_needed', ...r, at: r.at.toISOString() }))
}

async function returnEvents(tx: StoreTx): Promise<ActivityEvent[]> {
  const rows = await tx
    .select({ id: returnRequest.id, number: returnRequest.number, at: returnRequest.requestedAt })
    .from(returnRequest)
    .where(gte(returnRequest.requestedAt, since()))
    .orderBy(desc(returnRequest.requestedAt))
    .limit(ACTIVITY_MAX)
  return rows.map((r) => ({ kind: 'return', ...r, at: r.at.toISOString() }))
}

/** Tracked variants of live products by what they have left, against the store's threshold. */
async function stockCounts(tx: StoreTx, storeId: string) {
  const threshold = await storeLowStockThreshold(tx, storeId)
  const available = tx
    .select({
      variantId: inventoryLevel.variantId,
      left: sql<number>`sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved})::int`.as('left'),
    })
    .from(inventoryLevel)
    .groupBy(inventoryLevel.variantId)
    .as('available')
  const [row] = await tx
    .select({
      out: sql<number>`count(*) filter (where ${available.left} <= 0)::int`,
      low: sql<number>`count(*) filter (where ${available.left} > 0 and ${available.left} <= ${threshold})::int`,
    })
    .from(available)
    .innerJoin(variant, eq(variant.id, available.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(variant.trackInventory, true),
        eq(product.status, 'active'),
        eq(product.isGiftCard, false),
        notSystemTest,
      ),
    )
  return { outOfStock: row?.out ?? 0, lowStock: row?.low ?? 0 }
}

async function countOf(
  tx: StoreTx,
  table: 'failedRefunds' | 'refunds' | 'returns' | 'media',
): Promise<number> {
  if (table === 'failedRefunds') {
    const [failed] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(refund)
      .where(
        and(
          eq(refund.status, 'failed'),
          gte(refund.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        ),
      )
    return failed?.n ?? 0
  }
  const [row] =
    table === 'refunds'
      ? await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(payment)
          .where(and(eq(payment.refundNeeded, true), eq(payment.status, 'captured')))
      : table === 'returns'
        ? await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(returnRequest)
            .where(eq(returnRequest.status, 'requested'))
        : await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(media)
            .where(eq(media.status, 'failed'))
  return row?.n ?? 0
}

/**
 * The bell's contents for one member: `can` is their role's check, so a member who may not
 * see orders gets no order events or refund counts, and so on.
 */
export async function loadActivityFeed(
  tx: StoreTx,
  storeId: string,
  can: (permission: Permission) => boolean,
): Promise<ActivityFeed> {
  const orders = can(permissions.ORDERS_READ)
  const stock = can(permissions.INVENTORY_READ)
  const files = can(permissions.CONTENT_READ)
  const attention: ActivityAttention = {
    refundsFailed: orders ? await countOf(tx, 'failedRefunds') : 0,
    refundsNeeded: orders ? await countOf(tx, 'refunds') : 0,
    returnsRequested: orders ? await countOf(tx, 'returns') : 0,
    mediaFailed: files ? await countOf(tx, 'media') : 0,
    ...(stock ? await stockCounts(tx, storeId) : { outOfStock: 0, lowStock: 0 }),
  }
  const events = orders
    ? [...(await orderEvents(tx)), ...(await refundEvents(tx)), ...(await returnEvents(tx))]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, ACTIVITY_MAX)
    : []
  return { attention, events }
}
