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
 * Tax invoices waiting to be issued. Drafts queued before their order was cancelled
 * stay out of the queue and its counts.
 */
export const queuedInvoiceDrafts = (): SQL =>
  and(
    eq(invoice.kind, 'tax_invoice'),
    eq(invoice.status, 'draft'),
    sql`not exists (select 1 from ${order} where ${order.id} = ${invoice.orderId} and ${order.status} = 'cancelled')`,
  ) as SQL

export async function listQueue(tx: StoreTx, filter: QueueFilter) {
  const conds: (SQL | undefined)[] = [
    queuedInvoiceDrafts(),
    filter.gstRegistrationId === undefined
      ? undefined
      : sameRegistration(invoice.gstRegistrationId, filter.gstRegistrationId),
    filter.from ? gte(invoice.eligibleAt, filter.from) : undefined,
    filter.to ? lt(invoice.eligibleAt, filter.to) : undefined,
    queueSearch(filter.q),
    paymentCondition(filter.payment),
  ]
  return tx
    .select()
    .from(invoice)
    .where(and(...conds))
    .orderBy(
      // By day, then order number: the order the batch is numbered in (`issueDrafts`).
      sql`date_trunc('day', ${invoice.eligibleAt} at time zone 'Asia/Kolkata')`,
      sql`(select ${order.number} from ${order} where ${order.id} = ${invoice.orderId})`,
      asc(invoice.eligibleAt),
      asc(invoice.createdAt),
    )
}
