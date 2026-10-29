/** SOURCE OF TRUTH: reviseForOrderEdit — WHAT: what an order edit does to the order's GST documents / WHY: a queued invoice must bill the edited order, and an issued one that now bills too little, or names the old shipping rate, is re-issued while the law still lets it be cancelled */
import { fulfillmentOrder, order, type StoreTx } from '@commerce/db'
import { shippingChargeDescription } from '@commerce/invoices'
import { and, eq } from 'drizzle-orm'
import { InvoiceError, liveDocuments, regenerateDocument } from './issue'
import { cancelInvoice } from './queue'
import { invoice } from './schema'

const EDIT_CANCEL_REASON = 'Order edited: re-issued with the new items'
const RELABEL_CANCEL_REASON = 'Order edited: re-issued with the new shipping or discount name'

type SnapshotLabels = {
  lines?: { description?: string; charge?: boolean }[]
  discountLabel?: string | null
}

/**
 * The invoice prints a shipping name or discount reason the order no longer has (the edit
 * changed the rate, #923 follow-up). Read loosely: an older snapshot without them is not stale.
 */
function namesStale(
  snapshot: unknown,
  o: { shippingRateName: string | null; discountLabel: string | null },
): boolean {
  const snap = (snapshot ?? {}) as SnapshotLabels
  const shippingLine = (snap.lines ?? []).find(
    (l) => l.charge && l.description?.startsWith('Shipping charges'),
  )
  if (shippingLine && shippingLine.description !== shippingChargeDescription(o.shippingRateName)) {
    return true
  }
  if (snap.discountLabel === undefined) return false
  return (snap.discountLabel?.trim() || null) !== (o.discountLabel?.trim() || null)
}

export type EditRevision = {
  /** Queued drafts rebuilt from the edited order. */
  regenerated: number
  /** Issued invoices cancelled because the edit added to what they bill (a new one follows). */
  cancelled: string[]
  /** Issued invoices that bill too little but can no longer be cancelled (filed, or credited). */
  locked: string[]
  /** Issued invoices that keep the old shipping or discount name: filed, or credited. */
  oldNames: string[]
  /**
   * Which rule to re-run so cancelled invoices and new parcels get theirs: `paid` for an order
   * paid at checkout that had an invoice; `fulfilled` for an unpaid one (cash on delivery,
   * invoiced at dispatch) whose invoice was cancelled here, now that it can be edited after
   * shipping; null when nothing needs issuing.
   */
  reissue: 'paid' | 'fulfilled' | null
}

/**
 * The GST side of `order.edited`, in one transaction:
 * - Queued (draft) invoices are rebuilt from the order as it is now.
 * - An issued invoice whose parcel now bills more than it says (items added) is cancelled, while
 *   it may be (not in a filed GSTR-1, no credit note against the order), so the caller issues a
 *   fresh one for the parcel. One that can no longer be cancelled is reported for the merchant.
 * - The same for one that bills the same amount but prints the old shipping name or discount
 *   reason (the edit changed the rate), so the invoice names the new one.
 * - A parcel that is packed or shipped keeps its money through an edit (`retaxOrder`), so its
 *   invoice is only re-issued when the edit repriced its own lines or the order's charges.
 * - Items taken off are not handled here: their refund (`refund.created`) brings the credit note,
 *   as for any refund of an invoiced order.
 * New parcels the edit made get their invoice from the caller's re-run of the paid rule.
 */
export async function reviseForOrderEdit(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<EditRevision> {
  const out: EditRevision = {
    regenerated: 0,
    cancelled: [],
    locked: [],
    oldNames: [],
    reissue: null,
  }
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
    .select({
      checkoutPaidAt: order.checkoutPaidAt,
      shippingRateName: order.shippingRateName,
      discountLabel: order.discountLabel,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (issued.length === 0) return out
  if (o?.checkoutPaidAt) out.reissue = 'paid'
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
    const now = parcel.totalPaise ?? 0
    const billed = d.totalPaise ?? 0
    // A lower amount is credited by the refund's credit note; re-issuing too would credit twice.
    const more = now > billed
    const renamed = now === billed && !!o && namesStale(d.snapshot, o)
    if (!more && !renamed) continue
    if (d.reportedPeriod || credited.length > 0) {
      ;(more ? out.locked : out.oldNames).push(d.number ?? d.id)
      continue
    }
    await cancelInvoice(tx, d.id, more ? EDIT_CANCEL_REASON : RELABEL_CANCEL_REASON)
    out.cancelled.push(d.number ?? d.id)
  }
  if (!out.reissue && out.cancelled.length > 0) out.reissue = 'fulfilled'
  return out
}
