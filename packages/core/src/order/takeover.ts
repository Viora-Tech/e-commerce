/** SOURCE OF TRUTH: takeOverImportedOrder — WHAT: turn an imported order that is still open into one worked here (ship, cancel, edit) / WHY: a migration brings over live orders, not only history, and staff must be able to finish them */
import { siteConfig } from '@commerce/config/site'
import { fulfillmentOrder, fulfillmentOrderLine, order, orderLine, orderNote } from '@commerce/db'
import { and, eq, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { holdTakenOverStock } from './committed-stock'
import { canTakeOver } from './edit-rules'
import { ensureFulfillmentOrders } from './fulfillment-orders'
import { recomputeOrderStatuses } from './recompute'

export class OrderNotTakeable extends CommerceError {
  readonly reason: 'not_found' | 'not_imported' | 'closed'
  constructor(orderId: string, reason: OrderNotTakeable['reason'], storeId?: string) {
    super(
      'ORDER_NOT_TAKEABLE',
      reason === 'closed'
        ? 'Only an imported order that is still open (not shipped, not cancelled) can be managed here'
        : reason === 'not_imported'
          ? `Order ${orderId} was placed here; there is nothing to take over`
          : `Order ${orderId} not found`,
      { storeId },
    )
    this.reason = reason
  }
}

/** "Cash on Delivery (COD)" and the like, as Shopify names the gateway. */
const COD_NAME = /cash on delivery|\bcod\b/i

const TAKEOVER_NOTE = (source: string) =>
  `Imported from ${source[0]?.toUpperCase() ?? ''}${source.slice(1)} and now managed in ${siteConfig.brand.name}: it can be shipped, edited and cancelled here. Stock was not taken again; its unsent items are held as committed.`

/**
 * "Manage this order" on the Imported card. The order stops being a read-only import (`imported_from`
 * is cleared, the source kept in `import_meta.takenOver`), so fulfilment, cancel and edit work
 * as on an order placed here, and a re-run of the import leaves it alone. Stock is not taken
 * again: the source platform already took these units out of the counts that were imported, so
 * each unsent unit is held as committed with on hand raised by the same amount (available does
 * not move). Packing then ships it out and a cancel gives it back like any order's. The
 * payment the import recorded stays the source platform's: it can only be refunded by hand.
 * Recorded on the timeline. Locks the order; a second call finds it already taken over.
 */
export async function takeOverImportedOrder(
  ctx: StoreContext,
  orderId: string,
  author: string,
): Promise<typeof order.$inferSelect> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) throw new OrderNotTakeable(orderId, 'not_found', ctx.storeId)
  if (!o.importedFrom) {
    if (o.importMeta?.takenOver) return o
    throw new OrderNotTakeable(orderId, 'not_imported', ctx.storeId)
  }
  if (!canTakeOver(o)) throw new OrderNotTakeable(orderId, 'closed', ctx.storeId)
  const source = o.importedFrom
  const meta = o.importMeta ?? { name: `#${o.number}` }
  // An unpaid cash on delivery order keeps collecting at the door once it ships from here.
  const cod = !o.checkoutPaidAt && COD_NAME.test(meta.paymentMethod ?? '')
  await ctx.tx
    .update(order)
    .set({
      importedFrom: null,
      importMeta: { ...meta, takenOver: { at: new Date().toISOString(), by: author, source } },
      ...(cod && !o.paymentMethod ? { paymentMethod: 'cod' } : {}),
    })
    .where(eq(order.id, orderId))
  // Parcels where each variant sells from (an earlier backfill may already have made them).
  await ensureFulfillmentOrders(ctx, orderId)
  const units = await ctx.tx
    .select({
      variantId: orderLine.variantId,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
      locationId: fulfillmentOrder.locationId,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
    .where(and(eq(fulfillmentOrder.orderId, orderId), ne(fulfillmentOrder.status, 'cancelled')))
  for (const u of units) {
    await holdTakenOverStock(ctx, {
      variantId: u.variantId,
      quantity: u.quantity - u.fulfilledQuantity,
      locationId: u.locationId,
    })
  }
  await ctx.tx
    .insert(orderNote)
    .values({ storeId: ctx.storeId, orderId, body: TAKEOVER_NOTE(source), author })
  await recomputeOrderStatuses(ctx, orderId)
  const [after] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!after) throw new OrderNotTakeable(orderId, 'not_found', ctx.storeId)
  return after
}
