/** SOURCE OF TRUTH: courier invoice number — WHAT: the order's issued GST invoice number for bookings / WHY: export papers must match the GST invoice */
import { sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

/**
 * The order's issued GST tax invoice number ("VI/EXP/26-27/004"), for couriers that print the
 * invoice on their papers (ShipGlobal's export booking sends it as `invoice_no`). The invoice of
 * the parcel being booked wins over an order-level one; the latest issued counts. Null when the
 * GST invoices app has issued none for the order; the courier then gets the order number.
 *
 * The invoice table belongs to the GST invoices app, so this reads it by name rather than by
 * importing the app's schema (core does not depend on apps).
 */
export async function issuedInvoiceNumber(
  ctx: Pick<StoreContext, 'tx'>,
  orderId: string,
  fulfillmentOrderId: string | null,
): Promise<string | null> {
  const rows = await ctx.tx.execute<{ number: string | null }>(sql`
    select number from invoice
    where order_id = ${orderId}
      and kind = 'tax_invoice'
      and status = 'issued'
      and number is not null
    order by (fulfillment_order_id is not distinct from ${fulfillmentOrderId}) desc,
             created_at desc
    limit 1`)
  return rows[0]?.number ?? null
}
