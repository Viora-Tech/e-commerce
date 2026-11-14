/** SOURCE OF TRUTH: voidUnshippedSale — WHAT: an order cancelled and refunded in full before anything left the shop, with nothing reported in a filed GSTR-1, has its tax invoices (and any credit notes made for it) cancelled instead of being reversed by a credit note / WHY: owner, 14 Nov 2026 (#2471): no supply happened, so the sale should not show in GSTR-1 at all; a credit note is for refunds after dispatch or after filing / WHERE: plugin.ts onRefund (before a credit note is made) and onOrderCancelled (the refund may come first) */
import { order, refund, type StoreTx, shipment } from '@commerce/db'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { invoice } from './schema'

/** A shipment in one of these has left the shop: the supply happened. */
const LEFT = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'rto'] as const

/**
 * Cancels the order's issued tax invoices and credit notes when the sale never happened: the
 * order is cancelled, no parcel left, the refunds cover every invoice, and none is reported in a
 * filed GSTR-1. Returns the numbers cancelled, or `null` when the rule does not apply (then a
 * refund is credited the usual way).
 */
export async function voidUnshippedSale(tx: StoreTx, orderId: string): Promise<string[] | null> {
  const [o] = await tx.select({ status: order.status }).from(order).where(eq(order.id, orderId))
  if (o?.status !== 'cancelled') return null
  const [left] = await tx
    .select({ id: shipment.id })
    .from(shipment)
    .where(and(eq(shipment.orderId, orderId), inArray(shipment.status, [...LEFT])))
    .limit(1)
  if (left) return null
  const docs = await tx
    .select()
    .from(invoice)
    .where(
      and(
        eq(invoice.orderId, orderId),
        inArray(invoice.kind, ['tax_invoice', 'credit_note']),
        eq(invoice.status, 'issued'),
      ),
    )
  const invoices = docs.filter((d) => d.kind === 'tax_invoice')
  if (invoices.length === 0 || docs.some((d) => d.reportedPeriod)) return null
  const [paid] = await tx
    .select({ back: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int` })
    .from(refund)
    .where(and(eq(refund.orderId, orderId), ne(refund.status, 'failed')))
  const billed = invoices.reduce((sum, d) => sum + d.totalPaise, 0)
  if ((paid?.back ?? 0) < billed) return null
  const now = new Date()
  // Credit notes first: an invoice with a live credit note against it cannot be cancelled.
  const ordered = [...docs].sort(
    (a, b) => Number(a.kind === 'tax_invoice') - Number(b.kind === 'tax_invoice'),
  )
  for (const d of ordered) {
    await tx
      .update(invoice)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: 'Order cancelled and refunded before dispatch',
        updatedAt: now,
      })
      .where(eq(invoice.id, d.id))
  }
  return ordered.map((d) => d.number ?? d.id)
}
