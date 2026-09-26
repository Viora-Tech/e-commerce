/** SOURCE OF TRUTH: RTO (return to origin) — WHAT: when tracking says a parcel came back undelivered, record it and open a "Returned to you (RTO)" task on the order; RTO counts and costs for the Shipments workspace / WHY: an RTO ties up stock and money, and the merchant must restock and then refund or re-ship; one idempotent writer means a repeated tracking scan never opens two tasks */
import {
  order,
  orderLine,
  orderNote,
  returnRequest,
  returnRequestLine,
  shipment,
} from '@commerce/db'
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import type { ShipmentRow } from '../shipping/shipments'
import { returnLabel } from './policy'
import { nextReturnNumber } from './service'

/**
 * Called by `applyTracking` when a shipment turns `rto`. Stamps when it came
 * back, opens one RTO task (a `return_request` of kind `rto`, already
 * received) covering what the parcel carried, notes it on the order timeline
 * and writes `order.rto`. Safe to repeat: the unique index on the shipment
 * means a second call finds the first task and does nothing.
 */
export async function recordRtoForShipment(ctx: StoreContext, row: ShipmentRow) {
  const [existing] = await ctx.tx
    .select({ id: returnRequest.id })
    .from(returnRequest)
    .where(and(eq(returnRequest.shipmentId, row.id), eq(returnRequest.kind, 'rto')))
  if (existing) return null
  const now = new Date()
  await ctx.tx
    .update(shipment)
    .set({ rtoDeliveredAt: now })
    .where(and(eq(shipment.id, row.id), isNull(shipment.rtoDeliveredAt)))
  const lines = await ctx.tx
    .select({ id: orderLine.id, quantity: orderLine.fulfilledQuantity })
    .from(orderLine)
    .where(and(eq(orderLine.orderId, row.orderId), eq(orderLine.giftCard, false)))
  const shipped = lines.filter((l) => l.quantity > 0)

  const number = await nextReturnNumber(ctx)
  const [task] = await ctx.tx
    .insert(returnRequest)
    .values({
      storeId: ctx.storeId,
      orderId: row.orderId,
      number,
      kind: 'rto',
      status: 'received',
      shipmentId: row.id,
      restock: false,
      requestedBy: 'system',
      requestedAt: now,
      receivedAt: now,
    })
    .onConflictDoNothing()
    .returning()
  if (!task) return null
  if (shipped.length > 0) {
    await ctx.tx.insert(returnRequestLine).values(
      shipped.map((l) => ({
        storeId: ctx.storeId,
        returnRequestId: task.id,
        orderLineId: l.id,
        quantity: l.quantity,
      })),
    )
  }
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: row.orderId,
    body: `Parcel ${row.waybill} came back to you (RTO). Task ${returnLabel(number)}: restock the items, then refund or re-ship.`,
    author: null,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.rto', {
    orderId: row.orderId,
    returnId: task.id,
  })
  return task
}

const DAY_MS = 86_400_000

/**
 * RTO numbers for the Shipments workspace: how many parcels came back, what
 * share of shipments that is, what the goods were worth, what the courier
 * charged (as typed by the merchant) and how many still wait on a decision.
 */
export async function rtoSummary(ctx: StoreContext, sinceDays = 30, now: Date = new Date()) {
  const since = new Date(now.getTime() - sinceDays * DAY_MS)
  const [rto] = await ctx.tx
    .select({
      count: count(),
      goodsPaise: sql<number>`coalesce(sum(${order.totalPaise}), 0)::int`,
      courierPaise: sql<number>`coalesce(sum(${returnRequest.courierCostPaise}), 0)::int`,
      missingCost: sql<number>`count(*) filter (where ${returnRequest.courierCostPaise} is null)::int`,
    })
    .from(returnRequest)
    .innerJoin(order, eq(order.id, returnRequest.orderId))
    .where(
      and(
        eq(returnRequest.storeId, ctx.storeId),
        eq(returnRequest.kind, 'rto'),
        gte(returnRequest.requestedAt, since),
      ),
    )
  const [shipped] = await ctx.tx
    .select({ count: count() })
    .from(shipment)
    .where(and(eq(shipment.storeId, ctx.storeId), gte(shipment.createdAt, since)))
  const [open] = await ctx.tx
    .select({ count: count() })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.storeId, ctx.storeId),
        eq(returnRequest.kind, 'rto'),
        eq(returnRequest.status, 'received'),
      ),
    )
  const rtoCount = Number(rto?.count ?? 0)
  const shipments = Number(shipped?.count ?? 0)
  return {
    sinceDays,
    count: rtoCount,
    shipments,
    ratePercent: shipments > 0 ? Math.round((rtoCount / shipments) * 1000) / 10 : 0,
    goodsPaise: Number(rto?.goodsPaise ?? 0),
    courierPaise: Number(rto?.courierPaise ?? 0),
    missingCost: Number(rto?.missingCost ?? 0),
    open: Number(open?.count ?? 0),
  }
}
