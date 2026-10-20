/** SOURCE OF TRUTH: test order exclusion and purge — WHAT `order.isTest` rows are (paid through a gateway on its TEST keys, no real money) / WHY analytics, reports, customer stats and GST invoices leave them out, while the orders list still shows them and "Delete test orders" removes them with their dependent rows */
import {
  discount,
  discountUsage,
  giftCard,
  giftCardTransaction,
  marketingAutomationRun,
  notification,
  order,
  orderLine,
  orderNote,
  payment,
  refund,
  returnRequest,
  returnRequestLine,
  shipment,
} from '@commerce/db'
import { and, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { deleteFulfillmentOrders } from './fulfillment-orders'
import { cancelOrder } from './status'

/** Where-clause fragment: true for real orders, false for test-mode ones. */
export const notTestOrder: SQL = eq(order.isTest, false)

/**
 * How many uses each discount gets back when its usage rows go: one per row,
 * grouped by discount, so a code used on three test orders is released three times.
 */
export function discountReleases(usages: readonly { discountId: string }[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const u of usages) out.set(u.discountId, (out.get(u.discountId) ?? 0) + 1)
  return out
}

/** The store's test orders that the purge may touch: this store, `is_test` only. */
const testOrderScope = (storeId: string) => and(eq(order.storeId, storeId), eq(order.isTest, true))

/** How many test orders the store has ("Delete test orders" shows only when there are some). */
export async function countTestOrders(ctx: StoreContext): Promise<number> {
  const [row] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(testOrderScope(ctx.storeId))
  return row?.n ?? 0
}

/**
 * "Delete test orders": remove every order of this store paid on a gateway's test keys,
 * with the rows that point at it. Live ones are cancelled first, so the stock their
 * parcels hold and any gift card balance they spent go back. A gift card a test order
 * sold is disabled (it was bought with no real money) and kept, unlinked; gift card
 * ledger rows and marketing runs are kept and unlinked; GST documents without a number
 * (packing slips, confirmations, queued drafts) go, numbered ones are never deleted.
 * Every statement is scoped to the store and to the test order ids read under
 * `is_test = true`, so a real order is never touched. Returns how many orders went.
 */
export async function deleteTestOrders(ctx: StoreContext): Promise<number> {
  const { tx, storeId } = ctx
  const rows = await tx
    .select({ id: order.id, status: order.status })
    .from(order)
    .where(testOrderScope(storeId))
    .for('update')
  if (rows.length === 0) return 0
  const ids = rows.map((r) => r.id)

  for (const r of rows) {
    if (r.status !== 'cancelled' && r.status !== 'draft') {
      await cancelOrder(ctx, r.id, { notifyCustomer: false })
    }
  }

  const paymentIds = (
    await tx
      .select({ id: payment.id })
      .from(payment)
      .where(and(eq(payment.storeId, storeId), inArray(payment.orderId, ids)))
  ).map((p) => p.id)

  // Returns and their lines.
  const returnIds = (
    await tx
      .select({ id: returnRequest.id })
      .from(returnRequest)
      .where(and(eq(returnRequest.storeId, storeId), inArray(returnRequest.orderId, ids)))
  ).map((r) => r.id)
  if (returnIds.length) {
    await tx
      .delete(returnRequestLine)
      .where(
        and(
          eq(returnRequestLine.storeId, storeId),
          inArray(returnRequestLine.returnRequestId, returnIds),
        ),
      )
    await tx
      .delete(returnRequest)
      .where(and(eq(returnRequest.storeId, storeId), inArray(returnRequest.id, returnIds)))
  }

  // Gift card ledger rows stay (balances are history); they lose the order and payment link.
  await tx
    .update(giftCardTransaction)
    .set({ orderId: null, paymentId: null })
    .where(
      and(
        eq(giftCardTransaction.storeId, storeId),
        paymentIds.length
          ? or(
              inArray(giftCardTransaction.orderId, ids),
              inArray(giftCardTransaction.paymentId, paymentIds),
            )
          : inArray(giftCardTransaction.orderId, ids),
      ),
    )
  // Cards a test order sold were never paid for: disabled, kept, unlinked.
  await tx
    .update(giftCard)
    .set({ disabledAt: sql`coalesce(${giftCard.disabledAt}, now())`, updatedAt: new Date() })
    .where(
      and(
        eq(giftCard.storeId, storeId),
        inArray(giftCard.orderId, ids),
        isNull(giftCard.disabledAt),
      ),
    )
  await tx
    .update(giftCard)
    .set({ orderId: null, orderLineId: null })
    .where(and(eq(giftCard.storeId, storeId), inArray(giftCard.orderId, ids)))

  await tx
    .update(marketingAutomationRun)
    .set({ orderId: null })
    .where(
      and(
        eq(marketingAutomationRun.storeId, storeId),
        inArray(marketingAutomationRun.orderId, ids),
      ),
    )
  await tx
    .update(marketingAutomationRun)
    .set({ convertedOrderId: null })
    .where(
      and(
        eq(marketingAutomationRun.storeId, storeId),
        inArray(marketingAutomationRun.convertedOrderId, ids),
      ),
    )

  // A discount used on a test order gets that use back.
  const usages = await tx
    .select({ discountId: discountUsage.discountId })
    .from(discountUsage)
    .where(and(eq(discountUsage.storeId, storeId), inArray(discountUsage.orderId, ids)))
  for (const [discountId, n] of discountReleases(usages)) {
    await tx
      .update(discount)
      .set({ usedCount: sql`greatest(${discount.usedCount} - ${n}, 0)` })
      .where(and(eq(discount.storeId, storeId), eq(discount.id, discountId)))
  }
  await tx
    .delete(discountUsage)
    .where(and(eq(discountUsage.storeId, storeId), inArray(discountUsage.orderId, ids)))

  // GST documents without a number (an app's table, same database); numbered ones are kept.
  await tx.execute(
    sql`delete from invoice where store_id = ${storeId} and number is null and order_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  )

  for (const id of ids) await deleteFulfillmentOrders(tx, id)
  await tx
    .delete(shipment)
    .where(and(eq(shipment.storeId, storeId), inArray(shipment.orderId, ids)))
  await tx.delete(refund).where(and(eq(refund.storeId, storeId), inArray(refund.orderId, ids)))
  await tx.delete(payment).where(and(eq(payment.storeId, storeId), inArray(payment.orderId, ids)))
  await tx
    .delete(notification)
    .where(and(eq(notification.storeId, storeId), inArray(notification.orderId, ids)))
  await tx
    .delete(orderNote)
    .where(and(eq(orderNote.storeId, storeId), inArray(orderNote.orderId, ids)))
  await tx
    .delete(orderLine)
    .where(and(eq(orderLine.storeId, storeId), inArray(orderLine.orderId, ids)))
  const gone = await tx
    .delete(order)
    .where(and(testOrderScope(storeId), inArray(order.id, ids)))
    .returning({ id: order.id })
  return gone.length
}
