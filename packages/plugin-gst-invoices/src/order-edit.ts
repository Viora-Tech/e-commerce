/** SOURCE OF TRUTH: reviseForOrderEdit — WHAT: what an order edit does to the order's GST documents / WHY: a queued invoice must bill the edited order, and an issued one that now bills too little is re-issued while the law still lets it be cancelled */
import { fulfillmentOrder, order, type StoreTx } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { InvoiceError, liveDocuments, regenerateDocument } from './issue'
import { cancelInvoice } from './queue'
import { invoice } from './schema'

const EDIT_CANCEL_REASON = 'Order edited: re-issued with the new items'

export type EditRevision = {
  /** Queued drafts rebuilt from the edited order. */
  regenerated: number
  /** Issued invoices cancelled because the edit added to what they bill (a new one follows). */
  cancelled: string[]
  /** Issued invoices that bill too little but can no longer be cancelled (filed, or credited). */
  locked: string[]
  /** The order is paid at checkout and had or now needs an invoice: re-run the paid rule. */
  reissue: boolean
}

/**
 * The GST side of `order.edited`, in one transaction:
 * - Queued (draft) invoices are rebuilt from the order as it is now.
 * - An issued invoice whose parcel now bills more than it says (items added) is cancelled, while
 *   it may be (not in a filed GSTR-1, no credit note against the order), so the caller issues a
 *   fresh one for the parcel. One that can no longer be cancelled is reported for the merchant.
 * - Items taken off are not handled here: their refund (`refund.created`) brings the credit note,
 *   as for any refund of an invoiced order.
 * New parcels the edit made get their invoice from the caller's re-run of the paid rule.
 */
export async function reviseForOrderEdit(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<EditRevision> {
  const out: EditRevision = { regenerated: 0, cancelled: [], locked: [], reissue: false }
  const docs = await liveDocuments(tx, orderId, 'tax_invoice')
  for (const d of docs.filter((x) => x.status === 'draft')) {
    try {
      await regenerateDocument(tx, storeId, d.id)
      out.regenerated++
    } catch (err) {
      if (!(err instanceof InvoiceError)) throw err
    }
  }
  const issued = docs.filter((x) => x.status === 'issued')
  const [o] = await tx
    .select({ checkoutPaidAt: order.checkoutPaidAt })
    .from(order)
    .where(eq(order.id, orderId))
  out.reissue = issued.length > 0 && !!o?.checkoutPaidAt
  if (issued.length === 0) return out
  const credited = await tx
    .select({ id: invoice.id })
    .from(invoice)
    .where(and(eq(invoice.orderId, orderId), eq(invoice.kind, 'credit_note')))
    .limit(1)
  for (const d of issued) {
    if (!d.fulfillmentOrderId) continue
    const [parcel] = await tx
      .select({ status: fulfillmentOrder.status, totalPaise: fulfillmentOrder.totalPaise })
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.id, d.fulfillmentOrderId))
    if (!parcel || parcel.status === 'cancelled') continue
    if ((parcel.totalPaise ?? 0) <= (d.totalPaise ?? 0)) continue
    if (d.reportedPeriod || credited.length > 0) {
      out.locked.push(d.number ?? d.id)
      continue
    }
    await cancelInvoice(tx, d.id, EDIT_CANCEL_REASON)
    out.cancelled.push(d.number ?? d.id)
  }
  return out
}
