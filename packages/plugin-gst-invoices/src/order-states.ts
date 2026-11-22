/** SOURCE OF TRUTH: GST invoices order states
 * WHAT:  Whether each order on screen is invoiced, for the order actions' `whenState`: Generate
 *        and Add to queue while a parcel still has no live tax invoice, Email and Download once
 *        one of ours (with a PDF) is issued.
 * WHY:   The order page's More actions kept offering "Generate GST invoice" on an invoiced order
 *        (owner, 22 Nov 2026). An invoice recorded from outside Koomerce ("Already invoiced",
 *        record-external.ts) counts as invoiced but has no PDF to send.
 * WHERE: `orderStates` on the manifest (plugin.ts); asked by `apps.orderStates` for a page of
 *        orders: two statements whatever the page size.
 */
import { fulfillmentOrder } from '@commerce/db'
import type { OrderStatesContext } from '@commerce/plugins'
import { and, count, eq, inArray, ne } from 'drizzle-orm'
import { invoice } from './schema'

/** Every parcel has an issued tax invoice (ours or recorded) and none waits in the queue. */
export const INVOICED = 'invoiced'
/** At least one issued tax invoice is ours, so there is a PDF to email or download. */
export const INVOICE_PDF = 'invoice-pdf'
/** Issued tax invoices exist, all recorded from outside Koomerce: invoiced, no PDF. */
const INVOICED_OUTSIDE = 'invoiced-outside'

/** One live (not cancelled) tax invoice of an order. */
export type LiveInvoice = {
  fulfillmentOrderId: string | null
  status: 'draft' | 'issued' | 'cancelled'
  source: 'koomerce' | 'external'
}

/**
 * An order's states from its live tax invoices and its live parcel count. An order with no
 * parcel is invoiced as a whole (`enqueueOrderParcels`), so it needs one invoice.
 */
export function invoiceStates(docs: readonly LiveInvoice[], parcels: number): string[] {
  const issued = docs.filter((d) => d.status === 'issued')
  if (issued.length === 0) return []
  const waiting = docs.some((d) => d.status === 'draft')
  const covered = new Set(issued.map((d) => d.fulfillmentOrderId ?? 'order')).size
  const states: string[] = []
  if (!waiting && covered >= Math.max(1, parcels)) states.push(INVOICED)
  states.push(issued.some((d) => d.source !== 'external') ? INVOICE_PDF : INVOICED_OUTSIDE)
  return states
}

/** `orderStates` for the manifest: the states of each of these orders that has any. */
export async function gstOrderStates(
  ctx: OrderStatesContext,
  orderIds: readonly string[],
): Promise<Record<string, string[]>> {
  if (orderIds.length === 0) return {}
  const ids = [...orderIds]
  const docs = await ctx.tx
    .select({
      orderId: invoice.orderId,
      fulfillmentOrderId: invoice.fulfillmentOrderId,
      status: invoice.status,
      source: invoice.source,
    })
    .from(invoice)
    .where(
      and(
        inArray(invoice.orderId, ids),
        eq(invoice.kind, 'tax_invoice'),
        ne(invoice.status, 'cancelled'),
      ),
    )
  if (docs.length === 0) return {}
  const parcelRows = await ctx.tx
    .select({ orderId: fulfillmentOrder.orderId, n: count() })
    .from(fulfillmentOrder)
    .where(and(inArray(fulfillmentOrder.orderId, ids), ne(fulfillmentOrder.status, 'cancelled')))
    .groupBy(fulfillmentOrder.orderId)
  const parcels = new Map(parcelRows.map((r) => [r.orderId, Number(r.n)]))
  const byOrder = new Map<string, LiveInvoice[]>()
  for (const d of docs) {
    if (!d.orderId) continue
    byOrder.set(d.orderId, [...(byOrder.get(d.orderId) ?? []), d])
  }
  const out: Record<string, string[]> = {}
  for (const [orderId, list] of byOrder) {
    const states = invoiceStates(list, parcels.get(orderId) ?? 0)
    if (states.length) out[orderId] = states
  }
  return out
}
