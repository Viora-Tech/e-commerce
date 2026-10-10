/** SOURCE OF TRUTH: invoiceParcels, parcelSource
 * WHAT:  The parcels (fulfilment orders) an order's tax invoices bill, and what one parcel's
 *        invoice prints: its goods, its share of the order's money and GST, and its GSTIN.
 * WHY:   An order shipped from two warehouses is two supplies from two GSTINs, so it gets one
 *        tax invoice per parcel, each numbered in its own GSTIN's series. Checkout stored each
 *        parcel's share and tax (@commerce/core tax/parcel-gst.ts); an invoice prints exactly
 *        that, so the two invoices add up to what the shopper paid. A parcel without stored
 *        figures (a converted draft) takes the order's discount, fee and shipping by goods
 *        value, and the tax is worked out from its lines and GSTIN.
 * WHERE: queue.ts makes one draft per parcel; issue.ts `orderSnapshot` builds a parcel's
 *        document. Order-level documents (confirmation, packing slip, vouchers) stay per order.
 */
import { ensureFulfillmentOrders } from '@commerce/core/fulfillment-orders'
import { allocatePaise } from '@commerce/core/gst'
import {
  fulfillmentOrder,
  fulfillmentOrderLine,
  gstRegistration,
  order,
  orderLine,
  type StoreTx,
} from '@commerce/db'
import { and, asc, eq, ne } from 'drizzle-orm'

export type InvoiceParcel = typeof fulfillmentOrder.$inferSelect

/**
 * The parcels an order's tax invoices bill, in parcel order. Parcels are made first for an
 * order that predates them; a cancelled parcel sent nothing and is never invoiced.
 */
export async function invoiceParcels(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<InvoiceParcel[]> {
  await ensureFulfillmentOrders({ tx, storeId }, orderId)
  return tx
    .select()
    .from(fulfillmentOrder)
    .where(and(eq(fulfillmentOrder.orderId, orderId), ne(fulfillmentOrder.status, 'cancelled')))
    .orderBy(asc(fulfillmentOrder.position))
}

/** One parcel's invoice inputs. */
export type ParcelSource = {
  parcel: InvoiceParcel
  /** Units of each order line in this parcel. */
  quantities: Map<string, number>
  shippingPaise: number
  discountPaise: number
  paymentAdjustmentPaise: number
  totalPaise: number
  /** The parcel's stored GST split; null when it has none (worked out from the lines). */
  taxBreakdown: unknown
  /** Billed under a composition-scheme GSTIN: a bill of supply, no GST. */
  composition: boolean
}

export async function parcelSource(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  parcelId: string,
): Promise<ParcelSource> {
  const parcels = await invoiceParcels(tx, storeId, orderId)
  const parcel = parcels.find((p) => p.id === parcelId)
  if (!parcel) throw new Error(`parcel ${parcelId} is not a live parcel of order ${orderId}`)
  const rows = await tx
    .select({
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      orderLineId: fulfillmentOrderLine.orderLineId,
      quantity: fulfillmentOrderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
    .where(eq(orderLine.orderId, orderId))
  const quantities = new Map<string, number>()
  for (const r of rows) {
    if (r.fulfillmentOrderId !== parcelId) continue
    quantities.set(r.orderLineId, (quantities.get(r.orderLineId) ?? 0) + r.quantity)
  }
  const [registration] = parcel.gstRegistrationId
    ? await tx
        .select({ type: gstRegistration.registrationType })
        .from(gstRegistration)
        .where(eq(gstRegistration.id, parcel.gstRegistrationId))
    : []
  const composition = registration?.type === 'composition'
  if (parcel.totalPaise !== null) {
    return {
      parcel,
      quantities,
      shippingPaise: parcel.shippingPaise ?? 0,
      discountPaise: parcel.discountPaise ?? 0,
      paymentAdjustmentPaise: parcel.adjustmentPaise ?? 0,
      totalPaise: parcel.totalPaise,
      taxBreakdown: parcel.taxBreakdown,
      composition,
    }
  }
  // No stored share: the order's money by goods value over its live parcels.
  const [o] = await tx.select().from(order).where(eq(order.id, orderId))
  if (!o) throw new Error(`order ${orderId} not found`)
  const goods = parcels.map((p) =>
    rows
      .filter((r) => r.fulfillmentOrderId === p.id)
      .reduce((sum, r) => sum + r.quantity * r.unitPricePaise, 0),
  )
  const at = parcels.indexOf(parcel)
  const shareOf = (total: number) => {
    const parts = allocatePaise(Math.abs(total), goods)
    return (total < 0 ? -1 : 1) * (parts[at] ?? 0)
  }
  const shippingPaise = shareOf(o.shippingPaise)
  const discountPaise = shareOf(o.discountPaise)
  const paymentAdjustmentPaise = shareOf(o.paymentAdjustmentPaise)
  return {
    parcel,
    quantities,
    shippingPaise,
    discountPaise,
    paymentAdjustmentPaise,
    totalPaise: (goods[at] ?? 0) - discountPaise + paymentAdjustmentPaise + shippingPaise,
    // One parcel is the whole order: its recorded split applies as it is.
    taxBreakdown: parcels.length === 1 ? o.taxBreakdown : null,
    composition,
  }
}
