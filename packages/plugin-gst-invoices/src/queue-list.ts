/**
 * The Queue's rows: queued tax invoice drafts with the page's filters (GSTIN, due dates, search,
 * payment). Split out of `./queue` so that file stays one concern (issuing); re-exported there.
 */
import { order, type StoreTx } from '@commerce/db'
import { and, asc, eq, gte, lt, type SQL, sql } from 'drizzle-orm'
import { type PaymentFilter, paymentCondition, queueSearch } from './list-query'
import { sameRegistration } from './registration'
import { invoice } from './schema'

export type QueueFilter = {
  /** When the draft became due (`eligible_at`): inclusive start, exclusive end. */
  from?: Date | undefined
  to?: Date | undefined
  /** Order number or customer name (`queueSearch`). */
  q?: string | undefined
  /** One GSTIN's drafts (null: a store without a registration); undefined: every GSTIN. */
  gstRegistrationId?: string | null | undefined
  /** Cash on delivery or prepaid orders only. */
  payment?: PaymentFilter | undefined
}

/**
 * An issued tax invoice already bills this draft's goods: one for the whole order (no parcel),
 * one for the same parcel, or any when the draft itself is for the whole order. Such a draft is
 * stale (an order invoiced before it had parcels, queued again when it shipped) and issuing it
 * would invoice the goods twice (owner, 26 Nov 2026: "Ready" rows of invoiced orders).
 */
export const alreadyInvoicedDraft = (): SQL =>
  sql`exists (select 1 from ${invoice} as done
    where done.order_id = ${invoice.orderId} and done.kind = 'tax_invoice' and done.status = 'issued'
      and (done.fulfillment_order_id is null or ${invoice.fulfillmentOrderId} is null
        or done.fulfillment_order_id = ${invoice.fulfillmentOrderId}))`

/**
 * Tax invoices waiting to be issued. Drafts queued before their order was cancelled, and drafts
 * whose goods an issued invoice already bills (`alreadyInvoicedDraft`), stay out of the queue
 * and its counts.
 */
export const queuedInvoiceDrafts = (): SQL =>
  and(
    eq(invoice.kind, 'tax_invoice'),
    eq(invoice.status, 'draft'),
    sql`not exists (select 1 from ${order} where ${order.id} = ${invoice.orderId} and ${order.status} = 'cancelled')`,
    sql`not ${alreadyInvoicedDraft()}`,
  ) as SQL

/** The Queue page's conditions: what `listQueue` lists and `queueBarRead` counts. */
export function queueConditions(filter: QueueFilter): SQL | undefined {
  return and(
    queuedInvoiceDrafts(),
    filter.gstRegistrationId === undefined
      ? undefined
      : sameRegistration(invoice.gstRegistrationId, filter.gstRegistrationId),
    filter.from ? gte(invoice.eligibleAt, filter.from) : undefined,
    filter.to ? lt(invoice.eligibleAt, filter.to) : undefined,
    queueSearch(filter.q),
    paymentCondition(filter.payment),
  )
}

export async function listQueue(tx: StoreTx, filter: QueueFilter) {
  return tx.select().from(invoice).where(queueConditions(filter)).orderBy(
    // By day, then order number: the order the batch is numbered in (`issueDrafts`).
    sql`date_trunc('day', ${invoice.eligibleAt} at time zone 'Asia/Kolkata')`,
    sql`(select ${order.number} from ${order} where ${order.id} = ${invoice.orderId})`,
    asc(invoice.eligibleAt),
    asc(invoice.createdAt),
  )
}
